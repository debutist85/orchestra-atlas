export const seatingPresetNames = ['compact', 'classical-wide', 'installation-spread'] as const
export type SeatingPresetName = (typeof seatingPresetNames)[number]

export type OrchestraFamily = 'strings' | 'woodwinds' | 'brass' | 'percussion' | 'auxiliary'
export type OrchestraInstrument =
  | 'violin1' | 'violin2' | 'viola' | 'cello' | 'doubleBass'
  | 'flute' | 'oboe' | 'clarinet' | 'bassoon'
  | 'horn' | 'trumpet' | 'trombone' | 'tuba' | 'percussion' | 'timpani'
  | 'harp' | 'piano'
export type OrchestraSectionId =
  | 'strings'
  | 'woodwinds'
  | 'brass'
  | 'percussion'
  | 'keyboard-instruments'
  | 'plucked-instruments'
  | 'conductor'

export type OrchestraSceneConfig = {
  visuals: OrchestraVisualSettings
  orchestraScale: number
  conductorOrigin: [number, number, number]
  surfaceWarp: { height: number }
  showNodeNumbers: boolean
  gyroscope: {
    enabled: boolean
    maxTiltDegrees: number
    easing: number
  }
  sections: Record<OrchestraSectionId, {
    name: string
    family: OrchestraFamily
    color: string
    gradient?: [string, string, string] // Left to right, with a gentle elevation bias.
  }>
  camera: {
    position: [number, number, number]
    target: [number, number, number]
    fov: number
  }
}

// Art direction only. Per-section interaction values live in visual-state.ts.
// These settings are staged for the upcoming material/floor implementation.
export type OrchestraVisualSettings = {
  performance: { maxPixelRatio: number; maxRenderPixels: number; frameRate: number }
  exposure: number // Tone-mapping exposure; bloom uses the original HDR brightness.
  nodes: {
    emissiveIntensity: number
    roughness: number
    internalShadow: number // 0–1 directional shading of the luminous interior.
    palette: {
      hueVariationDegrees: number
      brightnessVariation: number // Fractional variation around the base brightness.
    }
    swirl: {
      enabled: boolean
      speed: number // Cycles per second.
      scale: number // Pattern frequency in normalized sphere coordinates.
      contrast: number // 0–1; preserves dark patches within the luminous surface.
    }
  }
  glow: { enabled: boolean; strength: number; radius: number; threshold: number }
  floor: {
    enabled: boolean
    color: string
    clearance: number // World units below the lowest sphere, before preset scaling.
    roughness: number
    reflections: { enabled: boolean; strength: number; blur: number; resolution: number }
    shadows: { enabled: boolean; opacity: number; softness: number }
    lightSpill: { enabled: boolean; strength: number; radiusScale: number }
  }
  interaction: {
    transitionSeconds: number
    neutralIntensity: number // Baseline brightness; reserve HDR headroom for highlighting.
    dimmedIntensity: number // Intensity multiplier at emphasis -1.
    highlightedIntensity: number // Intensity multiplier at emphasis +1.
  }
}

const baseline: OrchestraSceneConfig = {
  visuals: {
    performance: { maxPixelRatio: 1, maxRenderPixels: 1500000, frameRate: 30 },
    exposure: 1,
    nodes: {
      emissiveIntensity: 1.2,
      roughness: 0.55,
      internalShadow: 0.95,
      palette: { hueVariationDegrees: 8, brightnessVariation: 0.12 },
      swirl: { enabled: true, speed: 0.04, scale: 2.5, contrast: 0.3 },
    },
    glow: { enabled: true, strength: 0.3, radius: 0.4, threshold: 0.65 },
    floor: {
      enabled: true,
      color: '#101216',
      clearance: 0.15,
      roughness: 0.75,
      reflections: { enabled: true, strength: 0.2, blur: 0.6, resolution: 512 },
      shadows: { enabled: true, opacity: 0.25, softness: 0.7 },
      lightSpill: { enabled: true, strength: 0.15, radiusScale: 3 },
    },
    interaction: { transitionSeconds: 0.3, neutralIntensity: 0.4, dimmedIntensity: 0.12, highlightedIntensity: 1 },
  },
  orchestraScale: 1,
  conductorOrigin: [0, 0, 0],
  // Front/back curvature of the upright fan; 0 removes the radial warp.
  surfaceWarp: { height: -1 },
  showNodeNumbers: false,
  gyroscope: { enabled: true, maxTiltDegrees: 3, easing: 0.08 },
  sections: {
    strings: { name: 'Strings', family: 'strings', color: '#e85870', gradient: ['#ff781f', '#a60932', '#ff528a'] },
    woodwinds: { name: 'Woodwinds', family: 'woodwinds', color: '#429dcc', gradient: ['#23bad9', '#1652a3', '#6692f0'] },
    brass: { name: 'Brass', family: 'brass', color: '#d9b65d', gradient: ['#e18b27', '#e9b744', '#ffe49b'] },
    percussion: { name: 'Percussion', family: 'percussion', color: '#a887c4', gradient: ['#78509e', '#a76bbb', '#df9cbc'] },
    'keyboard-instruments': {
      name: 'Keyboard instruments', family: 'auxiliary', color: '#72b8a4',
    },
    'plucked-instruments': {
      name: 'Plucked instruments', family: 'auxiliary', color: '#d98a4e',
    },
    conductor: { name: 'Conductor', family: 'auxiliary', color: '#d7dc45' },
  },
  camera: { position: [0, 6, 30], target: [0, 0, 0], fov: 24 },
}

export const orchestraScenePresets: Record<SeatingPresetName, OrchestraSceneConfig> = {
  compact: { ...baseline, orchestraScale: 0.9 },
  'classical-wide': baseline,
  'installation-spread': { ...baseline, orchestraScale: 1.08 },
}

export const defaultSeatingPreset: SeatingPresetName = 'classical-wide'

export function isSeatingPresetName(value: string | null): value is SeatingPresetName {
  return seatingPresetNames.some((name) => name === value)
}
