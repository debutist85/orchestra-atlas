import { publicAssetUrl, type ExcerptDefinition } from '../excerpt'
import type { ChunkManifest } from './transport'

export function parseChunkManifest(value: unknown): ChunkManifest {
  const data = value as ChunkManifest
  if (!data || data.version !== 1) throw new Error('Chunk manifest version must be 1')
  if (!(data.chunkDuration > 0) || !(data.duration > 0) || !(data.chunkCount > 0)) {
    throw new Error('Chunk manifest is missing duration metadata')
  }
  if (!Array.isArray(data.stems) || !data.stems.length) throw new Error('Chunk manifest has no stems')
  return data
}

export async function fetchChunkManifest(excerpt: ExcerptDefinition): Promise<ChunkManifest> {
  if (!excerpt.chunkDirectory) throw new Error(`Excerpt ${excerpt.id} has no chunkDirectory`)
  const url = publicAssetUrl(excerpt.chunkDirectory, 'manifest.json')
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Missing chunk manifest ${url}`)
  return parseChunkManifest(await response.json())
}

export function chunkFileName(index: number) {
  return `${String(index).padStart(3, '0')}.m4a`
}

export function chunkUrl(excerpt: ExcerptDefinition, stemId: string, index: number) {
  if (!excerpt.chunkDirectory) throw new Error(`Excerpt ${excerpt.id} has no chunkDirectory`)
  return publicAssetUrl(`${excerpt.chunkDirectory}/${stemId}`, chunkFileName(index))
}

export function bufferBytes(buffer: AudioBuffer) {
  return buffer.length * buffer.numberOfChannels * 4
}
