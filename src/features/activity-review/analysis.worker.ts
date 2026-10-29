import { detectEvents, makeReport, measureAudio, type AnalysisParameters, type AudioMeasurements, type ReviewReport } from './analysis'
type Job = { parameters: AnalysisParameters } & (
  { measurements: AudioMeasurements } | { channels: Float32Array[]; sampleRate: number; source: ReviewReport['source'] }
)
self.onmessage = (event: MessageEvent<Job>) => {
  try {
    const job = event.data
    if ('measurements' in job) {
      self.postMessage({ events: detectEvents(job.measurements, job.parameters) })
    } else {
      const measurements = measureAudio(job.channels, job.sampleRate, job.parameters, fraction => self.postMessage({ progress: fraction }))
      self.postMessage({ report: makeReport(measurements, job.source, job.parameters) })
    }
  } catch (error) { self.postMessage({ error: error instanceof Error ? error.message : String(error) }) }
}
