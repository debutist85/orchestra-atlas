import { validateParameters, type ReviewReport } from './analysis.ts'

// Imported reports cannot enable playback until their source hash matches decoded audio.
export function parseReviewReport(value: unknown): ReviewReport {
  const report = value as ReviewReport
  if (!report || report.version !== 1 || report.algorithm !== 'atlas-spectral-review-v1') throw new Error('Unsupported review report')
  if (!report.source || !/^[a-f0-9]{64}$/.test(report.source.sha256) || typeof report.source.name !== 'string' || typeof report.source.track !== 'string' || !['master', 'derived', 'unknown'].includes(report.source.kind)) throw new Error('Invalid source metadata')
  validateParameters(report.parameters)
  const m = report.measurements
  if (!m || !(m.duration > 0) || !Number.isFinite(m.duration) || !(m.sampleRate >= 1000) || !(m.hopSeconds > 0) || !Number.isInteger(m.frameSize) || !Number.isInteger(m.channels) || m.channels < 1) throw new Error('Invalid measurement timing')
  const length = m.rmsDb?.length
  if (!length || length > 10_000_000) throw new Error('Invalid measurement count')
  for (const series of [m.rmsDb, m.peakDb, m.waveformMin, m.waveformMax, m.flux]) {
    if (!Array.isArray(series) || series.length !== length || !series.every(Number.isFinite)) throw new Error('Invalid measurement series')
  }
  const spect = m.spectrogram
  if (!spect || !Number.isInteger(spect.bands) || spect.bands < 1 || spect.bands > 512 || !Number.isInteger(spect.stride) || spect.stride < 1 || !Array.isArray(spect.values) || spect.values.length !== Math.ceil(length / spect.stride) * spect.bands || !spect.values.every(value => Number.isInteger(value) && value >= 0 && value <= 255)) throw new Error('Invalid spectrogram')
  if (!Array.isArray(report.gates) || report.gates.length % 2 || report.gates.some((time, i) => !Number.isFinite(time) || time < 0 || time > m.duration || (i > 0 && time < report.gates[i - 1]))) throw new Error('Invalid sounding spans')
  const ids = new Set<string>()
  if (!Array.isArray(report.onsets) || report.onsets.some(onset => {
    if (typeof onset.id !== 'string' || ids.has(onset.id)) return true
    ids.add(onset.id)
    return !Number.isFinite(onset.time) || onset.time < 0 || onset.time > m.duration || !Number.isFinite(onset.strength) || !['unreviewed', 'accepted', 'rejected', 'manual'].includes(onset.status)
  }) || typeof report.notes !== 'string') throw new Error('Invalid review annotations')
  return report
}
