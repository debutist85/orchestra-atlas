import { openSync, readSync, closeSync, statSync } from 'node:fs'

const PCM = 1
const IEEE_FLOAT = 3

function readChunkHeader(fd, offset) {
  const header = Buffer.alloc(8)
  if (readSync(fd, header, 0, 8, offset) !== 8) throw new Error('Unexpected end of WAV header')
  return { id: header.toString('ascii', 0, 4), size: header.readUInt32LE(4), offset }
}

export function openWav(path) {
  const fd = openSync(path, 'r')
  try {
    const riff = Buffer.alloc(12)
    if (readSync(fd, riff, 0, 12, 0) !== 12) throw new Error(`${path}: not a WAV file`)
    if (riff.toString('ascii', 0, 4) !== 'RIFF' || riff.toString('ascii', 8, 12) !== 'WAVE') {
      throw new Error(`${path}: not a RIFF/WAVE file`)
    }
    let offset = 12
    const end = statSync(path).size
    let format
    let dataOffset = 0
    let dataSize = 0
    while (offset + 8 <= end) {
      const chunk = readChunkHeader(fd, offset)
      const payload = offset + 8
      if (chunk.id === 'fmt ') {
        const fmt = Buffer.alloc(chunk.size)
        readSync(fd, fmt, 0, chunk.size, payload)
        const audioFormat = fmt.readUInt16LE(0)
        format = {
          audioFormat: audioFormat === 0xFFFE ? fmt.readUInt16LE(24) : audioFormat,
          channels: fmt.readUInt16LE(2),
          sampleRate: fmt.readUInt32LE(4),
          byteRate: fmt.readUInt32LE(8),
          blockAlign: fmt.readUInt16LE(12),
          bitsPerSample: fmt.readUInt16LE(14),
        }
      } else if (chunk.id === 'data') {
        dataOffset = payload
        dataSize = chunk.size
        break
      }
      offset = payload + chunk.size + (chunk.size % 2)
    }
    if (!format || !dataOffset) throw new Error(`${path}: missing fmt or data chunk`)
    if (format.audioFormat !== PCM && format.audioFormat !== IEEE_FLOAT) {
      throw new Error(`${path}: unsupported WAV format ${format.audioFormat}`)
    }
    if (!format.channels || !format.sampleRate || !format.blockAlign) {
      throw new Error(`${path}: invalid WAV format`)
    }
    return { path, ...format, dataOffset, dataSize, frameCount: Math.floor(dataSize / format.blockAlign) }
  } finally {
    closeSync(fd)
  }
}

function sampleAt(buffer, index, bitsPerSample, audioFormat) {
  if (audioFormat === IEEE_FLOAT) {
    if (bitsPerSample === 32) return buffer.readFloatLE(index * 4)
    if (bitsPerSample === 64) return buffer.readDoubleLE(index * 8)
  }
  if (bitsPerSample === 16) return buffer.readInt16LE(index * 2) / 32768
  if (bitsPerSample === 24) {
    const offset = index * 3
    const value = buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16)
    return ((value & 0x800000) ? value | 0xff000000 : value) / 8388608
  }
  if (bitsPerSample === 32 && audioFormat === PCM) return buffer.readInt32LE(index * 4) / 2147483648
  throw new Error(`Unsupported sample format ${audioFormat}/${bitsPerSample}`)
}

export function rmsWindowsFromWav(path, sampleInterval) {
  const wav = openWav(path)
  const framesPerWindow = Math.max(1, Math.round(wav.sampleRate * sampleInterval))
  const bytesPerWindow = framesPerWindow * wav.blockAlign
  const fd = openSync(path, 'r')
  const windows = []
  try {
    const buffer = Buffer.alloc(bytesPerWindow)
    let offset = wav.dataOffset
    const end = wav.dataOffset + wav.dataSize
    while (offset < end) {
      const bytes = Math.min(bytesPerWindow, end - offset)
      const read = readSync(fd, buffer, 0, bytes, offset)
      if (read <= 0) break
      const sampleCount = Math.floor(read / (wav.bitsPerSample / 8))
      let sumSquares = 0
      for (let index = 0; index < sampleCount; index++) {
        const value = sampleAt(buffer, index, wav.bitsPerSample, wav.audioFormat)
        sumSquares += value * value
      }
      windows.push(sampleCount ? Math.sqrt(sumSquares / sampleCount) : 0)
      offset += read
    }
  } finally {
    closeSync(fd)
  }
  return {
    path,
    windows,
    duration: wav.frameCount / wav.sampleRate,
    sampleRate: wav.sampleRate,
    channels: wav.channels,
  }
}
