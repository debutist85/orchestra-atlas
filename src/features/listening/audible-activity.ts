// Pure RMS-analysis helpers for the audible-instrument highlight. Kept
// separate from listening-engine.ts so the math can be unit-tested with
// synthetic sample data (see tests/audible-activity.mjs), without needing a
// real decoded AudioBuffer or AudioContext.

// A channel's own "how loud does it typically play" reference level.
// Neither a flat average nor a bare peak works here: a flat average over the
// whole buffer is dragged down by an instrument's silent stretches (e.g.
// timpani, which mostly rests), making its reference far too quiet; a bare
// peak is dominated by the single loudest instant anywhere in the piece
// (e.g. one fortissimo climax), making every other genuinely-playing passage
// read as barely audible by comparison. Instead: split the buffer into short
// windows, drop the ones that are still just silence relative to the loudest
// window, and take a percentile of what's left — a "typical forte" level for
// this instrument's actual playing, not its rests or its single loudest beat.
export function typicalActiveRms(
  samples: Float32Array,
  windowSamples: number,
  options: { stride?: number; percentile?: number; silenceRatio?: number } = {},
) {
  if (samples.length === 0 || windowSamples <= 0) return 0
  const step = Math.max(1, options.stride ?? 1)
  const percentile = options.percentile ?? 0.7
  const silenceRatio = options.silenceRatio ?? 0.05
  const windowLevels: number[] = []
  let peak = 0
  for (let start = 0; start < samples.length; start += windowSamples) {
    const end = Math.min(start + windowSamples, samples.length)
    let sumSquares = 0
    let count = 0
    for (let index = start; index < end; index += step) {
      const value = samples[index]
      sumSquares += value * value
      count += 1
    }
    if (count > 0) {
      const rms = Math.sqrt(sumSquares / count)
      windowLevels.push(rms)
      peak = Math.max(peak, rms)
    }
  }
  if (peak <= 0) return 0
  const active = windowLevels.filter(level => level > peak * silenceRatio).sort((a, b) => a - b)
  if (active.length === 0) return peak
  return active[Math.min(active.length - 1, Math.floor(active.length * percentile))]
}

// RMS of a short window of samples centered on `centerIndex`, clamped to the
// buffer bounds.
export function windowRmsAt(samples: Float32Array, centerIndex: number, windowSamples: number) {
  if (samples.length === 0 || windowSamples <= 0) return 0
  const half = Math.floor(windowSamples / 2)
  const start = Math.max(0, Math.floor(centerIndex - half))
  const end = Math.min(samples.length, Math.floor(centerIndex + half))
  if (end <= start) return 0
  let sumSquares = 0
  for (let index = start; index < end; index++) sumSquares += samples[index] * samples[index]
  return Math.sqrt(sumSquares / (end - start))
}

// Normalizes a channel's current short-window loudness against its own peak
// reference level, so instruments with different natural loudness (or a
// naturally quiet solo passage) all read on the same 0-1 "how audible is
// this right now" scale.
export function activityFromRms(currentRms: number, referenceRms: number) {
  if (referenceRms <= 0) return 0
  return Math.min(1, Math.max(0, currentRms / referenceRms))
}

// Exponential ease toward `target`, so onset/offset reads as a smooth swell
// rather than flickering frame to frame with the raw RMS signal.
export function easeActivity(previous: number, target: number, blend: number) {
  const eased = previous + (target - previous) * blend
  return Math.abs(eased - target) < 0.001 ? target : eased
}
