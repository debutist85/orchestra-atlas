import { create } from 'zustand'

import type { OrchestraInstrument } from '../features/orchestra-map/config'
import type { Vec3 } from '../features/instrument-explorer/content/anatomy-camera'
import { configuredHotspots, nextHotspotId, parseHotspotConfig, serializeHotspots, type Hotspot } from '../features/instrument-explorer/content/hotspots'
import { instrumentPackModelUrl } from '../features/instrument-explorer/content/instrument-pack'

// The hotspots of whichever instrument the explorer is showing — read by
// InstrumentModel.tsx (markers, camera focus, and the focused note's title and
// description), which are siblings. Selecting/focusing a hotspot is NOT
// stored here: it goes through the anatomy store's selectedPartId exactly
// like a GLB anchor does. The editing fields are only used by the dev-only
// Hotspot Editor.
type Placement = 'off' | 'add' | 'move'

type HotspotStore = {
  instrumentId: OrchestraInstrument | null
  hotspots: Hotspot[]
  // What the JSON config currently holds — the editor's draft is compared
  // against it to tell whether there's anything left to export.
  savedHotspots: Hotspot[]
  persistDraft: boolean
  editingId: string | null
  placement: Placement
  load: (instrumentId: OrchestraInstrument, options?: { persistDraft?: boolean }) => void
  add: (position: Vec3) => Hotspot
  update: (id: string, patch: Partial<Hotspot>) => void
  remove: (id: string) => void
  setEditing: (id: string | null) => void
  setPlacement: (placement: Placement) => void
  discardDraft: () => void
}

// Debug-mode drafts survive a reload (the editor can't write the JSON file
// itself) until exported and pasted into the config, or discarded.
const draftKey = (instrumentId: OrchestraInstrument) => `orchestra-atlas:hotspot-draft:${instrumentId}${instrumentPackModelUrl(instrumentId) ? ':instrument-pack' : ''}`

function readDraft(instrumentId: OrchestraInstrument): Hotspot[] | undefined {
  try {
    const raw = globalThis.localStorage?.getItem(draftKey(instrumentId))
    return raw ? parseHotspotConfig(JSON.parse(raw)) : undefined
  } catch {
    return undefined
  }
}

function writeDraft(instrumentId: OrchestraInstrument, hotspots: Hotspot[], saved: Hotspot[]) {
  try {
    if (serializeHotspots(hotspots) === serializeHotspots(saved)) globalThis.localStorage?.removeItem(draftKey(instrumentId))
    else globalThis.localStorage?.setItem(draftKey(instrumentId), serializeHotspots(hotspots))
  } catch {
    // Storage unavailable (private mode, blocked) — the draft just won't persist.
  }
}

export const useHotspotStore = create<HotspotStore>((set, get) => {
  const commit = (hotspots: Hotspot[], extra: Partial<HotspotStore> = {}) => {
    const { instrumentId, savedHotspots, persistDraft } = get()
    if (instrumentId && persistDraft) writeDraft(instrumentId, hotspots, savedHotspots)
    set({ hotspots, ...extra })
  }
  return {
    instrumentId: null,
    hotspots: [],
    savedHotspots: [],
    persistDraft: false,
    editingId: null,
    placement: 'off',
    load: (instrumentId, { persistDraft = false } = {}) => {
      const savedHotspots = configuredHotspots(instrumentId)
      const hotspots = (persistDraft && readDraft(instrumentId)) || savedHotspots
      set({ instrumentId, hotspots, savedHotspots, persistDraft, editingId: null, placement: 'off' })
    },
    add: position => {
      const id = nextHotspotId(get().hotspots)
      const hotspot: Hotspot = { id, title: '', description: '', position }
      commit([...get().hotspots, hotspot], { editingId: id, placement: 'off' })
      return hotspot
    },
    update: (id, patch) => {
      const { hotspots, editingId } = get()
      commit(
        hotspots.map(hotspot => hotspot.id === id ? { ...hotspot, ...patch } : hotspot),
        patch.id && editingId === id ? { editingId: patch.id } : {},
      )
    },
    remove: id => {
      const { hotspots, editingId, placement } = get()
      commit(hotspots.filter(hotspot => hotspot.id !== id), editingId === id ? { editingId: null, placement: placement === 'move' ? 'off' : placement } : {})
    },
    setEditing: editingId => set({ editingId, placement: get().placement === 'move' ? 'off' : get().placement }),
    setPlacement: placement => set({ placement }),
    discardDraft: () => {
      const { savedHotspots } = get()
      commit(savedHotspots, { editingId: null, placement: 'off' })
    },
  }
})
