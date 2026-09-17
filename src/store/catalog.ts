import { defaultSeatingPreset, orchestraScenePresets } from '../features/orchestra-map/config'
import { familyIds, familyInstruments, type FamilyId, type NavigationState } from '../features/orchestra-map/utils/navigation'
import type { OrchestraInstrument } from '../features/orchestra-map/config'

// Presets change geometry, not membership. Reuse the existing semantic catalog.
export const instrumentCatalog = familyIds.flatMap(familyId =>
  familyInstruments(orchestraScenePresets[defaultSeatingPreset], familyId).map(group => ({ ...group, familyId })),
)
export const familyInstrumentIds = (id: FamilyId) => instrumentCatalog.filter(group => group.familyId === id).map(group => group.instrument)
export type FamilySelection = 'none' | 'partial' | 'all'
export function familySelection(id: FamilyId, selected: readonly OrchestraInstrument[]): FamilySelection {
  const ids = familyInstrumentIds(id)
  const count = ids.filter(instrument => selected.includes(instrument)).length
  return count === 0 ? 'none' : count === ids.length ? 'all' : 'partial'
}

// Channels that stay at full level. Empty means the whole orchestra is even.
export function highlightedInstrumentIds(navigation: NavigationState): OrchestraInstrument[] {
  if (navigation.level === 'orchestra') return []
  if (navigation.level === 'family') return familyInstrumentIds(navigation.familyId)
  return [navigation.instrumentId]
}
