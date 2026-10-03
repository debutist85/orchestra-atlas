import type { OrchestraInstrument } from '../orchestra-map/config'
import type { FamilyId } from '../orchestra-map/utils/navigation'
import { mediaUrl } from '../../lib/media-url'

export type ExcerptDefinition = {
  id: string
  title: string
  stemDirectory: string
  opusDirectory?: string
  chunkDirectory?: string
  fullOrchestraFile?: string
  activityUrl: string
  activityOutput: string
  stems: Partial<Record<OrchestraInstrument, readonly string[]>>
  familyStems?: Partial<Record<FamilyId, string>>
}

export function publicAssetUrl(directory: string, fileName: string) {
  return mediaUrl(`${directory}/${fileName}`)
}

export function webStemFileName(masterName: string) {
  return masterName.replace(/\.wav$/i, '.opus')
}

export function playbackDirectory(excerpt: ExcerptDefinition) {
  return excerpt.opusDirectory ?? excerpt.stemDirectory
}

export function fullOrchestraFileName(excerpt: ExcerptDefinition) {
  return webStemFileName(excerpt.fullOrchestraFile ?? 'full-orchestra.wav')
}

export function fullOrchestraUrl(excerpt: ExcerptDefinition) {
  return publicAssetUrl(playbackDirectory(excerpt), fullOrchestraFileName(excerpt))
}

export function leafStemId(fileName: string) {
  return fileName.replace(/\.wav$/i, '')
}

// File names follow the stems on disk; do not infer rights.
export const excerptCatalog: Record<string, ExcerptDefinition> = {
  'beethoven-7th-2nd': {
    id: 'beethoven-7th-2nd',
    title: 'Beethoven 7 II',
    stemDirectory: 'public/audio/beethoven-7th-2nd/stems/raw',
    opusDirectory: 'public/audio/beethoven-7th-2nd/stems/opus',
    chunkDirectory: 'public/audio/beethoven-7th-2nd/stems/chunks',
    fullOrchestraFile: 'full_orchestra.wav',
    activityUrl: 'audio/beethoven-7th-2nd/activity/beethoven-7th-2nd.json',
    activityOutput: 'public/audio/beethoven-7th-2nd/activity/beethoven-7th-2nd.json',
    stems: {
      flute: ['flute.wav'],
      oboe: ['oboe.wav'],
      clarinet: ['clarinet.wav'],
      bassoon: ['bassoon.wav'],
      horn: ['horn.wav'],
      trumpet: ['trumpet.wav'],
      violin: ['violin.wav'],
      viola: ['viola.wav'],
      cello: ['cello.wav'],
      doubleBass: ['contrabass.wav'],
      timpani: ['timpani.wav'],
    },
    familyStems: {
      strings: 'strings.wav',
      woodwinds: 'woodwinds.wav',
      brass: 'brass.wav',
      percussion: 'timpani.wav',
    },
  },
}

export const currentExcerptId = 'beethoven-7th-2nd'
export const currentExcerpt = excerptCatalog[currentExcerptId]

export function excerptById(id: string): ExcerptDefinition | undefined {
  return excerptCatalog[id]
}
