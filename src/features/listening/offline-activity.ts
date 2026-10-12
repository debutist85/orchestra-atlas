import {
  defaultInstrumentAnalysisConfig,
  defaultOfflineActivityAnalysis,
  nextActiveState,
  normalizeDbToIntensity,
  rmsToDb,
  smoothIntensity,
  type InstrumentAnalysisConfig,
  type OfflineActivityAnalysisConfig,
} from './instrument-activity'

export function combineWindowRms(windows: readonly (readonly number[])[]): number[] {
  const length = windows.reduce((max, series) => Math.max(max, series.length), 0)
  return Array.from({ length }, (_, index) => (
    Math.max(0, ...windows.map(series => series[index] ?? 0))
  ))
}

export function suppressMicroEvents(
  active: boolean[],
  normalized: number[],
  dt: number,
  config: OfflineActivityAnalysisConfig = defaultOfflineActivityAnalysis,
) {
  const minFrames = Math.max(1, Math.round(config.minBurstSeconds / dt))
  if (minFrames <= 1) return active
  const next = active.slice()
  let index = 0
  while (index < next.length) {
    if (!next[index]) {
      index += 1
      continue
    }
    let end = index
    let peak = 0
    while (end < next.length && next[end]) {
      peak = Math.max(peak, normalized[end] ?? 0)
      end += 1
    }
    if (end - index < minFrames && peak < config.nearSilenceIntensity) {
      next.fill(false, index, end)
    }
    index = end
  }
  return next
}

export function intensityEnvelopeFromRms(
  rmsWindows: readonly number[],
  dt: number,
  analysis: InstrumentAnalysisConfig = defaultInstrumentAnalysisConfig,
  offline: OfflineActivityAnalysisConfig = defaultOfflineActivityAnalysis,
) {
  const normalized: number[] = []
  const rawActive: boolean[] = []
  let active = false
  for (const rms of rmsWindows) {
    const db = rmsToDb(rms, analysis.epsilon)
    active = nextActiveState(db, active, analysis)
    rawActive.push(active)
    normalized.push(normalizeDbToIntensity(db, analysis.minDb, analysis.maxDb))
  }
  const keptActive = suppressMicroEvents(rawActive, normalized, dt, offline)
  const intensity: number[] = []
  let current = 0
  for (let index = 0; index < rmsWindows.length; index++) {
    const target = keptActive[index] ? normalized[index] : 0
    current = smoothIntensity(current, target, dt, analysis)
    intensity.push(roundIntensity(current, offline.intensityDecimals))
  }
  return { intensity, active: keptActive, normalized }
}

export function roundIntensity(value: number, decimals: number) {
  const factor = 10 ** decimals
  return Math.round(Math.min(1, Math.max(0, value)) * factor) / factor
}

export type CalibrationConfig = {
  // Excludes true digital silence (measured floor on real masters: well
  // below -100dB) from the percentile stats below, without excluding real
  // quiet playing.
  silenceFloorDb: number
  minPercentile: number // -> minDb (intensity-0 floor)
  maxPercentile: number // -> maxDb (intensity-1 ceiling)
  thresholdPercentile: number // -> deactivateThresholdDb
  // Fixed, not scaled to the instrument's own range: hysteresis exists to
  // absorb measurement noise at the threshold (RMS window quantization, mic
  // bleed, dither), a roughly fixed-dB phenomenon, not one that should
  // shrink or grow with how wide an instrument's dynamic range happens to be.
  hysteresisDb: number
  // Safety-net floor (as a duration, like minBurstSeconds, not a raw window
  // count, so it stays meaningful if --interval changes the window size)
  // below which a percentile over so few samples is unreliable — falls back
  // to `base` instead.
  minSoundingSeconds: number
}

export const defaultCalibrationConfig: CalibrationConfig = {
  silenceFloorDb: -70,
  minPercentile: 0.10,
  maxPercentile: 0.95,
  thresholdPercentile: 0.05,
  hysteresisDb: 8,
  minSoundingSeconds: 3,
}

// Averages a small neighborhood of order statistics around the target rank
// instead of a single nearest-rank value, so one stray transient (a bow
// scratch, a single sforzando hit) among a short sample can't
// single-handedly become an instrument's whole-piece ceiling or floor.
function percentile(sortedAscending: readonly number[], fraction: number, spread = 2): number {
  if (!sortedAscending.length) return -Infinity
  const center = fraction * (sortedAscending.length - 1)
  const low = Math.max(0, Math.floor(center) - spread)
  const high = Math.min(sortedAscending.length - 1, Math.ceil(center) + spread)
  let sum = 0
  for (let index = low; index <= high; index++) sum += sortedAscending[index]
  return sum / (high - low + 1)
}

// Derives a per-instrument analysis config from that instrument's own
// loudness distribution, instead of reusing one global dB range/threshold
// for every stem — a stem recorded/mixed quieter than the ensemble average
// (e.g. a solo woodwind under a global range tuned closer to the full tutti)
// would otherwise read as under-active no matter how it's actually played.
// Known limitation, not solved here: a flat absolute silence floor can't
// distinguish an instrument's own quiet playing from mic bleed off
// neighboring sections during its rests — a second, relative gate (à la EBU
// R128) would catch this, but isn't warranted unless real listening turns
// up false "active" highlighting during an instrument's actual rests.
export function calibrateInstrumentAnalysis(
  rmsWindows: readonly number[],
  dt: number,
  base: InstrumentAnalysisConfig = defaultInstrumentAnalysisConfig,
  calibration: CalibrationConfig = defaultCalibrationConfig,
): { analysis: InstrumentAnalysisConfig; calibrated: boolean } {
  const soundingDb = rmsWindows
    .map(rms => rmsToDb(rms, base.epsilon))
    .filter(db => db > calibration.silenceFloorDb)
    .sort((a, b) => a - b)
  const minSoundingWindows = Math.max(1, Math.round(calibration.minSoundingSeconds / dt))
  if (soundingDb.length < minSoundingWindows) return { analysis: base, calibrated: false }
  const deactivateThresholdDb = percentile(soundingDb, calibration.thresholdPercentile)
  const minDb = percentile(soundingDb, calibration.minPercentile)
  const maxDb = percentile(soundingDb, calibration.maxPercentile)
  if (!(maxDb > minDb)) return { analysis: base, calibrated: false }
  return {
    analysis: {
      ...base,
      minDb,
      maxDb,
      deactivateThresholdDb,
      activateThresholdDb: deactivateThresholdDb + calibration.hysteresisDb,
    },
    calibrated: true,
  }
}
