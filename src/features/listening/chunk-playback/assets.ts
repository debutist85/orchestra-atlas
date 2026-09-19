import { publicAssetUrl, type ExcerptDefinition } from '../excerpt'
import type { FamilyId } from '../../orchestra-map/utils/navigation'
import { familyInstrumentIds } from '../../../store/catalog'
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
  return `${String(index).padStart(3, '0')}.opus`
}

export function chunkUrl(excerpt: ExcerptDefinition, stemId: string, index: number) {
  if (!excerpt.chunkDirectory) throw new Error(`Excerpt ${excerpt.id} has no chunkDirectory`)
  return publicAssetUrl(`${excerpt.chunkDirectory}/${stemId}`, chunkFileName(index))
}

export function chunkStemIdsForFamily(excerpt: ExcerptDefinition, familyId: FamilyId, manifest: ChunkManifest) {
  const available = new Set(manifest.stems)
  return familyInstrumentIds(familyId).flatMap(instrument => excerpt.stems[instrument] ?? [])
    .map(name => name.replace(/\.wav$/i, ''))
    .filter(id => available.has(id))
}

export function familiesWithChunks(excerpt: ExcerptDefinition, manifest: ChunkManifest) {
  const families = ['strings', 'woodwinds', 'brass', 'percussion', 'other'] as const
  return families
    .map(id => ({ id, stems: chunkStemIdsForFamily(excerpt, id, manifest) }))
    .filter(family => family.stems.length)
}

export function defaultChunkFamily(excerpt: ExcerptDefinition, manifest: ChunkManifest) {
  const families = familiesWithChunks(excerpt, manifest)
  return families.find(family => family.id === 'strings') ?? families[0]
}

export function bufferBytes(buffer: AudioBuffer) {
  return buffer.length * buffer.numberOfChannels * 4
}
