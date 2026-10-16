import { stopTechniqueAudio } from '../features/instrument-explorer/technique-audio-store'
import { create } from 'zustand'

import type { OrchestraInstrument } from '../features/orchestra-map/config'
import { resumeMainPlaybackAfterDemo } from '../features/instrument-explorer/demo-playback-coordination'
import { techniqueById, techniqueHasVideo, techniquesForAnatomyPart } from '../features/instrument-explorer/technique'

// Kept separate from navigation-store/experience-store and from the
// listening feature's own instrument selection — this is purely "what is the
// visitor looking at inside the instrument explorer," not where they are in
// the orchestra, and not what's driving the audio mix.
type AnatomyStore = {
  selectedPartId: string | null
  selectedTechniqueId: string | null
  techniqueNoteId: string | null
  openTechniqueNote: (id: string) => void
  closeTechniqueNote: () => void
  discoveryOpen: boolean
  discoveryContent: 'anatomy' | 'audio' | 'video'
  openDiscovery: (content?: 'anatomy' | 'audio' | 'video') => void
  closeDiscovery: () => void
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
  techniqueNoteId: null,
  openTechniqueNote: id => { if (get().selectedPartId && techniqueById(id)) set({ techniqueNoteId: id }) },
  closeTechniqueNote: () => { stopTechniqueAudio(); set({ techniqueNoteId: null }) },
  discoveryOpen: false,
  discoveryContent: 'anatomy',
  openDiscovery: (content = 'anatomy') => { if (get().selectedPartId && !get().demonstrationOpen) set({ discoveryOpen: true, discoveryContent: content }) },
  closeDiscovery: () => { stopTechniqueAudio(); set({ discoveryOpen: false }) },
  selectedPartId: null,
  selectedTechniqueId: null,
  demonstrationOpen: false,
  // Every transition below that can flip demonstrationOpen from true to
  // false — not just the explicit close actions — resumes main playback the
  // same way, so the header Back, Escape, and the local in-column Back
  // controls (AnatomyDetailPanel/DemonstrationStage) all share one semantic
  // implementation instead of each remembering to call the coordinator.
  selectAnatomyPart: partId => {
    stopTechniqueAudio()
    if (get().demonstrationOpen) resumeMainPlaybackAfterDemo()
    set({ techniqueNoteId: null, discoveryOpen: false, selectedPartId: partId, selectedTechniqueId: null, demonstrationOpen: false })
  },
  clearTechnique: () => {
    if (get().demonstrationOpen) resumeMainPlaybackAfterDemo()
    set({ discoveryOpen: false, selectedTechniqueId: null, demonstrationOpen: false })
  },
  selectTechnique: (techniqueId, instrumentId) => {
    const { selectedPartId, demonstrationOpen } = get()
    if (!selectedPartId || !techniquesForAnatomyPart(selectedPartId, instrumentId).some(technique => technique.id === techniqueId)) return
    if (demonstrationOpen) resumeMainPlaybackAfterDemo()
    set({ discoveryOpen: false, selectedTechniqueId: techniqueId, demonstrationOpen: false })
  },
  openPerformance: (techniqueId, instrumentId) => {
    const { selectedPartId } = get()
    const technique = techniqueById(techniqueId)
    const linked = !!selectedPartId && techniquesForAnatomyPart(selectedPartId, instrumentId).some(item => item.id === techniqueId)
    if (!linked || !technique || !techniqueHasVideo(technique)) return
    stopTechniqueAudio()
    set({ techniqueNoteId: null, discoveryOpen: false, selectedTechniqueId: techniqueId, demonstrationOpen: true })
  },
  openDemonstration: () => {
    const { selectedTechniqueId } = get()
    const technique = selectedTechniqueId ? techniqueById(selectedTechniqueId) : undefined
    if (!technique || technique.demonstrationIds.length === 0) return
    stopTechniqueAudio()
    set({ discoveryOpen: false, demonstrationOpen: true })
  },
  closeDemonstration: () => {
    resumeMainPlaybackAfterDemo()
    set({ demonstrationOpen: false })
  },
  returnToInstrument: () => {
    stopTechniqueAudio()
    if (get().demonstrationOpen) resumeMainPlaybackAfterDemo()
    set({ techniqueNoteId: null, discoveryOpen: false, selectedPartId: null, selectedTechniqueId: null, demonstrationOpen: false })
  },
}))
