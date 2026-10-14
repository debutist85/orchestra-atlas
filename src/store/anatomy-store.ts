import { create } from 'zustand'

import type { OrchestraInstrument } from '../features/orchestra-map/config'
import { techniqueById, techniqueHasVideo, techniquesForAnatomyPart } from '../features/instrument-explorer/technique'

// Kept separate from navigation-store/experience-store and from the
// listening feature's own instrument selection — this is purely "what is the
// visitor looking at inside the instrument explorer," not where they are in
// the orchestra, and not what's driving the audio mix.
type AnatomyStore = {
  selectedPartId: string | null
  selectedTechniqueId: string | null
  demonstrationOpen: boolean
  selectAnatomyPart: (partId: string) => void
  clearTechnique: () => void
  selectTechnique: (techniqueId: string, instrumentId?: OrchestraInstrument) => void
  openPerformance: (techniqueId: string, instrumentId?: OrchestraInstrument) => void
  openDemonstration: () => void
  closeDemonstration: () => void
  returnToInstrument: () => void
}

export const useAnatomyStore = create<AnatomyStore>((set, get) => ({
  selectedPartId: null,
  selectedTechniqueId: null,
  demonstrationOpen: false,
  selectAnatomyPart: partId => set({ selectedPartId: partId, selectedTechniqueId: null, demonstrationOpen: false }),
  clearTechnique: () => set({ selectedTechniqueId: null, demonstrationOpen: false }),
  selectTechnique: (techniqueId, instrumentId) => {
    const { selectedPartId } = get()
    if (!selectedPartId || !techniquesForAnatomyPart(selectedPartId, instrumentId).some(technique => technique.id === techniqueId)) return
    set({ selectedTechniqueId: techniqueId, demonstrationOpen: false })
  },
  openPerformance: (techniqueId, instrumentId) => {
    const { selectedPartId } = get()
    const technique = techniqueById(techniqueId)
    const linked = !!selectedPartId && techniquesForAnatomyPart(selectedPartId, instrumentId).some(item => item.id === techniqueId)
    if (!linked || !technique || !techniqueHasVideo(technique)) return
    set({ selectedTechniqueId: techniqueId, demonstrationOpen: true })
  },
  openDemonstration: () => {
    const { selectedTechniqueId } = get()
    const technique = selectedTechniqueId ? techniqueById(selectedTechniqueId) : undefined
    if (!technique || technique.demonstrationIds.length === 0) return
    set({ demonstrationOpen: true })
  },
  closeDemonstration: () => set({ demonstrationOpen: false }),
  returnToInstrument: () => set({ selectedPartId: null, selectedTechniqueId: null, demonstrationOpen: false }),
}))
