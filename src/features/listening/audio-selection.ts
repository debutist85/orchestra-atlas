import type { OrchestraInstrument } from '../orchestra-map/config'
import type { NavigationState } from '../orchestra-map/utils/navigation'
import { highlightedInstrumentIds } from '../../store/catalog'
import { useNavigationStore } from '../../store/navigation-store'

export type ListeningMode = 'normal' | 'highlight'
export type ListeningMix = {
  highlightAttenuationDb: number
  maxInstrumentBoostDb: number
  instrumentBoostEmphasis: number
}
export const listeningMix: ListeningMix = {
  highlightAttenuationDb: -15,
  maxInstrumentBoostDb: 18,
  instrumentBoostEmphasis: 2,
}
export type AudioSelection = {
  selectedInstrumentIds: readonly OrchestraInstrument[]
  effectiveListeningMode: ListeningMode
}
export type MixLevels = {
  instrumentIntensity: number
  orchestraAverage: number
}

export function audioSelection(navigation: NavigationState): AudioSelection {
  const selectedInstrumentIds = highlightedInstrumentIds(navigation)
  return {
    selectedInstrumentIds,
    effectiveListeningMode: selectedInstrumentIds.length ? 'highlight' : 'normal',
  }
}

export function orchestraAverageIntensity(intensities: readonly number[]) {
  const sounding = intensities.filter(value => value > 0)
  if (!sounding.length) return 0
  return sounding.reduce((sum, value) => sum + value, 0) / sounding.length
}

// Lift a quiet selected part relative to the current orchestral average.
// Already-loud or silent parts stay at 0 dB. Emphasis > 1 makes quieter
// playing come further forward than a 1:1 match to the average.
function resolvedMix(mix: Partial<ListeningMix> = listeningMix): ListeningMix {
  return { ...listeningMix, ...mix }
}

export function relativeInstrumentBoostDb(
  instrumentIntensity: number,
  orchestraAverage: number,
  mix: Partial<ListeningMix> = listeningMix,
) {
  if (!(instrumentIntensity > 0) || !(orchestraAverage > 0) || instrumentIntensity >= orchestraAverage) return 0
  const resolved = resolvedMix(mix)
  const matchDb = 20 * Math.log10(orchestraAverage / instrumentIntensity)
  return Math.min(resolved.maxInstrumentBoostDb, matchDb * resolved.instrumentBoostEmphasis)
}

export function channelGainDb(
  id: OrchestraInstrument,
  selection: AudioSelection,
  mix: Partial<ListeningMix> = listeningMix,
  levels?: MixLevels,
) {
  const resolved = resolvedMix(mix)
  if (!selection.selectedInstrumentIds.length || selection.effectiveListeningMode === 'normal') return 0
  if (selection.selectedInstrumentIds.includes(id)) {
    if (selection.selectedInstrumentIds.length !== 1) return 0
    if (!levels) return 0
    return relativeInstrumentBoostDb(levels.instrumentIntensity, levels.orchestraAverage, resolved)
  }
  return resolved.highlightAttenuationDb
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
