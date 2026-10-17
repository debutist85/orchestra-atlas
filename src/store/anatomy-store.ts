import { create } from 'zustand'

import type { OrchestraInstrument } from '../features/orchestra-map/config'
import { demonstrationsFor, partAction } from '../features/instrument-explorer/technique'

// Kept separate from navigation-store/experience-store and from the
// listening feature's own instrument selection — this is purely "what is the
// visitor looking at inside the instrument explorer," not where they are in
// the orchestra, and not what's driving the audio mix.
type AnatomyStore = {
  selectedPartId: string | null
  // An action of the selected part: Discover or a technique (technique.ts).
  selectedActionId: string | null
  demonstrationOpen: boolean
  selectAnatomyPart: (partId: string) => void
  selectAction: (actionId: string, instrumentId: OrchestraInstrument) => void
  clearAction: () => void
  openDemonstration: (instrumentId: OrchestraInstrument) => void
  closeDemonstration: () => void
  returnToInstrument: () => void
}

export const useAnatomyStore = create<AnatomyStore>((set, get) => ({
  selectedPartId: null,
  selectedActionId: null,
  demonstrationOpen: false,
  selectAnatomyPart: partId => set({ selectedPartId: partId, selectedActionId: null, demonstrationOpen: false }),
  selectAction: (actionId, instrumentId) => {
    const { selectedPartId } = get()
    if (!selectedPartId || !partAction(instrumentId, selectedPartId, actionId)) return
    set({ selectedActionId: actionId, demonstrationOpen: false })
  },
  clearAction: () => set({ selectedActionId: null, demonstrationOpen: false }),
  openDemonstration: instrumentId => {
    const { selectedPartId, selectedActionId } = get()
    if (!selectedPartId || !selectedActionId) return
    if (demonstrationsFor(instrumentId, partAction(instrumentId, selectedPartId, selectedActionId)).length === 0) return
    set({ demonstrationOpen: true })
  },
  closeDemonstration: () => set({ demonstrationOpen: false }),
  returnToInstrument: () => set({ selectedPartId: null, selectedActionId: null, demonstrationOpen: false }),
}))
