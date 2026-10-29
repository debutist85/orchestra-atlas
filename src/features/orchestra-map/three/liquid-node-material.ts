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
  const light = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 4), 4).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('orbLight', light)
  const layer = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length), 1).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('orbForeground', layer)
  const material = createLiquidMaterial(true, true)
  const bloomMaterial = material.clone()
  bloomMaterial.defines.ORB_BLOOM_SOURCE = 1
  const discMaterial = material.clone()
  discMaterial.defines.PROTOTYPE_DISC_ONLY = 1
  // The foreground pass needs only the disc and its antialiased edge, not
  // the much larger halo quad. Attributes and transforms remain shared.
  const discExtent = 1.02
  const discGeometry = new THREE.PlaneGeometry(discExtent * 2, discExtent * 2)
  discGeometry.setAttribute('nodePalette', geometry.getAttribute('nodePalette'))
  discGeometry.setAttribute('orbLight', light)
  discGeometry.setAttribute('orbForeground', layer)
  discMaterial.uniforms.halfExtent.value = discExtent
  const discMesh = new THREE.InstancedMesh(discGeometry, discMaterial, nodes.length)
  discMesh.layers.set(1)
  const mesh = new THREE.InstancedMesh(geometry, material, nodes.length)
  const bloomMesh = new THREE.InstancedMesh(geometry, bloomMaterial, nodes.length)
  for (const batch of [mesh, bloomMesh, discMesh]) {
    batch.instanceMatrix = source.instanceMatrix
    batch.frustumCulled = false
  }
  // Split by semantic layer without reordering the picking proxy or copying
  // instance data. Only the populated layer submits a draw for each pass.
  const frontMaterial = material.clone()
  frontMaterial.defines.PROTOTYPE_DISC_ONLY = 1
  const frontBloomMaterial = bloomMaterial.clone()
  const frontDiscMaterial = material.clone()
  const foreground = {
    mesh: new THREE.InstancedMesh(geometry, frontMaterial, nodes.length),
    bloomMesh: new THREE.InstancedMesh(geometry, frontBloomMaterial, nodes.length),
    discMesh: new THREE.InstancedMesh(geometry, frontDiscMaterial, nodes.length),
  }
  for (const batch of Object.values(foreground)) {
    batch.material.uniforms.orbDrawLayer.value = 1
    batch.material.depthTest = false
    batch.instanceMatrix = source.instanceMatrix
    batch.renderOrder = 1
    batch.frustumCulled = false
    batch.visible = false
  }
  foreground.discMesh.layers.set(2)
  // Foreground coronas are painted once, after inactive discs. Their main
  // pass paints only the fill, while the bloom source still includes the rim.
  const tracks = new Map([...new Set(nodes.map(node => node.instrument))].map(id => [id, {
    intensity: 0, pulse: 0, signal: 0, active: false,
  }]))
  const focus = source.geometry.getAttribute('nodeFocus') as THREE.InstancedBufferAttribute
  const idle = source.geometry.getAttribute('nodeIdle') as THREE.InstancedBufferAttribute
  return {
    mesh, bloomMesh, discMesh, foreground,
    reset() { for (const envelope of tracks.values()) { envelope.intensity = 0; envelope.pulse = 0 } },
    update(delta: number, state: SectionVisualState, reducedMotion: boolean, activity: ReadonlyMap<OrchestraInstrument, AudibleActivity>, navigation: NavigationState = { level: 'orchestra' }, rootHighlighted = false, wavingInstrument?: OrchestraInstrument) {
      const { filled, brightnessResponse } = liquidOrbConfig
      let changing = false
      let dirty = false
      let layerDirty = false
      let foregroundCount = 0
      for (const [id, envelope] of tracks) {
        const audible = id ? activity.get(id) : undefined
        const target = !reducedMotion && audible?.active ? audible.intensity : 0
        const attack = !reducedMotion && audible?.active ? audible.attack ?? 0 : 0
        if (reducedMotion) { envelope.intensity = 0; envelope.pulse = 0 }
        else advanceBrightnessEnvelope(envelope, target, attack, delta, brightnessResponse)
        if (Math.abs(envelope.intensity - target) < .0001) envelope.intensity = target
        if (Math.abs(envelope.pulse - attack) < .0001) envelope.pulse = attack
        changing ||= envelope.intensity !== target || envelope.pulse !== attack
        envelope.signal = brightnessSignal(envelope, brightnessResponse)
        envelope.active = !!audible?.active && target > 0
      }
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i]
        const foregroundNode = !!node.instrument && (node.instrument === wavingInstrument
          || (navigation.level === 'instrument' && node.instrument === navigation.instrumentId))
        const targetLayer = Number(foregroundNode)
        foregroundCount += targetLayer
        if (layer.getX(i) !== targetLayer) { layer.setX(i, targetLayer); layerDirty = true }
        const envelope = tracks.get(node.instrument)!
        const signal = envelope.signal
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
        const rimSignal = envelope.active && dim < .001 ? signal : 0
        const x = Math.fround(brightness), y = Math.fround(rimSignal)
        const z = Math.fround(bloom), w = Math.fround(state.opacity)
        if (light.getX(i) !== x || light.getY(i) !== y || light.getZ(i) !== z || light.getW(i) !== w) {
          light.setXYZW(i, x, y, z, w)
          dirty = true
        }
      }
      if (dirty) light.needsUpdate = true
      if (layerDirty) layer.needsUpdate = true
      mesh.visible = bloomMesh.visible = discMesh.visible = foregroundCount < nodes.length
      foreground.mesh.visible = foreground.bloomMesh.visible = foreground.discMesh.visible = foregroundCount > 0
      return changing
    },
  }
}
