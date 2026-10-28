import * as THREE from 'three'
import { createLiquidMaterial, liquidOrbConfig } from '../../liquid-orb'
import { advanceBrightnessEnvelope, brightnessSignal } from '../../liquid-orb/brightness-response'
import type { OrchestraVisualSettings, OrchestraInstrument } from '../config'
import type { OrchestraPosition } from './seating'
import type { SectionVisualState } from './visual-state'
import type { AudibleActivity } from './audio-highlight'
import { familySections, type NavigationState } from '../utils/navigation'

// Picking and seating retain the original proxy. Both visible passes share its
// transforms and palette; the bloom pass packs disc coverage into alpha.
export function createLiquidNodes(source: THREE.InstancedMesh, nodes: OrchestraPosition[], interaction: OrchestraVisualSettings['interaction']) {
  const extent = liquidOrbConfig.rendering.halfExtent * 2
  const geometry = new THREE.PlaneGeometry(extent, extent)
  geometry.setAttribute('nodePalette', source.geometry.getAttribute('nodePalette'))
  geometry.setAttribute('orbFlow', new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 4), 4))
  const light = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 4), 4).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('orbLight', light)
  const material = createLiquidMaterial(true, true)
  const bloomMaterial = material.clone()
  bloomMaterial.defines.ORB_BLOOM_SOURCE = 1
  const discMaterial = material.clone()
  discMaterial.defines.PROTOTYPE_DISC_ONLY = 1
  const discMesh = new THREE.InstancedMesh(geometry, discMaterial, nodes.length)
  const mesh = new THREE.InstancedMesh(geometry, material, nodes.length)
  const bloomMesh = new THREE.InstancedMesh(geometry, bloomMaterial, nodes.length)
  for (const batch of [mesh, bloomMesh, discMesh]) {
    batch.instanceMatrix = source.instanceMatrix
    batch.frustumCulled = false
  }
  const envelopes = nodes.map(() => ({ intensity: 0, pulse: 0 }))
  const focus = source.geometry.getAttribute('nodeFocus') as THREE.InstancedBufferAttribute
  const idle = source.geometry.getAttribute('nodeIdle') as THREE.InstancedBufferAttribute
  return {
    mesh, bloomMesh, discMesh,
    reset() { for (const envelope of envelopes) { envelope.intensity = 0; envelope.pulse = 0 } },
    update(delta: number, state: SectionVisualState, reducedMotion: boolean, activity: ReadonlyMap<OrchestraInstrument, AudibleActivity>, navigation: NavigationState = { level: 'orchestra' }, rootHighlighted = false) {
      const { filled, brightnessResponse } = liquidOrbConfig
      let changing = false
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const audible = node.instrument ? activity.get(node.instrument) : undefined
        const envelope = envelopes[i]
        const target = !reducedMotion && audible?.active ? audible.intensity : 0
        const attack = !reducedMotion && audible?.active ? audible.attack ?? 0 : 0
        advanceBrightnessEnvelope(envelope, target, attack, delta, brightnessResponse)
        changing ||= Math.abs(envelope.intensity - target) > .0001 || Math.abs(envelope.pulse - attack) > .0001
        const signal = brightnessSignal(envelope, brightnessResponse)
        const dim = THREE.MathUtils.clamp(Math.max(-state.emphasis, 1 - focus.getX(i)), 0, 1)
        const selected = navigation.level !== 'orchestra' && familySections(navigation.familyId).includes(node.sectionId)
          && (navigation.level === 'family' || node.instrument === navigation.instrumentId)
        const hover = Math.max(0, focus.getX(i) - 1) / Math.max(.001, interaction.selectedInstrumentHoveredIntensity / interaction.familyIntensity - 1)
        // Positive section emphasis can be selection left over from withdrawal.
        // Only an explicit orchestra hover/idle target may boost root bloom.
        const highlight = (navigation.level === 'orchestra' ? Number(rootHighlighted) : THREE.MathUtils.clamp(hover, 0, 1))
          * (navigation.level === 'instrument' ? liquidOrbConfig.constellation.instrumentHighlightMultiplier : 1)
        const fade = 1 + (liquidOrbConfig.states.dimmed.opacity - 1) * dim
        const brightness = filled.brightness * fade * idle.getX(i)
          * (selected ? liquidOrbConfig.states.selected.brightnessMultiplier : 1)
          * (1 + filled.activeBrightness * highlight) * (1 + filled.musicBrightness * signal)
        // A fixed reference keeps a configured zero bloom meaningful.
        const bloom = (filled.bloomStrength + highlight * filled.highlightBloomBoost + signal * filled.musicBloomBoost) / .1
        // Keep inactive or navigation-dimmed nodes free of activity rings,
        // including the envelope's release tail after their gate closes.
        const rimSignal = audible?.active && target > 0 && dim < .001 ? signal : 0
        light.setXYZW(i, brightness, rimSignal, bloom, state.opacity)
      }
      light.needsUpdate = true
      return changing
    },
  }
}
