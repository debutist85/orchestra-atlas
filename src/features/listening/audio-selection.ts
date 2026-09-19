import type { OrchestraInstrument } from '../orchestra-map/config'
import type { NavigationState } from '../orchestra-map/utils/navigation'
import { highlightedInstrumentIds } from '../../store/catalog'
import { useNavigationStore } from '../../store/navigation-store'

export type ListeningMode = 'normal' | 'highlight'
export type FocusDepth = 'orchestra' | 'family' | 'instrument'
export type ListeningMix = {
  highlightAttenuationDb: number
  maxInstrumentBoostDb: number
  instrumentBoostEmphasis: number
  orchestraBackgroundGain: number
  familyBackgroundGain: number
  instrumentBackgroundGain: number
  minActiveFocusGain: number
}
export const listeningMix: ListeningMix = {
  highlightAttenuationDb: -15,
  maxInstrumentBoostDb: 24,
  instrumentBoostEmphasis: 3,
  orchestraBackgroundGain: 1,
  familyBackgroundGain: 0.25,
  instrumentBackgroundGain: 0.2,
  minActiveFocusGain: 0.35,
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
// Already-loud or silent parts stay at 0 dB. Emphasis > 1 makes piano
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

export function focusDepth(selection: AudioSelection): FocusDepth {
  if (!selection.selectedInstrumentIds.length || selection.effectiveListeningMode === 'normal') return 'orchestra'
  return selection.selectedInstrumentIds.length === 1 ? 'instrument' : 'family'
}

export function backgroundGainFor(
  selection: AudioSelection,
  mix: Partial<ListeningMix> = listeningMix,
  focusReady = true,
) {
  const resolved = resolvedMix(mix)
  if (!focusReady || focusDepth(selection) === 'orchestra') return resolved.orchestraBackgroundGain
  return focusDepth(selection) === 'instrument'
    ? resolved.instrumentBackgroundGain
    : resolved.familyBackgroundGain
}

// Average of sounding values. A family of eight stems does not get more
// emphasis than a solo because it has more members.
export function selectedFocusIntensity(intensities: readonly number[]) {
  return orchestraAverageIntensity(intensities)
}

// Extra isolated-stem gain on top of the attenuated full mix. 0 dB of boost
// (rest, or already at/above the orchestral average) is 0 additional signal,
// not unity gain — the part is already in full-orchestra.opus.
export function dynamicFocusGain(
  selectedIntensity: number,
  orchestraAverage: number,
  mix: Partial<ListeningMix> = listeningMix,
) {
  if (!(selectedIntensity > 0)) return 0
  const resolved = resolvedMix(mix)
  const boostDb = relativeInstrumentBoostDb(selectedIntensity, orchestraAverage, resolved)
  const additional = boostDb <= 0 ? 0 : Math.max(0, linearGainFromDb(boostDb) - 1)
  return Math.max(additional, resolved.minActiveFocusGain)
}

// A future engine receives the current mix immediately and subsequent zoom
// updates; its channel implementation and scheduling stay outside React.
export function connectListeningEngine(engine: { applySelection: (selection: AudioSelection) => void }) {
  const apply = () => engine.applySelection(audioSelection(useNavigationStore.getState().navigation))
  apply()
  return useNavigationStore.subscribe(apply)
}
