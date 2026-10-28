import type { FilledNodeSettings, OrbSettings } from './config.ts'

// Broad dynamics build density; brief onset envelopes accent thickness and light.
export function applyFlowResponse(
  out: OrbSettings, base: OrbSettings, intensity: number, attack: number,
  strength: number, response: FilledNodeSettings,
) {
  const level = Math.max(0, Math.min(1, intensity))
  const pulse = Math.max(0, Math.min(1, attack)) * Math.max(0, strength)
  out.distortion = base.distortion
  out.complexity = base.complexity
  out.thickness = base.thickness * (1 + level * response.musicThickness + pulse * response.attackThickness)
  out.brightness = base.brightness * (1 + level * response.musicStrandBrightness + pulse * response.attackBrightness)
}
