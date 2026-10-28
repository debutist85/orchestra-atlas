export const analysisDefaults = {
  hopMs: 10, windowMs: 40, gateDb: -65, gateGapMs: 40, gateMinMs: 20,
  onsetSensitivity: 3, onsetMinGapMs: 80, onsetFloorDb: -65,
}
export type AnalysisParameters = typeof analysisDefaults
export type OnsetCandidate = { id: string; time: number; strength: number; status: 'unreviewed' | 'accepted' | 'rejected' | 'manual' }
export type AudioMeasurements = {
  duration: number; sampleRate: number; channels: number; frameSize: number; hopSize: number
  hopSeconds: number; timestamp: 'window-center'; rmsDb: number[]; peakDb: number[]
  waveformMin: number[]; waveformMax: number[]; flux: number[]
  spectrogram: { bands: number; stride: number; minHz: number; maxHz: number; values: number[] }
}
export type ReviewReport = {
  version: 1; algorithm: 'atlas-spectral-review-v1'; createdAt: string
  source: { name: string; sha256: string; bytes: number; kind: 'master' | 'derived' | 'unknown'; track: string }
  parameters: AnalysisParameters; measurements: AudioMeasurements; gates: number[]
  onsets: OnsetCandidate[]; notes: string
}
const db = (power: number) => Math.max(-120, 10 * Math.log10(Math.max(power, 1e-12)))
const round = (value: number) => (Math.round(value * 10000) / 10000) || 0
const median = (values: number[]) => { values.sort((a, b) => a - b); return values[Math.floor(values.length / 2)] ?? 0 }

// In-place radix-2 FFT. Analysis only; never shipped into the production player.
function fft(real: Float64Array, imaginary: Float64Array) {
  const n = real.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { [real[i], real[j]] = [real[j], real[i]]; [imaginary[i], imaginary[j]] = [imaginary[j], imaginary[i]] }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const angle = -2 * Math.PI / size, wr = Math.cos(angle), wi = Math.sin(angle)
    for (let offset = 0; offset < n; offset += size) {
      let ur = 1, ui = 0
      for (let j = 0; j < size / 2; j++) {
        const a = offset + j, b = a + size / 2
        const tr = ur * real[b] - ui * imaginary[b], ti = ur * imaginary[b] + ui * real[b]
        real[b] = real[a] - tr; imaginary[b] = imaginary[a] - ti
        real[a] += tr; imaginary[a] += ti
        const next = ur * wr - ui * wi
        ui = ur * wi + ui * wr; ur = next
      }
    }
  }
}

