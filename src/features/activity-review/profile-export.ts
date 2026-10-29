import type { ActivityProfile, ActivityProfileAnalysis } from '../listening/activity-profile.ts'
import { gateAt } from '../listening/activity-profile.ts'
import type { ReviewReport } from './analysis.ts'

export type RevisedProfile = ActivityProfile & {
  onsets: Record<string, { time: number; strength: number }[]>
  profiling: {
    algorithm: 'atlas-spectral-review-v1'; generatedAt: string; reviewed: false
    dynamics: 'raw-rms-db-no-release-smoothing'
    sources: Record<string, ReviewReport['source']>
  }
}
function percentile(sorted: number[], amount: number) {
  return sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * amount))]
}
export function normalizationRange(report: ReviewReport) {
  const sounding = report.measurements.rmsDb.filter((value, i) => value > report.parameters.gateDb && gateAt(report.gates, i * report.measurements.hopSeconds)).sort((a, b) => a - b)
  if (!sounding.length) return { minDb: report.parameters.gateDb, maxDb: report.parameters.gateDb + 30 }
  const minDb = Math.max(report.parameters.gateDb, percentile(sounding, .01) - 3)
  // Leave headroom instead of clipping the loudest five percent to a flat ceiling.
  const maxDb = Math.max(minDb + 12, percentile(sounding, .999) + 3)
  return { minDb, maxDb }
}
function rawDbAt(report: ReviewReport, time: number) {
  const { rmsDb, hopSeconds } = report.measurements
  const position = time / hopSeconds, index = Math.floor(position)
  if (time < 0 || time >= report.measurements.duration || index >= rmsDb.length) return -120
  const current = rmsDb[index], next = rmsDb[Math.min(index + 1, rmsDb.length - 1)]
  return current + (next - current) * (position - index)
}
function dynamics(report: ReviewReport, count: number, interval: number, range: { minDb: number; maxDb: number }) {
  return Array.from({ length: count }, (_, i) => {
    const time = i * interval
    if (!gateAt(report.gates, time)) return 0
    const value = Math.max(0, Math.min(1, (rawDbAt(report, time) - range.minDb) / (range.maxDb - range.minDb)))
    return Math.round(value * 10000) / 10000
  })
}
export function buildRevisedProfile(options: {
  excerptId: string; instruments: Record<string, ReviewReport>; families: Record<string, ReviewReport>
  orchestra: ReviewReport; base: ActivityProfile
}): RevisedProfile {
  const { instruments, families, orchestra, base } = options
  const reports = { ...instruments, ...families, orchestra }
  const durations = Object.values(reports).map(report => report.measurements.duration)
  if (Math.max(...durations) - Math.min(...durations) > .08) throw new Error('Source durations differ by more than 80 ms; verify alignment before exporting')
  const duration = Math.max(...durations), sampleInterval = .01, count = Math.ceil(duration / sampleInterval)
  const ranges = Object.fromEntries(Object.entries(reports).map(([id, report]) => [id, normalizationRange(report)]))
  const sharedRange = {
    minDb: Math.min(...Object.keys(instruments).map(id => ranges[id].minDb)),
    maxDb: Math.max(...Object.keys(instruments).map(id => ranges[id].maxDb)),
  }
  const series = (items: Record<string, ReviewReport>, shared = false) => Object.fromEntries(Object.entries(items).map(([id, report]) => [id, dynamics(report, count, sampleInterval, shared ? sharedRange : ranges[id])]))
  const analysisByKey: Record<string, ActivityProfileAnalysis> = Object.fromEntries(Object.entries(reports).map(([id, report]) => [id, {
    activateThresholdDb: report.parameters.gateDb, deactivateThresholdDb: report.parameters.gateDb - 3,
    ...ranges[id], attackTime: 0, releaseTime: 0,
  }]))
  return {
    version: 2, excerptId: options.excerptId, duration, sampleInterval, analysisByKey,
    instruments: series(instruments), instrumentsShared: series(instruments, true), families: series(families),
    orchestra: dynamics(orchestra, count, sampleInterval, ranges.orchestra),
    gates: Object.fromEntries(Object.entries(instruments).map(([id, report]) => [id, [...report.gates]])),
    // Keep scheduler silence decisions independent from visual activity analysis.
    ...(base.chunks ? { chunks: structuredClone(base.chunks) } : {}),
    onsets: Object.fromEntries(Object.entries(reports).map(([id, report]) => [id,
      report.onsets.filter(onset => onset.status !== 'rejected').map(onset => ({ time: onset.time, strength: Math.min(1, onset.strength / 5) })),
    ])),
    profiling: {
      algorithm: 'atlas-spectral-review-v1', generatedAt: new Date().toISOString(), reviewed: false,
      dynamics: 'raw-rms-db-no-release-smoothing', sources: Object.fromEntries(Object.entries(reports).map(([id, report]) => [id, report.source])),
    },
  }
}
