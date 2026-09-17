import type { OrchestraInstrument } from '../orchestra-map/config'
import { instrumentCatalog } from '../../store/catalog'

export type StemAsset = {
  instrument: OrchestraInstrument
  urls: readonly string[]
}

// Current excerpt folder only. File names follow the stems on disk; do not infer rights.
export const excerptDirectory = 'beethoven-7th-2nd'

const stemFiles: Partial<Record<OrchestraInstrument, readonly string[]>> = {
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
}

export function stemUrlsFor(instrument: OrchestraInstrument) {
  return (stemFiles[instrument] ?? []).map(name => `/audio/${excerptDirectory}/${name}`)
}

export function stemUrlFor(instrument: OrchestraInstrument) {
  return stemUrlsFor(instrument)[0]
}

export const excerptStems: readonly StemAsset[] = instrumentCatalog.flatMap(group => {
  const urls = stemUrlsFor(group.instrument)
  return urls.length ? [{ instrument: group.instrument, urls }] : []
})
