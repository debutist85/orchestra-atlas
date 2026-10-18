import { orchestraSceneConfig, type OrchestraInstrument } from '../../orchestra-map/config'
import { familyName, type NavigationState } from '../../orchestra-map/utils/navigation'
import { instrumentCatalog } from '../../../store/catalog'
import { mediaUrl } from '../../../lib/media-url'

export type InstrumentExperience = {
  instrumentId: OrchestraInstrument
  name: string
  familyName: string
  description?: string
  modelUrl?: string
  // Turns the model from its authored pose to face the camera (radians,
  // Euler XYZ), applied once at load before it is centered.
  modelRotation: readonly [number, number, number]
}

const modelUrls: Partial<Record<OrchestraInstrument, string>> = {
  violin: mediaUrl('3d/violin/violin-web-anchors.glb'),
  horn: mediaUrl('3d/horn/horn.glb'),
  // No timpani model yet. The violin GLB stands in so its anchors can host
  // timpani technique tests.
  timpani: mediaUrl('3d/violin/violin-web-anchors.glb'),
}

// Only for a model not authored facing the camera. The violin GLB lies on its
// side, so its front plane is turned square to the camera without adding a
// perspective turn around Y or Z; the horn is authored upright.
const violinRotation = [Math.PI / 2, 0, 0] as const
const modelRotations: Partial<Record<OrchestraInstrument, readonly [number, number, number]>> = {
  violin: violinRotation,
  timpani: violinRotation,
}
const noRotation = [0, 0, 0] as const

// General orientation for the
// full-instrument view. Pending musical review like the rest of the
// explorer's copy.
const descriptions: Partial<Record<OrchestraInstrument, string>> = {
  violin: 'The smallest and highest-pitched member of the orchestral string family. Known for its expressive, singing tone.',
}

const experiences = new Map<OrchestraInstrument, InstrumentExperience>(instrumentCatalog.map(instrument => [
  instrument.instrument,
  {
    instrumentId: instrument.instrument,
    name: instrument.name,
    familyName: familyName(orchestraSceneConfig, instrument.familyId),
    description: descriptions[instrument.instrument],
    modelUrl: modelUrls[instrument.instrument],
    modelRotation: modelRotations[instrument.instrument] ?? noRotation,
  },
]))

export const violinExperience = experiences.get('violin')!

export function instrumentExperience(navigation: NavigationState) {
  return navigation.level === 'instrument' ? experiences.get(navigation.instrumentId) : undefined
}

export function canExplore(navigation: NavigationState) {
  return instrumentExperience(navigation) !== undefined
}
