import type { OrchestraInstrument } from '../orchestra-map/config'
import type { NavigationState } from '../orchestra-map/utils/navigation'
import { highlightedInstrumentIds } from '../../store/catalog'
import { useNavigationStore } from '../../store/navigation-store'

export type ListeningMode = 'normal' | 'highlight'
export type ListeningMix = { highlightAttenuationDb: number }
export const listeningMix: ListeningMix = { highlightAttenuationDb: -15 }
export type AudioSelection = {
  selectedInstrumentIds: readonly OrchestraInstrument[]
  effectiveListeningMode: ListeningMode
}

export function audioSelection(navigation: NavigationState): AudioSelection {
  const selectedInstrumentIds = highlightedInstrumentIds(navigation)
  return {
    selectedInstrumentIds,
    effectiveListeningMode: selectedInstrumentIds.length ? 'highlight' : 'normal',
  }
}

export function channelGainDb(id: OrchestraInstrument, selection: AudioSelection, mix: ListeningMix = listeningMix) {
  if (!selection.selectedInstrumentIds.length || selection.effectiveListeningMode === 'normal' || selection.selectedInstrumentIds.includes(id)) return 0
  return mix.highlightAttenuationDb
}

export function linearGainFromDb(db: number) {
  if (!Number.isFinite(db) || db <= -80) return 0
  return 10 ** (db / 20)
}

// A future engine receives the current mix immediately and subsequent zoom
// updates; its channel implementation and scheduling stay outside React.
export function connectListeningEngine(engine: { applySelection: (selection: AudioSelection) => void }) {
  const apply = () => engine.applySelection(audioSelection(useNavigationStore.getState().navigation))
  apply()
  return useNavigationStore.subscribe(apply)
}
