export const defaultPlayback = {
  duration: 180,
  tempoBpm: 72,
  pulseCount: 5,
} as const

export function clampPlaybackPosition(position: number, duration: number) {
  if (!Number.isFinite(position) || !Number.isFinite(duration)) return 0
  return Math.min(Math.max(duration, 0), Math.max(0, position))
}

export function formatPlaybackTime(seconds: number) {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const minutes = Math.floor(safe / 60)
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`
}

const pulseOffsets = [0, 0.14, 0.5, 0.31, 0.78]
const pulseWeights = [1, 0.62, 0.84, 0.5, 0.7]

// Beat envelopes from the transport, not frequency bands. A later score can
// replace tempo with notated pulse without changing the chrome.
export function pulseLevels(
  seconds: number,
  options: { tempoBpm?: number; count?: number; playing?: boolean; reducedMotion?: boolean } = {},
) {
  const count = Math.max(1, options.count ?? defaultPlayback.pulseCount)
  const rest = 0.16
  if (!options.playing || options.reducedMotion) return Array.from({ length: count }, () => rest)
  const tempo = Math.max(1, options.tempoBpm ?? defaultPlayback.tempoBpm)
  const beat = Math.max(0, seconds) * tempo / 60
  return Array.from({ length: count }, (_, index) => {
    const phase = ((beat - (pulseOffsets[index] ?? index * 0.17)) % 1 + 1) % 1
    const bar = Math.floor(beat)
    const downbeat = index === 0 && bar % 4 === 0 ? 1.18 : 1
    return rest + (1 - rest) * Math.pow(1 - phase, 2.35) * (pulseWeights[index] ?? 0.6) * downbeat
  })
}
