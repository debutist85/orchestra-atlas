import type { OrchestraInstrument } from '../orchestra-map/config'
import type { InstrumentActivity } from './instrument-activity'
import { defaultInstrumentAnalysisConfig, rmsToDb } from './instrument-activity'

export type ActivityProfileAnalysis = {
  activateThresholdDb: number
  deactivateThresholdDb: number
  minDb: number
  maxDb: number
  attackTime: number
  releaseTime: number
}

export type ActivityProfile = {
  version: 1
  excerptId: string
  duration: number
  sampleInterval: number
  analysis: ActivityProfileAnalysis
  instruments: Record<string, number[]>
}

export const silentActivity = <InstrumentId,>(instrumentId: InstrumentId): InstrumentActivity<InstrumentId> => ({
  instrumentId,
  active: false,
  intensity: 0,
  rms: 0,
  db: rmsToDb(0, defaultInstrumentAnalysisConfig.epsilon),
})

export function intensityAt(
  profile: ActivityProfile,
  instrumentId: string,
  currentTime: number,
  interpolate = true,
) {
  const values = profile.instruments[instrumentId]
  if (!values?.length || profile.sampleInterval <= 0 || currentTime < 0) return 0
  const position = currentTime / profile.sampleInterval
  const index = Math.floor(position)
  if (index >= values.length) return 0
  const current = values[index] ?? 0
  if (!interpolate) return current
  const next = values[index + 1]
  if (next === undefined) return current
  return current + (next - current) * (position - index)
}

export function instrumentActivityAt<InstrumentId extends string = OrchestraInstrument>(
  profile: ActivityProfile | null | undefined,
  instrumentId: InstrumentId,
  currentTime: number,
  playing: boolean,
): InstrumentActivity<InstrumentId> {
  if (!playing || !profile) return silentActivity(instrumentId)
  const intensity = intensityAt(profile, instrumentId, currentTime)
  return {
    instrumentId,
    active: intensity > 0,
    intensity,
    rms: 0,
    db: 0,
  }
}

export async function fetchActivityProfile(url: string): Promise<ActivityProfile> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Missing activity profile ${url}`)
  const profile = await response.json() as ActivityProfile
  if (profile.version !== 1 || !profile.instruments || profile.sampleInterval <= 0) {
    throw new Error(`Invalid activity profile ${url}`)
  }
  return profile
}
