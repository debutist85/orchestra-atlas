import { create } from 'zustand'

import type { OrchestraInstrument } from '../features/orchestra-map/config'
import { demonstrationsFor, partAction, type ActionMedia } from '../features/instrument-explorer/technique'

// Kept separate from navigation-store/experience-store and from the
// listening feature's own instrument selection — this is purely "what is the
// visitor looking at inside the instrument explorer," not where they are in
// the orchestra, and not what's driving the audio mix.
type AnatomyStore = {
  selectedPartId: string | null
  // A technique action belonging to the selected part (technique.ts).
  selectedActionId: string | null
  demonstrationOpen: boolean
  selectedMedia: ActionMedia | null
  selectAnatomyPart: (partId: string) => void
  selectAction: (actionId: string, instrumentId: OrchestraInstrument, media?: ActionMedia) => void
  clearAction: () => void
  openDemonstration: (instrumentId: OrchestraInstrument) => void
  closeDemonstration: () => void
  returnToInstrument: () => void
}

export const useAnatomyStore = create<AnatomyStore>((set, get) => ({
  selectedPartId: null,
  selectedActionId: null,
  demonstrationOpen: false,
  selectedMedia: null,
  selectAnatomyPart: partId => set({ selectedPartId: partId, selectedActionId: null, selectedMedia: null, demonstrationOpen: false }),
  selectAction: (actionId, instrumentId, media) => {
    const { selectedPartId } = get()
    if (!selectedPartId) return
    const action = partAction(instrumentId, selectedPartId, actionId)
    if (!action || (media && !action.media.includes(media))) return
    set({ selectedActionId: actionId, selectedMedia: media ?? null, demonstrationOpen: false })
  },
  clearAction: () => set({ selectedActionId: null, selectedMedia: null, demonstrationOpen: false }),
  openDemonstration: instrumentId => {
    const { selectedPartId, selectedActionId, selectedMedia } = get()
    if (!selectedPartId || !selectedActionId || selectedMedia === 'audio') return
    if (!demonstrationsFor(instrumentId, partAction(instrumentId, selectedPartId, selectedActionId)).some(demo => !get().selectedMedia || demo.type === get().selectedMedia)) return
    set({ demonstrationOpen: true })
  },
  closeDemonstration: () => set({ demonstrationOpen: false }),
  returnToInstrument: () => set({ selectedPartId: null, selectedActionId: null, selectedMedia: null, demonstrationOpen: false }),
}))
