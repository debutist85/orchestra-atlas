import { create } from 'zustand'

import { canExplore } from '../features/instrument-explorer/explorable-instruments'
import { useNavigationStore } from './navigation-store'

export type ExperienceMode = 'map' | 'explore'

type ExperienceStore = {
  experienceMode: ExperienceMode
  enterExplore: () => boolean
  exitExplore: () => void
}

export const useExperienceStore = create<ExperienceStore>((set) => ({
  experienceMode: 'map',
  enterExplore: () => {
    if (!canExplore(useNavigationStore.getState().navigation)) return false
    set({ experienceMode: 'explore' })
    return true
  },
  exitExplore: () => set({ experienceMode: 'map' }),
}))
