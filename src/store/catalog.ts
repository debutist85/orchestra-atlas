import { defaultSeatingPreset, orchestraScenePresets } from '../features/orchestra-installation/config'
import { familyIds, familyInstruments, type FamilyId } from '../features/orchestra-installation/navigation'
import type { OrchestraInstrument } from '../features/orchestra-installation/config'

// Presets change geometry, not membership. Reuse the existing semantic catalog.
export const instrumentCatalog = familyIds.flatMap(familyId =>
  familyInstruments(orchestraScenePresets[defaultSeatingPreset], familyId).map(group => ({ ...group, familyId })),
)
export const instrumentExists = (id: OrchestraInstrument) => instrumentCatalog.some(group => group.instrument === id)
export const familyInstrumentIds = (id: FamilyId) => instrumentCatalog.filter(group => group.familyId === id).map(group => group.instrument)
export type FamilySelection = 'none' | 'partial' | 'all'
export function familySelection(id: FamilyId, selected: readonly OrchestraInstrument[]): FamilySelection {
  const ids = familyInstrumentIds(id)
  const count = ids.filter(instrument => selected.includes(instrument)).length
  return count === 0 ? 'none' : count === ids.length ? 'all' : 'partial'
}
