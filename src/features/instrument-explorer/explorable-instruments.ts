import type { OrchestraInstrument } from '../orchestra-map/config'
import type { NavigationState } from '../orchestra-map/utils/navigation'
import { instrumentCatalog } from '../../store/catalog'
import { mediaUrl } from '../../lib/media-url'

export type InstrumentExperience = {
  instrumentId: OrchestraInstrument
  name: string
  modelUrl?: string
  placeholderModel?: boolean
}

const violinModelUrl = mediaUrl('3d/violin/violin-web-anchors.glb')

const experiences = new Map<OrchestraInstrument, InstrumentExperience>(instrumentCatalog.map(instrument => [
  instrument.instrument,
  {
    instrumentId: instrument.instrument,
    name: instrument.name,
    modelUrl: violinModelUrl,
    placeholderModel: instrument.instrument !== 'violin',
  },
]))

export const violinExperience = experiences.get('violin')!

export function instrumentExperience(navigation: NavigationState) {
  return navigation.level === 'instrument' ? experiences.get(navigation.instrumentId) : undefined
}

export function canExplore(navigation: NavigationState) {
  return instrumentExperience(navigation) !== undefined
}
