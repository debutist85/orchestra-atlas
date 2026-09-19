import type { OrchestraInstrument } from '../orchestra-map/config'

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
}

export function publicAssetUrl(directory: string, fileName: string) {
  const trimmed = directory.replace(/^public\/?/, '').replace(/\/+$/, '')
  return `/${trimmed}/${fileName}`
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
    stemDirectory: 'public/audio/beethoven-7th-2nd/raw',
    opusDirectory: 'public/audio/beethoven-7th-2nd/opus',
    chunkDirectory: 'public/audio/beethoven-7th-2nd/chunks',
    fullOrchestraFile: 'full-orchestra.wav',
    activityUrl: '/activity/beethoven-7th-2nd.json',
    activityOutput: 'public/activity/beethoven-7th-2nd.json',
    stems: {
      flute: ['flute-1.wav', 'flute-2.wav'],
      oboe: ['oboe-1.wav', 'oboe-2.wav'],
      clarinet: ['clarinet-1.wav', 'clarinet-2.wav'],
      bassoon: ['bassoon-1.wav', 'bassoon-2.wav'],
      horn: ['horn-1.wav', 'horn-2.wav'],
      trumpet: ['trumpet-1.wav', 'trumpet-2.wav'],
      violin: ['violin-1.wav', 'violin-2.wav'],
      viola: ['viola.wav'],
      cello: ['cello-1.wav', 'cello-2.wav'],
      doubleBass: ['contrabass.wav'],
      timpani: ['timpani.wav'],
    },
  },
}

export const currentExcerptId = 'beethoven-7th-2nd'
export const currentExcerpt = excerptCatalog[currentExcerptId]

export function excerptById(id: string): ExcerptDefinition | undefined {
  return excerptCatalog[id]
}
