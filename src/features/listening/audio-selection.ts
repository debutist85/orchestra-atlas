import type { OrchestraInstrument } from '../orchestra-installation/config'
import { effectiveListeningMode, useListeningStore, type ListeningMode, type ListeningState } from '../../store/listening-store'

export type ListeningMix = { highlightAttenuationDb: number; isolateAttenuationDb: number }
export const listeningMix: ListeningMix = { highlightAttenuationDb: -15, isolateAttenuationDb: -Infinity }
export type AudioSelection = {
  selectedInstrumentIds: readonly OrchestraInstrument[]
  effectiveListeningMode: ListeningMode
}
export function audioSelection(state: ListeningState): AudioSelection {
  return { selectedInstrumentIds: [...state.selectedInstrumentIds], effectiveListeningMode: effectiveListeningMode(state) }
}
export function channelGainDb(id: OrchestraInstrument, selection: AudioSelection, mix: ListeningMix = listeningMix) {
  if (!selection.selectedInstrumentIds.length || selection.effectiveListeningMode === 'normal' || selection.selectedInstrumentIds.includes(id)) return 0
  return selection.effectiveListeningMode === 'highlight' ? mix.highlightAttenuationDb : mix.isolateAttenuationDb
}
// A future engine receives the current mix immediately and subsequent semantic
// updates; its channel implementation and scheduling stay outside React.
export function connectListeningEngine(engine: { applySelection: (selection: AudioSelection) => void }) {
  engine.applySelection(audioSelection(useListeningStore.getState()))
  return useListeningStore.subscribe(state => engine.applySelection(audioSelection(state)))
}
