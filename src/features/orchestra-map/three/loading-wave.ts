// While an instrument's 3D model prepares, its own lights ripple through
// depth instead of showing a spinner. Pure math only: the scene owns the
// nodes, the camera and the clock; tuning lives in config.ts (visuals.loadingWave).

export type LoadingWaveSettings = {
  periodSeconds: number // One full approach-and-recede cycle for a large constellation.
  singlePeriodSeconds: number // The quicker cycle of a single light.
  fullPeriodNodeCount: number // From this many lights on, the cycle is periodSeconds.
  amplitude: number // Peak travel toward the camera, as a share of that node's depth along the view axis.
  glow: number // Extra brightness at the closest point.
  neighborDelaySeconds: number // Lag between neighbouring lights in a small group.
  maxSpreadCycles: number // Cap on the whole constellation's lag, in cycles, so a large one keeps one coherent ripple.
  directionDegrees: number // Screen-space direction the wave travels (0 = left to right).
  blendInSeconds: number
  blendOutSeconds: number
}

// Fewer lights cycle faster: a lone light reads as a quick pulse, and the
// cycle lengthens evenly with the count until fullPeriodNodeCount.
export function loadingWavePeriod(count: number, settings: LoadingWaveSettings) {
  const span = Math.max(1, settings.fullPeriodNodeCount - 1)
  const t = Math.min(1, Math.max(0, (count - 1) / span))
  return settings.singlePeriodSeconds + (settings.periodSeconds - settings.singlePeriodSeconds) * t
}

// Phase lag (radians) per node from its projected screen position (any
// isotropic unit, y up). One node pulses alone; up to three follow each
// other in spatial order at the neighbour delay; four or more lag by
// position along the wave direction, so the ripple keeps the
// constellation's own spacing. Either way the total lag grows with the
// count only until it reaches maxSpreadCycles.
export function loadingWavePhases(points: ReadonlyArray<{ x: number; y: number }>, settings: LoadingWaveSettings) {
  if (points.length < 2) return points.map(() => 0)
  const angle = settings.directionDegrees * Math.PI / 180
  const along = points.map(point => point.x * Math.cos(angle) + point.y * Math.sin(angle))
  const period = loadingWavePeriod(points.length, settings)
  const spreadSeconds = Math.min((points.length - 1) * settings.neighborDelaySeconds, settings.maxSpreadCycles * period)
  const spread = spreadSeconds / Math.max(0.001, period) * Math.PI * 2
  const min = Math.min(...along)
  const extent = Math.max(...along) - min
  if (points.length <= 3 || extent < 1e-6) {
    const order = along.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value || a.index - b.index)
    const phases = new Array<number>(points.length)
    order.forEach(({ index }, rank) => { phases[index] = rank / (points.length - 1) * spread })
    return phases
  }
  return along.map(value => (value - min) / extent * spread)
}

// 0 at rest, 1 at the closest point. Lights only ever approach from where
// they sit, so the constellation's resting shape is the wave's floor.
// periodSeconds is the instrument's own, from loadingWavePeriod.
export function loadingWaveLift(time: number, phase: number, periodSeconds: number) {
  const angle = time / Math.max(0.001, periodSeconds) * Math.PI * 2 - phase
  return 0.5 - 0.5 * Math.cos(angle)
}

// Eased weight toward on/off; seconds-based so it does not depend on frame rate.
export function stepLoadingWeight(current: number, active: boolean, delta: number, settings: LoadingWaveSettings) {
  const seconds = active ? settings.blendInSeconds : settings.blendOutSeconds
  const step = seconds <= 0 ? 1 : delta / seconds
  return active ? Math.min(1, current + step) : Math.max(0, current - step)
}

// Smoothstep keeps the start and stop of the blend free of a visible kink.
export function easeLoadingWeight(weight: number) {
  return weight * weight * (3 - 2 * weight)
}
