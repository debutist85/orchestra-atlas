import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

import type { OrchestraInstrument } from '../../orchestra-map/config'
import { instrumentExplorerConfig } from '../config'

export type ToneMappingName = 'neutral' | 'aces'
export type LightingSettings = {
  toneMapping: ToneMappingName
  exposure: number
  environmentIntensity: number
}

// Per-instrument tuning on top of instrumentExplorerConfig.lighting — e.g. a
// polished brass model and a matte wooden one rarely want the same exposure.
// Values come from the debug panel's "Copy lighting" output (?debug=true).
const lightingOverrides: Partial<Record<OrchestraInstrument, Partial<LightingSettings>>> = {
  horn: { toneMapping: 'neutral', exposure: 0.75, environmentIntensity: 1.3 },
  // Lift the dark frame and reflective fittings against the black stage.
  harp: { toneMapping: 'neutral', exposure: 1.35, environmentIntensity: 1.8 },
}

export function instrumentLighting(instrumentId: OrchestraInstrument): LightingSettings {
  return { ...instrumentExplorerConfig.lighting, ...lightingOverrides[instrumentId] }
}

const toneMappings: Record<ToneMappingName, THREE.ToneMapping> = {
  // Khronos PBR Neutral keeps base colours' hue and saturation (it was designed
  // for product rendering); ACES Filmic pulls saturated yellows toward
  // orange-brown, which is what turned the horn's gold brass muddy.
  neutral: THREE.NeutralToneMapping,
  aces: THREE.ACESFilmicToneMapping,
}

// Only renderer/scene-level values change — every material keeps its GLB
// settings untouched (scene.environmentIntensity scales the environment
// globally, instead of writing envMapIntensity onto each material).
export function applyLighting(renderer: THREE.WebGLRenderer, scene: THREE.Scene, settings: LightingSettings) {
  renderer.toneMapping = toneMappings[settings.toneMapping]
  renderer.toneMappingExposure = settings.exposure
  scene.environmentIntensity = settings.environmentIntensity
}

// Metallic PBR materials get almost all their brightness from reflecting
// their surroundings, not from punctual lights — without an environment a
// polished metal (the horn: metalness ≈ 0.87, roughness 0) reflects black
// and renders dark. RoomEnvironment is three's procedural studio (soft
// boxes in a neutral room), prefiltered once into a small HDR cubemap: no
// download, ~one frame of GPU work at load, then free per frame — suitable
// for mobile. Set as scene.environment only, never scene.background, so the
// transparent canvas still shows the page's black behind it.
export function createStudioEnvironment(renderer: THREE.WebGLRenderer) {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const room = new RoomEnvironment()
  const target = pmrem.fromScene(room, 0.04)
  room.dispose()
  pmrem.dispose()
  return target
}
