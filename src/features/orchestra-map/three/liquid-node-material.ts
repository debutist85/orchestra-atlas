import * as THREE from 'three'
import { applyOrbState, createLiquidMaterial, easeAttack, liquidOrbConfig, smoothResponse } from '../../liquid-orb'
import type { OrchestraVisualSettings } from '../config'
import type { OrchestraPosition } from './seating'
import type { SectionVisualState } from './visual-state'
import type { AudibleActivity } from './audio-highlight'
import type { OrchestraInstrument } from '../config'
import { nodeSeed } from './node-material'

// The legacy disk remains an invisible pick/capture surface. These billboards
// share its instance matrices and palette, so loading motion and seating cannot drift.
export function createLiquidNodes(source: THREE.InstancedMesh, nodes: OrchestraPosition[], interaction: OrchestraVisualSettings['interaction']) {
  const extent = liquidOrbConfig.rendering.halfExtent * 2
  const geometry = new THREE.PlaneGeometry(extent, extent)
  geometry.setAttribute('nodePalette', source.geometry.getAttribute('nodePalette'))
  const flow = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 4), 4).setUsage(THREE.DynamicDrawUsage)
  const light = new THREE.InstancedBufferAttribute(new Float32Array(nodes.length * 4), 4).setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('orbFlow', flow)
  geometry.setAttribute('orbLight', light)
  const material = createLiquidMaterial(true)
  const mesh = new THREE.InstancedMesh(geometry, material, nodes.length)
  mesh.instanceMatrix = source.instanceMatrix
  mesh.frustumCulled = false // A shader billboard extends beyond the proxy's bounds.
  const phases = nodes.map(node => liquidOrbConfig.rendering.initialTime + nodeSeed(node.id) * liquidOrbConfig.rendering.phaseSpread)
  const intensities = new Float32Array(nodes.length)
  const attacks = new Float32Array(nodes.length)
  const settings = { ...liquidOrbConfig.material }
  const focus = source.geometry.getAttribute('nodeFocus') as THREE.InstancedBufferAttribute
  const idle = source.geometry.getAttribute('nodeIdle') as THREE.InstancedBufferAttribute

  return {
    mesh,
    update(delta: number, state: SectionVisualState, reducedMotion: boolean, activity: ReadonlyMap<OrchestraInstrument, AudibleActivity>) {
      const config = liquidOrbConfig
      for (let i = 0; i < nodes.length; i++) {
        const audible = nodes[i].instrument ? activity.get(nodes[i].instrument!) : undefined
        const target = audible?.active ? audible.intensity : 0
        intensities[i] = reducedMotion ? config.constellation.reducedMotionIntensity : smoothResponse(intensities[i], target, delta)
        attacks[i] = reducedMotion || !config.attack.enabled ? 0 : easeAttack(attacks[i], audible?.active ? audible.attack ?? 0 : 0, delta)
        applyOrbState(settings, config.material, 'playing', 0, intensities[i], attacks[i], config.attack.strength)
        // Navigation focus is already eased by the camera timeline. Preserve
        // its hierarchy while applying the orb's own glow/opacity response.
        const dim = THREE.MathUtils.clamp(Math.max(-state.emphasis, 1 - focus.getX(i)), 0, 1)
        const nodeHighlight = Math.max(0, focus.getX(i) - 1)
          / Math.max(.001, interaction.selectedInstrumentHoveredIntensity / interaction.familyIntensity - 1)
        const highlight = THREE.MathUtils.clamp(Math.max(state.emphasis, nodeHighlight), 0, 1)
        const { dimmed, highlighted } = config.states
        settings.opacity *= state.opacity * (1 + (dimmed.opacity - 1) * dim)
        settings.glow *= (1 + (dimmed.glow - 1) * dim) * (1 + highlighted.glowBoost * highlight)
        settings.glowRadius *= (1 + (dimmed.glowRadius - 1) * dim) * (1 + highlighted.glowRadiusBoost * highlight)
        settings.brightness *= idle.getX(i) * (1 + highlighted.brightnessBoost * highlight)
        settings.speed *= 1 + (dimmed.speed - 1) * dim
        if (!reducedMotion) phases[i] += delta * settings.speed
        flow.setXYZW(i, phases[i], settings.complexity, settings.distortion, settings.strands)
        light.setXYZW(i, settings.brightness, settings.glow, settings.glowRadius, settings.opacity)
      }
      flow.needsUpdate = true
      light.needsUpdate = true
    },
  }
}
