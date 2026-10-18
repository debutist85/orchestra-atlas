import { create } from 'zustand'

export type ViewportRect = { left: number; top: number; width: number; height: number }

type ExploreLayoutStore = {
  // Where the contextual minimap settles during Explore, in viewport (client)
  // px — the transition's layout target, not a per-frame animation value.
  // Null when it is off screen or Explore is not active.
  contextualMap: ViewportRect | null
  setContextualMap: (rect: ViewportRect | null) => void
}

// Lets the instrument stage keep its own content clear of the minimap
// without reaching into the map's DOM or motion code.
export const useExploreLayoutStore = create<ExploreLayoutStore>(set => ({
  contextualMap: null,
  setContextualMap: rect => set(state => {
    const current = state.contextualMap
    const same = current === rect || (current && rect
      && current.left === rect.left && current.top === rect.top && current.width === rect.width && current.height === rect.height)
    return same ? state : { contextualMap: rect }
  }),
}))
