import type { OrchestraInstrument, OrchestraSceneConfig, OrchestraSectionId } from './config'

export const familyIds = ['strings', 'woodwinds', 'brass', 'percussion', 'other'] as const
export type FamilyId = typeof familyIds[number]
export type NavigationState =
  | { level: 'orchestra' }
  | { level: 'family'; familyId: FamilyId }
  | { level: 'instrument'; familyId: FamilyId; instrumentId: OrchestraInstrument }

// Navigation families may span multiple independently colored rendering sections.
export function familySections(id: FamilyId): OrchestraSectionId[] {
  return id === 'other' ? ['keyboard-instruments', 'plucked-instruments'] : [id]
}
export function sectionFamily(id: OrchestraSectionId): FamilyId | undefined {
  return familyIds.find(family => familySections(family).includes(id))
}
export function familyName(config: OrchestraSceneConfig, id: FamilyId) {
  return id === 'other' ? 'Other' : config.sections[id].name
}
export function familyInstruments(config: OrchestraSceneConfig, id: FamilyId) {
  return familySections(id).flatMap(sectionId => (config.instrumentGroups[sectionId] ?? []).map(group => ({
    ...group, sectionId,
  })))
}
export function back(state: NavigationState): NavigationState {
  return state.level === 'instrument' ? { level: 'family', familyId: state.familyId } : { level: 'orchestra' }
}

// Empty space, dimmed nodes, and clicks outside the map withdraw. Active
// highlights at the current level still zoom in. Orchestra has no parent.
export function clickDestination(navigation: NavigationState, target?: NavigationState): NavigationState | undefined {
  if (target) return sameNavigation(navigation, target) ? undefined : target
  return navigation.level === 'orchestra' ? undefined : back(navigation)
}
export function sameNavigation(a: NavigationState, b: NavigationState) {
  if (a.level !== b.level) return false
  if (a.level === 'orchestra') return true
  return a.familyId === b.familyId && (a.level === 'family' || a.instrumentId === b.instrumentId)
}

export function travelingTargetId(from: NavigationState, to: NavigationState) {
  if (from.level === 'orchestra' && to.level !== 'orchestra') return to.familyId
  if (from.level === 'family' && to.level === 'instrument') return to.instrumentId
}

export type MapLabelKind = 'navigate' | 'explore'
export type MapLabel = {
  id: string
  placementId: string
  name: string
  color: string
  sectionIds: OrchestraSectionId[]
  state: NavigationState
  kind: MapLabelKind
}

export function navigationTargets(config: OrchestraSceneConfig, state: NavigationState) {
  if (state.level === 'orchestra') return familyIds.map(id => ({
    id, name: familyName(config, id), color: id === 'other' ? '#c5c6c9' : config.sections[id].color, sectionIds: familySections(id), state: { level: 'family', familyId: id } as NavigationState,
  }))
  if (state.level === 'family') return familyInstruments(config, state.familyId).map(group => ({
    id: group.instrument, name: group.name, color: group.color ?? config.sections[group.sectionId].color, sectionIds: [group.sectionId],
    state: { level: 'instrument', familyId: state.familyId, instrumentId: group.instrument } as NavigationState,
  }))
  return []
}

export function exploreLabelId(instrument: OrchestraInstrument) {
  return `explore:${instrument}`
}

export function mapLabels(config: OrchestraSceneConfig, state: NavigationState): MapLabel[] {
  if (state.level !== 'instrument') {
    return navigationTargets(config, state).map(target => ({ ...target, placementId: target.id, kind: 'navigate' }))
  }
  const group = familyInstruments(config, state.familyId).find(item => item.instrument === state.instrumentId)
  if (!group) return []
  return [{
    id: exploreLabelId(group.instrument),
    placementId: group.instrument,
    name: `Explore ${group.name} →`,
    color: group.color ?? config.sections[group.sectionId].color,
    sectionIds: [group.sectionId],
    state,
    kind: 'explore',
  }]
}
