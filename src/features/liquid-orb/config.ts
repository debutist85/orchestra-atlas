export type OrbSettings = {
  speed: number; complexity: number; distortion: number; strands: number
  thickness: number; brightness: number; folds: number; ambient: number
  highlights: number; glow: number; glowRadius: number; opacity: number; color: string
}

// Shared art direction for /dev/liquid-orb and the instanced constellation.
// Instrument color comes from orchestra-map/config.ts (color band → instrument → section).
export const liquidOrbConfig = {
  material: {
    speed: .65, complexity: 1, distortion: 0, strands: 7,
    thickness: 1.5, brightness: 1, folds: 0, ambient: .2,
    highlights: 2.4, glow: .65, glowRadius: 1, opacity: 1, color: '#35c9ff',
  } satisfies OrbSettings,
  states: {
    dimmed: { opacity: .28, glow: .3, glowRadius: .75, speed: .55 },
    highlighted: { glowBoost: 3, glowRadiusBoost: .65, brightnessBoost: .5, ambient:.5 },
    selected: { brightnessMultiplier: 2 },
    // Playing intensity ranges; Idle shares dimmed speed and retains the base flow.
    playing: {
      speed: [.45, 2], distortion: [.55, 1.6], complexity: [.7, 1.4],
      density: [.5, 1.6], glow: [.75, 1.4],
    },
  },
  response: { intensityRise: 5, intensityFall: 2.5 },
  attack: {
    enabled: true, strength: 1, maxStrength: 2, amplitude: .45,
    lookbackSeconds: .08, noiseFloor: .02, fullRise: .2,
    entryCeiling: .5, entryGain: 2, riseRate: 45, fallRate: 8,
  },
  rendering: {
    maxStrands: 8, halfExtent: 1.4, darkVolumeOpacity: .85,
    initialTime: 3.5, phaseSpread: 23,
  },
  prototype: {
    zoom: { default: 1.25, min: .1, max: 3, step: .05 },
    filled: {
      brightness: .6, activeBrightness: 2, musicBrightness: .35, musicBloomBoost: 0,
      bloomStrength: .1, highlightBloomBoost: .1, bloomRadius: .35, bloomThreshold: .8,
    },
    rim: {
      minThickness: .006, maxThickness: .05, brightness: 2.2, glow: .18,
    },
    brightnessResponse: {
      leadMs: 20, contrast: 1.05, pulseStrength: 1,
      riseMs: 20, fallMs: 90, pulseRiseMs: 8, pulseFallMs: 100,
      pulseWindowMs: 60, lookbackMs: 70, noiseFloor: .005, fullRise: .1,
    },
    viewExtent: 2.2,
    // Size references resolve through the full map seating configuration.
    sizes: {
      small: { label: 'Small · Violin', instrument: 'violin' },
      medium: { label: 'Medium · Cello', instrument: 'cello' },
      large: { label: 'Large · Timpani', instrument: 'timpani' },
    },
  },
  constellation: {
    enabled: true,
    // The orb contains its own compact glow. Avoid doubling it with legacy effects.
    legacyGhosts: false, legacyActivityRings: false,
    // Static material phase under reduced motion; intensity still has a semantic counterpart.
    reducedMotionIntensity: 0,
  },
}

export type OrbSize = keyof typeof liquidOrbConfig.prototype.sizes

export type FilledNodeSettings = typeof liquidOrbConfig.prototype.filled

export type BrightnessResponseSettings = typeof liquidOrbConfig.prototype.brightnessResponse

export type OrbRimSettings = typeof liquidOrbConfig.prototype.rim
