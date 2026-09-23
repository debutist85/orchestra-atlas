import { create } from 'zustand'

type ListeningLockStore = {
  lockFullOrchestra: boolean
  setLockFullOrchestra: (value: boolean) => void
  toggleLockFullOrchestra: () => void
}

// When locked, the full orchestra keeps playing regardless of navigation —
// see effectiveAudioSelection in audio-selection.ts, which is what actually
// applies the override. This store only holds the flag and its setters.
export const useListeningLockStore = create<ListeningLockStore>(set => ({
  lockFullOrchestra: false,
  setLockFullOrchestra: value => set({ lockFullOrchestra: value }),
  toggleLockFullOrchestra: () => set(state => ({ lockFullOrchestra: !state.lockFullOrchestra })),
}))
