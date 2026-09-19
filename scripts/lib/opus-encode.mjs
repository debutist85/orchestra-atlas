export const DEFAULT_BITRATE = '96k'
export const HARMLESS_DURATION_DELTA_SECONDS = 0.08
export const SUSPICIOUS_DURATION_DELTA_SECONDS = 0.25

export function parseEncodeArgs(argv) {
  const options = {
    excerptId: undefined,
    force: false,
    bitrate: DEFAULT_BITRATE,
    file: undefined,
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
    if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}`)
    if (!options.excerptId) {
      options.excerptId = arg
      continue
    }
    throw new Error(`Unexpected argument: ${arg}`)
  }
  return options
}

export function assertBitrate(value) {
  if (typeof value !== 'string' || !/^\d+k$/i.test(value.trim())) {
    throw new Error(`Invalid bitrate "${value ?? ''}". Use a value like 96k or 128k.`)
  }
  const kbps = Number.parseInt(value, 10)
  if (!(kbps > 0 && kbps <= 512)) {
    throw new Error(`Invalid bitrate "${value}". Use a positive value up to 512k.`)
  }
  return `${kbps}k`
}

export function resolveOpusDirectory(stemDirectory, opusDirectory) {
  if (opusDirectory) return opusDirectory
  if (/(^|\/)raw$/.test(stemDirectory)) return stemDirectory.replace(/(^|\/)raw$/, '$1opus')
  return stemDirectory
}

export function isWavFileName(name) {
  return typeof name === 'string' && name.length > 0 && !name.startsWith('.') && /\.wav$/i.test(name)
}

export function opusFileName(wavName) {
  if (!isWavFileName(wavName)) throw new Error(`Not a WAV file name: ${wavName}`)
  return wavName.replace(/\.wav$/i, '.opus')
}

export function matchRequestedFile(files, requested) {
  if (!requested) return files
  const names = new Set(files)
  const candidates = [requested]
  if (!/\.wav$/i.test(requested)) candidates.push(`${requested}.wav`)
  const exact = candidates.find(name => names.has(name))
  if (exact) return [exact]
  const lower = new Set(candidates.map(name => name.toLowerCase()))
  const matched = files.filter(name => lower.has(name.toLowerCase()))
  if (matched.length === 1) return matched
  if (matched.length > 1) throw new Error(`--file "${requested}" matches more than one stem`)
  throw new Error(`--file "${requested}" did not match a WAV stem in the source directory`)
}

export function assertSafeEncodePaths(sourcePath, destPath) {
  if (sourcePath === destPath) {
    throw new Error('Source and destination paths are identical; refusing to overwrite a master WAV.')
  }
  if (sourcePath.toLowerCase() === destPath.toLowerCase()) {
    throw new Error('Source and destination differ only by case; refusing to overwrite a master WAV.')
  }
  if (/\.wav$/i.test(destPath)) {
    throw new Error(`Destination must be an Opus file, not a WAV: ${destPath}`)
  }
  if (!/\.opus$/i.test(destPath)) {
    throw new Error(`Destination must end with .opus: ${destPath}`)
  }
  return { sourcePath, destPath }
}

export function shouldSkipEncode({ sourceMtimeMs, destMtimeMs, force }) {
  if (force) return false
  return Number.isFinite(destMtimeMs) && Number.isFinite(sourceMtimeMs) && destMtimeMs > sourceMtimeMs
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return 'unknown'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2
  return `${value.toFixed(digits)} ${units[unit]}`
}

export function formatPercent(fraction) {
  if (!Number.isFinite(fraction)) return 'unknown'
  return `${(fraction * 100).toFixed(1)}%`
}

export function classifyDurationDelta(sourceSeconds, destSeconds) {
  const delta = Math.abs(Number(destSeconds) - Number(sourceSeconds))
  if (!Number.isFinite(delta)) return { kind: 'error', delta: Number.NaN }
  if (delta <= HARMLESS_DURATION_DELTA_SECONDS) return { kind: 'ok', delta }
  if (delta <= SUSPICIOUS_DURATION_DELTA_SECONDS) return { kind: 'warn', delta }
  return { kind: 'error', delta }
}

export function audioProbeFromFfprobe(json) {
  const format = json?.format ?? {}
  const stream = (json?.streams ?? []).find(item => item.codec_type === 'audio')
  if (!stream) throw new Error('no audio stream')
  const duration = Number(stream.duration ?? format.duration)
  const size = Number(format.size)
  const channels = Number(stream.channels)
  return {
    codec: stream.codec_name,
    channels,
    duration,
    size,
  }
}

export function validateOpusAgainstSource(source, dest) {
  const errors = []
  const notes = []
  if (!(dest.size > 0)) errors.push('output size is zero or missing')
  if (dest.codec !== 'opus') errors.push(`codec is ${dest.codec ?? 'unknown'}, expected opus`)
  if (!(dest.channels > 0)) errors.push('channel count is missing')
  else if (dest.channels !== source.channels) {
    errors.push(`channels ${dest.channels} vs source ${source.channels}`)
  }
  const duration = classifyDurationDelta(source.duration, dest.duration)
  const deltaMs = Number.isFinite(duration.delta) ? `${(duration.delta * 1000).toFixed(1)} ms` : 'unknown'
  if (duration.kind === 'ok') {
    notes.push(`duration delta ${deltaMs} (harmless codec/container difference)`)
  } else if (duration.kind === 'warn') {
    notes.push(`duration delta ${deltaMs} is larger than typical Opus pre-skip; stems were not trimmed or padded`)
  } else {
    errors.push(`duration delta ${deltaMs} is large enough to suggest a real synchronization problem; stems were not altered`)
  }
  return { errors, notes, duration }
}

export function temporaryOpusPath(destPath, pid = process.pid) {
  return `${destPath}.encoding.${pid}.opus`
}
