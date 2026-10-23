import { create } from 'zustand'

import { canExplore } from '../features/instrument-explorer/content/explorable-instruments'
import { useNavigationStore } from './navigation-store'

export type ExperienceMode = 'map' | 'explore'

type ExperienceStore = {
  experienceMode: ExperienceMode
  // True once the map-to-Explore transition has settled (the instrument has
  // finished entering); false during either transition and on the map.
  exploreSettled: boolean
  setExploreSettled: (settled: boolean) => void
  enterExplore: () => boolean
  exitExplore: () => void
}

export const useExperienceStore = create<ExperienceStore>((set) => ({
  experienceMode: 'map',
  exploreSettled: false,
  setExploreSettled: settled => set({ exploreSettled: settled }),
  enterExplore: () => {
    if (!canExplore(useNavigationStore.getState().navigation)) return false
    set({ experienceMode: 'explore' })
    return true
  },
  exitExplore: () => set({ experienceMode: 'map', exploreSettled: false }),
}))