export function validateParameters(parameters: AnalysisParameters) {
  const ranges: Record<keyof AnalysisParameters, [number, number]> = {
    hopMs: [2, 50], windowMs: [10, 100], gateDb: [-100, -20], gateGapMs: [0, 300],
    gateMinMs: [0, 200], onsetSensitivity: [.5, 10], onsetMinGapMs: [20, 500], onsetFloorDb: [-100, -20],
  }
  for (const key of Object.keys(ranges) as (keyof AnalysisParameters)[]) {
    const value = parameters[key], [min, max] = ranges[key]
    if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${key}: expected ${min}…${max}`)
  }
  if (parameters.hopMs > parameters.windowMs) throw new Error('Hop must not exceed the analysis window')
}

export function measureAudio(channels: Float32Array[], sampleRate: number, parameters = analysisDefaults, progress?: (fraction: number) => void): AudioMeasurements {
  validateParameters(parameters)
  if (!channels.length || !channels[0].length || !Number.isFinite(sampleRate) || sampleRate < 1000) throw new Error('Empty or invalid PCM audio')
  const length = channels[0].length
  if (channels.some(channel => channel.length !== length)) throw new Error('Audio channels must have equal lengths')
  const frameSize = 2 ** Math.round(Math.log2(sampleRate * parameters.windowMs / 1000))
  const hopSize = Math.max(1, Math.round(sampleRate * parameters.hopMs / 1000))
  const window = Float64Array.from({ length: frameSize }, (_, i) => .5 - .5 * Math.cos(2 * Math.PI * i / (frameSize - 1)))
  const windowSum = window.reduce((sum, value) => sum + value, 0)
  const real = new Float64Array(frameSize), imaginary = new Float64Array(frameSize)
  const bins = frameSize / 2 + 1, power = new Float64Array(bins), previous = new Float64Array(bins)
  const bands = 48, stride = 4, minHz = 30, maxHz = sampleRate / 2
  const bandBins = Array.from({ length: bands }, (_, band) => {
    const from = Math.max(1, Math.floor(minHz * (maxHz / minHz) ** (band / bands) * frameSize / sampleRate))
    const to = Math.min(bins, Math.max(from + 1, Math.ceil(minHz * (maxHz / minHz) ** ((band + 1) / bands) * frameSize / sampleRate)))
    return [from, to]
  })
  const result: AudioMeasurements = {
    duration: length / sampleRate, sampleRate, channels: channels.length, frameSize, hopSize,
    hopSeconds: hopSize / sampleRate, timestamp: 'window-center', rmsDb: [], peakDb: [], waveformMin: [], waveformMax: [], flux: [],
    spectrogram: { bands, stride, minHz, maxHz, values: [] },
  }
  const frames = Math.ceil(length / hopSize)
  for (let frame = 0; frame < frames; frame++) {
    const center = frame * hopSize, start = center - frameSize / 2
    let sum = 0, peak = 0, low = 0, high = 0, valid = 0
    power.fill(0)
    for (const channel of channels) {
      imaginary.fill(0)
      for (let j = 0; j < frameSize; j++) {
        const index = start + j
        const value = index >= 0 && index < length ? channel[index] : 0
        if (!Number.isFinite(value)) throw new Error('Audio contains non-finite PCM samples')
        real[j] = value * window[j]
        if (index >= 0 && index < length) { sum += value * value; valid++; peak = Math.max(peak, Math.abs(value)); low = Math.min(low, value); high = Math.max(high, value) }
      }
      fft(real, imaginary)
      // Combine channel powers, never mix waveforms: opposite stereo phases cannot cancel activity.
      for (let bin = 0; bin < bins; bin++) power[bin] += (real[bin] ** 2 + imaginary[bin] ** 2) / (windowSum ** 2 * channels.length)
    }
    result.rmsDb.push(round(db(sum / Math.max(1, valid))))
    result.peakDb.push(round(db(peak * peak)))
    result.waveformMin.push(round(low)); result.waveformMax.push(round(high))
    let flux = 0
    for (let bin = 1; bin < bins; bin++) {
      const magnitude = Math.log1p(Math.sqrt(power[bin]) * 1000)
      const reference = Math.max(previous[bin - 1], previous[bin], previous[Math.min(bin + 1, bins - 1)])
      flux += Math.max(0, magnitude - reference)
      real[bin] = magnitude
    }
    for (let bin = 1; bin < bins; bin++) previous[bin] = real[bin]
    result.flux.push(round(flux / (bins - 1)))
    if (frame % stride === 0) {
      for (const [from, to] of bandBins) {
        let energy = 0
        for (let bin = from; bin < to; bin++) energy += power[bin]
        const level = db(energy / Math.max(1, to - from))
        result.spectrogram.values.push(Math.round(Math.max(0, Math.min(255, (level + 100) / 100 * 255))))
      }
    }
    if (frame % 200 === 0) progress?.(frame / frames)
  }
  progress?.(1)
  return result
}

export function detectEvents(measurements: AudioMeasurements, parameters: AnalysisParameters) {
  validateParameters(parameters)
  const { rmsDb, flux, hopSeconds: hop, duration } = measurements
  const spans: [number, number][] = []
  let start = -1
  for (let i = 0; i <= rmsDb.length; i++) {
    const sounding = i < rmsDb.length && rmsDb[i] >= parameters.gateDb - (start >= 0 ? 3 : 0)
    if (sounding && start < 0) start = i
    if (!sounding && start >= 0) {
      const from = Math.max(0, start * hop), to = Math.min(duration, i * hop)
      const prior = spans.at(-1)
      if (prior && from - prior[1] <= parameters.gateGapMs / 1000) prior[1] = to
      else spans.push([from, to])
      start = -1
    }
  }
  const gates = spans.filter(([a, b]) => b - a >= parameters.gateMinMs / 1000).flatMap(span => span.map(round))
  const neighborhood = Math.max(2, Math.round(.25 / hop)), peakRadius = Math.max(1, Math.round(.025 / hop))
  const onsets: OnsetCandidate[] = []
  for (let i = 1; i < flux.length - 1; i++) {
    if (rmsDb[i] < parameters.onsetFloorDb || flux[i] < .001) continue
    // Spectral spreading at a note release is not an attack. Keep constant-energy
    // pitch changes, but reject candidates already falling in short-window energy.
    const priorEnergy = rmsDb[Math.max(0, i - Math.max(1, Math.round(.025 / hop)))]
    if (rmsDb[i] < priorEnergy - .25) continue
    const local = flux.slice(Math.max(0, i - neighborhood), Math.min(flux.length, i + neighborhood + 1))
    const baseline = median([...local]), deviation = median(local.map(value => Math.abs(value - baseline)))
    const threshold = baseline + parameters.onsetSensitivity * Math.max(.001, deviation)
    if (flux[i] <= threshold) continue
    let peak = true
    for (let j = Math.max(0, i - peakRadius); j <= Math.min(flux.length - 1, i + peakRadius); j++) {
      if (flux[j] > flux[i] || (flux[j] === flux[i] && j < i)) { peak = false; break }
    }
    if (!peak) continue
    const time = round(i * hop), strength = round(flux[i] / Math.max(threshold, .001))
    const prior = onsets.at(-1)
    if (prior && time - prior.time < parameters.onsetMinGapMs / 1000) {
      if (strength > prior.strength) { prior.time = time; prior.strength = strength; prior.id = `auto-${i}` }
    } else onsets.push({ id: `auto-${i}`, time, strength, status: 'unreviewed' })
  }
  return { gates, onsets }
}

export function makeReport(measurements: AudioMeasurements, source: ReviewReport['source'], parameters = analysisDefaults): ReviewReport {
  return { version: 1, algorithm: 'atlas-spectral-review-v1', createdAt: new Date().toISOString(), source, parameters: { ...parameters }, measurements, ...detectEvents(measurements, parameters), notes: '' }
}
