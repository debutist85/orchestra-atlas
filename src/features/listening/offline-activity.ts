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
