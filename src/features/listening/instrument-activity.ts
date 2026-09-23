// Pure, reusable audio-analysis pipeline for a single instrument stem:
//
//   time-domain samples -> RMS -> dB -> hysteresis activity -> normalized
//   intensity -> attack/release smoothing -> InstrumentActivity
//
// This module knows nothing about Web Audio (AnalyserNode, AudioContext),
// the DOM, rendering, or any specific instrument roster. The caller is
// responsible for reading time-domain samples off its own AnalyserNode(s)
// (wired up before any mute/gain control, so muting never affects what's
// measured here) and feeding the resulting RMS value in every frame.

export type InstrumentAnalysisConfig = {
  /** AnalyserNode FFT size / time-domain window length. */
  fftSize: number
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
  fftSize: 2048,
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
  // Retained for debugging/tuning only — not meant to become app state.
  rms: number
  db: number
}

export function computeRms(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0
  let sumSquares = 0
  for (let index = 0; index < samples.length; index++) sumSquares += samples[index] * samples[index]
  return Math.sqrt(sumSquares / samples.length)
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

// Stateful per-instrument analyzer: holds the hysteresis + smoothing state
// across calls. Takes an already-measured RMS rather than raw samples so a
// caller with more than one AnalyserNode for the same stem (e.g. two mic
// takes of the same recording) can combine them (e.g. take the loudest)
// before feeding a single reading in per frame.
export function createInstrumentAnalyzer<InstrumentId = string>(
  instrumentId: InstrumentId,
  config: InstrumentAnalysisConfig = defaultInstrumentAnalysisConfig,
) {
  let active = false
  let intensity = 0

  const snapshot = (rms: number, db: number): InstrumentActivity<InstrumentId> => (
    { instrumentId, active, intensity, rms, db }
  )

  return {
    instrumentId,
    update(rms: number, dtSeconds: number): InstrumentActivity<InstrumentId> {
      const db = rmsToDb(rms, config.epsilon)
      active = nextActiveState(db, active, config)
      const normalized = normalizeDbToIntensity(db, config.minDb, config.maxDb)
      const target = active ? normalized : 0
      intensity = smoothIntensity(intensity, target, dtSeconds, config)
      return snapshot(rms, db)
    },
    // Convenience for the common single-AnalyserNode case.
    updateFromSamples(samples: ArrayLike<number>, dtSeconds: number): InstrumentActivity<InstrumentId> {
      return this.update(computeRms(samples), dtSeconds)
    },
    // Forces the instrument back to a silent, inactive rest state — used
    // when the transport stops, since analysis has nothing left to read.
    reset(): InstrumentActivity<InstrumentId> {
      active = false
      intensity = 0
      return snapshot(0, rmsToDb(0, config.epsilon))
    },
  }
}
