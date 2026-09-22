import type { OrchestraInstrument } from '../orchestra-map/config'
import type { NavigationState } from '../orchestra-map/utils/navigation'
import { instrumentCatalog } from '../../store/catalog'

export type InstrumentExperience = {
  instrumentId: OrchestraInstrument
  name: string
  modelUrl?: string
}

const modelUrls: Partial<Record<OrchestraInstrument, string>> = {
  violin: `${import.meta.env.BASE_URL}3d/violin/violin-web-anchors.glb`,
}

const experiences = new Map<OrchestraInstrument, InstrumentExperience>(instrumentCatalog.map(instrument => [
  instrument.instrument,
  {
    instrumentId: instrument.instrument,
    name: instrument.name,
    modelUrl: modelUrls[instrument.instrument],
  },
]))

export const violinExperience = experiences.get('violin')!

export function instrumentExperience(navigation: NavigationState) {
  return navigation.level === 'instrument' ? experiences.get(navigation.instrumentId) : undefined
}

export function canExplore(navigation: NavigationState) {
  return instrumentExperience(navigation) !== undefined
}
