import { create } from 'zustand'
import type { OrchestraInstrument } from '../features/orchestra-map/config'

export type ListeningLoadStatus = 'loading' | 'ready' | 'error'

export type ListeningLoadState = {
  status: ListeningLoadStatus
  loaded: number
  total: number
  readyIds: readonly OrchestraInstrument[]
  missingIds: readonly OrchestraInstrument[]
}

type ListeningLoadStore = ListeningLoadState & {
  setProgress: (loaded: number, total: number) => void
  setResult: (readyIds: readonly OrchestraInstrument[], missingIds: readonly OrchestraInstrument[]) => void
}

export const useListeningLoadStore = create<ListeningLoadStore>((set) => ({
  status: 'loading',
  loaded: 0,
  total: 0,
  readyIds: [],
  missingIds: [],
  setProgress: (loaded, total) => set({
    status: 'loading',
    loaded: Math.max(0, loaded),
    total: Math.max(0, total),
  }),
  setResult: (readyIds, missingIds) => set({
    status: readyIds.length ? 'ready' : 'error',
    loaded: readyIds.length,
    total: readyIds.length + missingIds.length,
    readyIds: [...readyIds],
    missingIds: [...missingIds],
  }),
}))
