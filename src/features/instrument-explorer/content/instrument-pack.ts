import type { OrchestraInstrument } from '../../orchestra-map/config'
import type { ModelAttribution } from './explorable-instruments'

// An explicit base URL keeps this unreviewed pack opt-in and independent of
// VITE_MEDIA_URL: it can point to either the local exports or the R2 /3d path.
const baseUrl = (import.meta.env.VITE_INSTRUMENT_PACK_URL as string | undefined)?.replace(/\/+$/, '')

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
