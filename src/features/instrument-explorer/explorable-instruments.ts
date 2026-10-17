import { orchestraSceneConfig, type OrchestraInstrument } from '../orchestra-map/config'
import { familyName, type NavigationState } from '../orchestra-map/utils/navigation'
import { instrumentCatalog } from '../../store/catalog'
import { mediaUrl } from '../../lib/media-url'

export type InstrumentExperience = {
  instrumentId: OrchestraInstrument
  name: string
  familyName: string
  description?: string
  modelUrl?: string
}

const modelUrls: Partial<Record<OrchestraInstrument, string>> = {
  violin: mediaUrl('3d/violin/violin-web-anchors.glb'),
  // No timpani model yet. The violin GLB stands in so its anchors can host
  // timpani technique tests.
  timpani: mediaUrl('3d/violin/violin-web-anchors.glb'),
}

// One or two sentences of general, uncontroversial orientation for the
// full-instrument view. Pending musical review like the rest of the
// explorer's copy.
const descriptions: Partial<Record<OrchestraInstrument, string>> = {
  violin: 'The highest voice of the string family. Its four strings, bowed or plucked, carry many of the orchestra’s melodies, and the violins form its largest section.',
}

const experiences = new Map<OrchestraInstrument, InstrumentExperience>(instrumentCatalog.map(instrument => [
  instrument.instrument,
  {
    instrumentId: instrument.instrument,
    name: instrument.name,
    familyName: familyName(orchestraSceneConfig, instrument.familyId),
    description: descriptions[instrument.instrument],
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
