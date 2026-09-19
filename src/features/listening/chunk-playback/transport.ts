export type ChunkManifest = {
  version: number
  excerptId: string
  chunkDuration: number
  duration: number
  sampleRate: number
  frameCount: number
  framesPerChunk: number
  chunkCount: number
  format: string
  bitrate: number
  stemPath: string
  stems: readonly string[]
}

export function clampLogicalTime(time: number, duration: number) {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return 0
  return Math.min(duration, Math.max(0, time))
}

export function chunkIndexAt(time: number, manifest: ChunkManifest) {
  const t = clampLogicalTime(time, manifest.duration)
  if (!(manifest.chunkCount > 0) || !(manifest.chunkDuration > 0)) return 0
  if (t >= manifest.duration) return manifest.chunkCount - 1
  return Math.min(manifest.chunkCount - 1, Math.floor(t / manifest.chunkDuration))
}

export function chunkStartTime(index: number, manifest: ChunkManifest) {
  return Math.max(0, index) * manifest.chunkDuration
}

export function chunkLogicalDuration(index: number, manifest: ChunkManifest) {
  const start = chunkStartTime(index, manifest)
  return Math.max(0, Math.min(manifest.chunkDuration, manifest.duration - start))
}

export function chunkOffsetAt(time: number, manifest: ChunkManifest) {
  const index = chunkIndexAt(time, manifest)
  return clampLogicalTime(time, manifest.duration) - chunkStartTime(index, manifest)
}

export function contextTimeForLogical(logicalTime: number, origin: number) {
  return logicalTime - origin
}

export function originFromStart(logicalTime: number, contextTime: number) {
  return logicalTime - contextTime
}

export function logicalFromOrigin(contextTime: number, origin: number, duration: number) {
  return clampLogicalTime(origin + contextTime, duration)
}

export function preloadWindow(index: number, chunkCount: number) {
  const start = Math.max(0, index - 1)
  const end = Math.min(chunkCount - 1, index + 2)
  const indices = []
  for (let value = start; value <= end; value += 1) indices.push(value)
  return indices
}

export function createGeneration() {
  let value = 0
  return {
    current: () => value,
    next() {
      value += 1
      return value
    },
    isCurrent(token: number) {
      return token === value
    },
  }
}
