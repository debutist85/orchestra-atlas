import type { OrchestraInstrument } from '../orchestra-map/config'
import type { InstrumentActivity } from './instrument-activity'

export type ActivityProfileAnalysis = {
  activateThresholdDb: number
  deactivateThresholdDb: number
  minDb: number
  maxDb: number
  attackTime: number
  releaseTime: number
}

export type ActivityChunkMask = {
  duration: number
  peakThreshold: number
  stems: Record<string, readonly number[]>
}

export type ActivityProfile = {
  version: 2
  excerptId: string
  duration: number
  sampleInterval: number
  // Per-id analysis config the offline pipeline calibrated each series
  // from (instrument/family ids, plus 'orchestra') — descriptive only,
  // nothing here reads it at runtime.
  analysisByKey: Record<string, ActivityProfileAnalysis>
  // Calibrated per instrument's own loudness range — for anything judging a
  // single instrument's own activity (visual highlights, its own solo boost).
  instruments: Record<string, number[]>
  // Same instruments, analyzed under one shared/global range — for anything
  // comparing or aggregating ACROSS instruments (ensembleIntensity,
  // orchestraAverageIntensity), which need one consistent absolute scale
  // that per-instrument calibration deliberately breaks.
  instrumentsShared: Record<string, number[]>
  families?: Record<string, number[]>
  orchestra?: number[]
  // Per-instrument sounding spans as flat [start, end, …] seconds, measured
  // at 5 ms against an absolute floor. They decide WHEN an instrument is
  // playing; the envelopes above only say how loudly.
  gates?: Record<string, number[]>
  chunks?: ActivityChunkMask
}

// A chunk is audible when its raw peak exceeds one 16-bit LSB. The visual
// intensity envelope is a separate product and must not make this decision:
// it can sit at zero across a quiet but real entrance.
export function chunkIsAudible(
  mask: ActivityChunkMask | null | undefined,
  stemId: string,
  index: number,
  chunkDuration?: number,
) {
  if (!mask || !mask.stems) return true
  if (chunkDuration !== undefined && mask.duration !== chunkDuration) return true
  const flags = mask.stems[stemId]
  if (!flags || !Number.isInteger(index) || index < 0 || index >= flags.length) return true
  return flags[index] !== 0
}

export const silentActivity = <InstrumentId,>(instrumentId: InstrumentId): InstrumentActivity<InstrumentId> => ({
  instrumentId,
  active: false,
  intensity: 0,
})

function intensityFromSeries(
  values: readonly number[] | undefined,
  sampleInterval: number,
  currentTime: number,
  interpolate: boolean,
) {
  if (!values?.length || sampleInterval <= 0 || currentTime < 0) return 0
  const position = currentTime / sampleInterval
  const index = Math.floor(position)
  if (index >= values.length) return 0
  const current = values[index] ?? 0
  if (!interpolate) return current
  const next = values[index + 1]
  if (next === undefined) return current
  return current + (next - current) * (position - index)
}

export function intensityAt(
  profile: ActivityProfile,
  instrumentId: string,
  currentTime: number,
  interpolate = true,
) {
  return intensityFromSeries(profile.instruments[instrumentId], profile.sampleInterval, currentTime, interpolate)
}

// Same interpolation as intensityAt, but reads the shared/global-scale
// series — use this for anything comparing or aggregating across
// instruments (see ActivityProfile.instrumentsShared).
export function sharedIntensityAt(
  profile: ActivityProfile,
  instrumentId: string,
  currentTime: number,
  interpolate = true,
) {
  return intensityFromSeries(profile.instrumentsShared[instrumentId], profile.sampleInterval, currentTime, interpolate)
}

// Whether `time` falls inside one of the flat [start, end, …] spans. Spans
// are sorted and disjoint, so a binary search finds the last start <= time.
export function gateAt(gates: readonly number[] | undefined, time: number) {
  if (!gates?.length || !(time >= 0)) return false
  let low = 0
  let high = gates.length / 2 - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (gates[middle * 2] <= time) {
      found = middle
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return found >= 0 && time < gates[found * 2 + 1]
}

export function instrumentActivityAt<InstrumentId extends string = OrchestraInstrument>(
  profile: ActivityProfile | null | undefined,
  instrumentId: InstrumentId,
  currentTime: number,
  playing: boolean,
): InstrumentActivity<InstrumentId> {
  if (!playing || !profile) return silentActivity(instrumentId)
  const intensity = intensityAt(profile, instrumentId, currentTime)
  const gates = profile.gates?.[instrumentId]
  return {
    instrumentId,
    active: gates ? gateAt(gates, currentTime) : intensity > 0,
    intensity,
  }
}

export async function fetchActivityProfile(url: string): Promise<ActivityProfile> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Missing activity profile ${url}`)
  const profile = await response.json() as ActivityProfile
  if (profile.version !== 2 || !profile.instruments || profile.sampleInterval <= 0) {
    throw new Error(`Invalid activity profile ${url}`)
  }
  return profile
}
