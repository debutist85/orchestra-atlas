import { create } from 'zustand'
import type { OrchestraInstrument } from '../features/orchestra-installation/config'
import type { FamilyId } from '../features/orchestra-installation/navigation'
import { familyInstrumentIds, instrumentExists } from './catalog'

export type ListeningMode = 'normal' | 'highlight' | 'isolate'
export type ListeningState = {
  selectedInstrumentIds: readonly OrchestraInstrument[]
  listeningMode: ListeningMode
}
type ListeningStore = ListeningState & {
  selectInstrument: (id: OrchestraInstrument) => void
  deselectInstrument: (id: OrchestraInstrument) => void
  toggleInstrument: (id: OrchestraInstrument) => void
  selectFamily: (id: FamilyId) => void
  deselectFamily: (id: FamilyId) => void
  clearSelection: () => void
  setListeningMode: (mode: ListeningMode) => void
}
export function effectiveListeningMode(state: ListeningState): ListeningMode {
  return state.selectedInstrumentIds.length ? state.listeningMode : 'normal'
}
export const useListeningStore = create<ListeningStore>((set) => ({
  selectedInstrumentIds: [],
  listeningMode: 'normal',
  selectInstrument: id => {
    if (instrumentExists(id)) set(state => ({ selectedInstrumentIds: [...new Set([...state.selectedInstrumentIds, id])] }))
  },
  deselectInstrument: id => set(state => ({ selectedInstrumentIds: state.selectedInstrumentIds.filter(value => value !== id) })),
  toggleInstrument: id => {
    if (instrumentExists(id)) set(state => ({ selectedInstrumentIds: state.selectedInstrumentIds.includes(id)
      ? state.selectedInstrumentIds.filter(value => value !== id) : [...state.selectedInstrumentIds, id] }))
  },
  selectFamily: id => set(state => ({ selectedInstrumentIds: [...new Set([...state.selectedInstrumentIds, ...familyInstrumentIds(id)])] })),
  deselectFamily: id => set(state => ({ selectedInstrumentIds: state.selectedInstrumentIds.filter(value => !familyInstrumentIds(id).includes(value)) })),
  clearSelection: () => set({ selectedInstrumentIds: [] }),
  setListeningMode: mode => {
    if (['normal', 'highlight', 'isolate'].includes(mode)) set({ listeningMode: mode })
  },
}))
