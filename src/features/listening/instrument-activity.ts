// Analysis primitives for one instrument's loudness envelope:
//
//   RMS -> dB -> hysteresis activity -> normalized intensity
//   -> attack/release smoothing
//
// Used offline by offline-activity.ts (`npm run audio:activity`); the
// runtime only reads the resulting profile. Nothing here knows about Web
// Audio, the DOM, or a specific instrument roster.

export type InstrumentAnalysisConfig = {
  /** A signal must rise to at least this loud to become "active". */
  activateThresholdDb: number
  /** Once active, must fall to/below this before becoming "inactive" — the
   * gap between this and activateThresholdDb is the hysteresis band that
   * prevents rapid flicker right at the edge of audibility. */
  deactivateThresholdDb: number
  /** dB level mapped to intensity 0. */
  minDb: number
  /** dB level mapped to intensity 1. Real stems rarely approach 0 dBFS, so
   * this is tuned to the instrument's actual musical range, not full scale. */
  maxDb: number
  /** Time constant (seconds) used while intensity is rising. */
  attackTimeSeconds: number
  /** Time constant (seconds) used while intensity is falling. */
  releaseTimeSeconds: number
  /** Floor for RMS before taking log10, to avoid log(0) on true silence. */
  epsilon: number
}

export const defaultInstrumentAnalysisConfig: InstrumentAnalysisConfig = {
  activateThresholdDb: -50,
  deactivateThresholdDb: -58,
  minDb: -55,
  maxDb: -12,
  // At 0.08s, a note needs ~240ms (3 time constants) to reach ~95% of its
  // target intensity — long enough that a legato phrase audibly swells in
  // over its first quarter-second, and a staccato note under ~150ms never
  // gets there at all before it ends, so it plays back at a fraction of its
  // real loudness. 0.02s reaches ~95% in ~60ms, fast enough for ordinary
  // staccato durations while still avoiding an instant on/off transient.
  attackTimeSeconds: 0.02,
  releaseTimeSeconds: 0.3,
  epsilon: 1e-8,
}

export type OfflineActivityAnalysisConfig = {
  sampleInterval: number
  minBurstSeconds: number
  nearSilenceIntensity: number
  intensityDecimals: number
  durationWarnSeconds: number
}

export const defaultOfflineActivityAnalysis: OfflineActivityAnalysisConfig = {
  sampleInterval: 0.05,
  minBurstSeconds: 0.1,
  nearSilenceIntensity: 0.15,
  intensityDecimals: 3,
  durationWarnSeconds: 0.25,
}

export type InstrumentActivity<InstrumentId = string> = {
  instrumentId: InstrumentId
  active: boolean
  intensity: number // 0..1, smoothed
}

export function rmsToDb(rms: number, epsilon: number): number {
  return 20 * Math.log10(Math.max(rms, epsilon))
}

export function normalizeDbToIntensity(db: number, minDb: number, maxDb: number): number {
  if (maxDb <= minDb) return db >= maxDb ? 1 : 0
  return Math.min(1, Math.max(0, (db - minDb) / (maxDb - minDb)))
}

// A signal must clearly cross the upper threshold to activate, but can fall
// somewhat lower before being considered inactive again.
export function nextActiveState(db: number, wasActive: boolean, config: InstrumentAnalysisConfig): boolean {
  return wasActive ? db > config.deactivateThresholdDb : db >= config.activateThresholdDb
}

// Frame-rate-independent exponential ease toward `target`, with separate
// time constants for rising (attack) vs. falling (release) signals.
export function smoothIntensity(
  current: number, target: number, dtSeconds: number, config: InstrumentAnalysisConfig,
): number {
  if (dtSeconds <= 0) return current
  const timeConstant = target > current ? config.attackTimeSeconds : config.releaseTimeSeconds
  if (timeConstant <= 0) return target
  const alpha = 1 - Math.exp(-dtSeconds / timeConstant)
  return current + (target - current) * alpha
}
