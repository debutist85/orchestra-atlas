import type { OrchestraInstrument } from '../../orchestra-map/config'
import type { ModelAttribution } from './explorable-instruments'
import { mediaUrl } from '../../../lib/media-url'

// Follow the same CDN configuration as the rest of the media by default.
// An explicit override can select local exports; an empty string disables it.
const baseUrl = ((import.meta.env.VITE_INSTRUMENT_PACK_URL as string | undefined)
  ?? mediaUrl('3d')).replace(/\/+$/, '')

const packNames: Partial<Record<OrchestraInstrument, string>> = {
  // Flute deliberately keeps its previous model, pose, and attribution.
  clarinet: 'clarinet', horn: 'horn', oboe: 'oboe',
  doubleBass: 'double-bass', timpani: 'timpani', trombone: 'trombone',
  trumpet: 'trumpet', tuba: 'tuba', bassoon: 'bassoon', cello: 'cello',
}

export function instrumentPackModelUrl(instrumentId: OrchestraInstrument): string | undefined {
  const name = packNames[instrumentId]
  return baseUrl && name ? `${baseUrl}/${name}/${name}.glb` : undefined
}

// Share the researched public records with the viewer so credits cannot drift
// from the metadata shipped alongside these exact model assets.
const credits = import.meta.glob<ModelAttribution>('../../../../public/licenses/instrument-pack/*.json', {
  eager: true, import: 'default',
})

export function instrumentPackAttribution(instrumentId: OrchestraInstrument): ModelAttribution | undefined {
  const name = packNames[instrumentId]
  return name ? credits[`../../../../public/licenses/instrument-pack/${name}.json`] : undefined
}
