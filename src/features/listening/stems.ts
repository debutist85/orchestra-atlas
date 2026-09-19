import type { OrchestraInstrument } from '../orchestra-map/config'
import { instrumentCatalog } from '../../store/catalog'
import { currentExcerpt, playbackDirectory, publicAssetUrl, webStemFileName } from './excerpt'

export type StemAsset = {
  instrument: OrchestraInstrument
  urls: readonly string[]
}

export const excerptDirectory = currentExcerpt.id

export function stemUrlsFor(instrument: OrchestraInstrument) {
  const directory = playbackDirectory(currentExcerpt)
  return (currentExcerpt.stems[instrument] ?? []).map(name => publicAssetUrl(directory, webStemFileName(name)))
}

export function stemUrlFor(instrument: OrchestraInstrument) {
  return stemUrlsFor(instrument)[0]
}

export const excerptStems: readonly StemAsset[] = instrumentCatalog.flatMap(group => {
  const urls = stemUrlsFor(group.instrument)
  return urls.length ? [{ instrument: group.instrument, urls }] : []
})
