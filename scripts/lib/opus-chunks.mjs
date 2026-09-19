import { DEFAULT_BITRATE, assertBitrate } from './opus-encode.mjs'

export const DEFAULT_CHUNK_DURATION = 15
export const FULL_ORCHESTRA_FILE = 'full-orchestra.wav'
export const CHUNK_INDEX_DIGITS = 3
const DURATION_MISMATCH_ERROR_SECONDS = 0.25

export function parseChunkArgs(argv) {
  const options = {
    excerptId: undefined,
    force: false,
    bitrate: DEFAULT_BITRATE,
    file: undefined,
    chunkDuration: DEFAULT_CHUNK_DURATION,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--help' || arg === '-h') {
      options.help = true
      continue
    }
    if (arg === '--force') {
      options.force = true
      continue
    }
    if (arg === '--bitrate' || arg.startsWith('--bitrate=')) {
      options.bitrate = arg === '--bitrate' ? argv[++index] : arg.slice('--bitrate='.length)
      continue
    }
    if (arg === '--file' || arg.startsWith('--file=')) {
      options.file = arg === '--file' ? argv[++index] : arg.slice('--file='.length)
      continue
    }
    if (arg === '--chunk-duration' || arg.startsWith('--chunk-duration=')) {
      const raw = arg === '--chunk-duration' ? argv[++index] : arg.slice('--chunk-duration='.length)
      options.chunkDuration = Number(raw)
      continue
    }
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    if (!options.excerptId) {
      options.excerptId = arg
      continue
    }
    throw new Error(`Unexpected argument: ${arg}`)
  }
  return options
}

export function assertChunkDuration(value) {
  if (!Number.isFinite(value) || value <= 0 || value > 600) {
    throw new Error(`Invalid chunk duration "${value}". Use a number of seconds, for example 15.`)
  }
  return value
}

export function stemIdFromWav(wavName) {
  return wavName.replace(/\.wav$/i, '')
}

export function isFullOrchestraFile(name, fullOrchestraFile = FULL_ORCHESTRA_FILE) {
  return name.toLowerCase() === fullOrchestraFile.toLowerCase()
}

export function resolveChunkDirectory(stemDirectory, chunkDirectory) {
  if (chunkDirectory) return chunkDirectory
  if (/(^|\/)raw$/.test(stemDirectory)) return stemDirectory.replace(/(^|\/)raw$/, '$1chunks')
  return `${stemDirectory.replace(/\/+$/, '')}/chunks`
}

export function chunkFileName(index, digits = CHUNK_INDEX_DIGITS) {
  if (!Number.isInteger(index) || index < 0) throw new Error(`Invalid chunk index: ${index}`)
  return `${String(index).padStart(digits, '0')}.opus`
}

export function bitrateKbps(bitrate) {
  return Number.parseInt(assertBitrate(bitrate), 10) * 1000
}

export function chunkPlan({ frameCount, sampleRate, chunkDuration = DEFAULT_CHUNK_DURATION }) {
  if (!(sampleRate > 0) || !Number.isInteger(sampleRate)) {
    throw new Error(`Invalid sample rate: ${sampleRate}`)
  }
  if (!(frameCount > 0) || !Number.isInteger(frameCount)) {
    throw new Error(`Invalid frame count: ${frameCount}`)
  }
  const duration = assertChunkDuration(chunkDuration)
  const framesPerChunk = Math.round(duration * sampleRate)
  if (!(framesPerChunk > 0)) throw new Error(`Chunk duration ${duration}s is shorter than one sample at ${sampleRate} Hz`)
  const chunks = []
  for (let startSample = 0, index = 0; startSample < frameCount; startSample += framesPerChunk, index += 1) {
    const endSample = Math.min(startSample + framesPerChunk, frameCount)
    chunks.push({
      index,
      name: chunkFileName(index),
      startSample,
      endSample,
      startSeconds: startSample / sampleRate,
      durationSeconds: (endSample - startSample) / sampleRate,
    })
  }
  return {
    sampleRate,
    frameCount,
    durationSeconds: frameCount / sampleRate,
    chunkDuration: duration,
    framesPerChunk,
    chunks,
  }
}

export function sharedTimeline(sources, { durationErrorSeconds = DURATION_MISMATCH_ERROR_SECONDS } = {}) {
  if (!sources.length) throw new Error('No chunkable WAV stems')
  const sampleRates = [...new Set(sources.map(item => item.sampleRate))]
  if (sampleRates.length !== 1) {
    throw new Error(`Stem sample rates differ (${sampleRates.join(', ')}); refusing to invent a shared timeline`)
  }
  const frameCounts = sources.map(item => item.frameCount)
  const minFrames = Math.min(...frameCounts)
  const maxFrames = Math.max(...frameCounts)
  const sampleRate = sampleRates[0]
  const spanSeconds = (maxFrames - minFrames) / sampleRate
  const warnings = []
  if (maxFrames !== minFrames) {
    const message = `stem lengths differ by ${maxFrames - minFrames} samples (${(spanSeconds * 1000).toFixed(1)} ms)`
    if (spanSeconds >= durationErrorSeconds) {
      throw new Error(`${message}; stems do not share one synchronized timeline`)
    }
    warnings.push(`${message}; using the shortest stem so every part gets the same chunk boundaries`)
  }
  return { sampleRate, frameCount: minFrames, warnings }
}

export function chunkManifest({ excerptId, plan, bitrate, stems }) {
  return {
    version: 1,
    excerptId,
    chunkDuration: plan.chunkDuration,
    duration: plan.durationSeconds,
    sampleRate: plan.sampleRate,
    frameCount: plan.frameCount,
    framesPerChunk: plan.framesPerChunk,
    chunkCount: plan.chunks.length,
    format: 'opus',
    bitrate: bitrateKbps(bitrate),
    stemPath: '{stemId}/{index}.opus',
    stems: [...stems],
  }
}

export function expectedChunkNames(plan) {
  return plan.chunks.map(chunk => chunk.name)
}
