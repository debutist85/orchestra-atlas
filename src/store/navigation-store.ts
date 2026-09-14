import { create } from 'zustand'
import { back, familyIds, type FamilyId, type NavigationState } from '../features/orchestra-installation/navigation'
import type { OrchestraInstrument } from '../features/orchestra-installation/config'
import { instrumentCatalog } from './catalog'

type NavigationStore = {
  navigation: NavigationState
  enterFamily: (id: FamilyId) => void
  enterInstrument: (id: OrchestraInstrument) => void
  goBack: () => void
  resetToOrchestra: () => void
}
export const useNavigationStore = create<NavigationStore>((set) => ({
  navigation: { level: 'orchestra' },
  enterFamily: id => {
    if (familyIds.includes(id)) set({ navigation: { level: 'family', familyId: id } })
  },
  enterInstrument: id => {
    const instrument = instrumentCatalog.find(group => group.instrument === id)
    if (instrument) set({ navigation: { level: 'instrument', familyId: instrument.familyId, instrumentId: id } })
  },
  goBack: () => set(state => ({ navigation: back(state.navigation) })),
  resetToOrchestra: () => set({ navigation: { level: 'orchestra' } }),
}))

// Scene events use the same validated semantic actions as DOM controls.
export function navigateTo(target: NavigationState) {
  const actions = useNavigationStore.getState()
  if (target.level === 'orchestra') actions.resetToOrchestra()
  else if (target.level === 'family') actions.enterFamily(target.familyId)
  else actions.enterInstrument(target.instrumentId)
}
