import type { OrchestraInstrument } from '../orchestra-map/config'
import type { NavigationState } from '../orchestra-map/utils/navigation'
import { highlightedInstrumentIds } from '../../store/catalog'
import { useNavigationStore } from '../../store/navigation-store'

export type ListeningMode = 'normal' | 'highlight'
export type FocusDepth = 'orchestra' | 'family' | 'instrument'
export type ListeningMix = {
  maxInstrumentBoostDb: number
  instrumentBoostEmphasis: number
  orchestraBackgroundGain: number
  familyBackgroundGain: number
  instrumentBackgroundGain: number
}
export const listeningMix: ListeningMix = {
  // The previous saturation/lurch problem came from emphasis 3 hitting the
  // ceiling almost immediately (~2.5x quieter than average), not from the
  // ceiling itself — with emphasis 1 the curve only reaches this value once
  // the part is genuinely that many dB below the average, so raising it
  // stays graded. 24dB (~16x amplitude) lets a truly buried, pianissimo
  // line come all the way up to roughly match the ensemble instead of
  // staying capped at a still-quiet 12dB boost; the master limiter (see
  // listening-engine.ts) absorbs the resulting peaks so this doesn't clip.
  maxInstrumentBoostDb: 24,
  // 1 means boostDb directly tracks how many dB below the reference (its
  // own loudest moment, or the ensemble's loudest part — see
  // soloIntensityGain) the part currently is, up to the cap above — a
  // plain, predictable makeup-gain curve instead of an artificially
  // steepened one.
  instrumentBoostEmphasis: 1,
  orchestraBackgroundGain: 1,
  // Solo behavior: once a family or instrument is highlighted, the
  // full-orchestra background bed is fully muted — only the highlighted
  // part(s)' isolated stems (soloIntensityGain, see below) are audible.
  // orchestraBackgroundGain above stays 1 so the full mix still plays
  // normally whenever nothing is highlighted (orchestra scope).
  familyBackgroundGain: 0,
  instrumentBackgroundGain: 0,
}
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

export function orchestraAverageIntensity(intensities: readonly number[]) {
  const sounding = intensities.filter(value => value > 0)
  if (!sounding.length) return 0
  return sounding.reduce((sum, value) => sum + value, 0) / sounding.length
}

// A smooth proxy for "how loud does the ensemble sound right now" — the
// loudest currently-playing part. Deliberately NOT an average of only the
// "sounding" instruments like orchestraAverageIntensity: that average's
// membership changes discontinuously every time any instrument crosses in
// or out of "sounding" (see soloIntensityGain's comment for the erratic-
// volume bug this caused). Each instrument's own intensity is already
// continuous, and the max of several continuous values is itself
// continuous — nothing jumps when one instrument enters or leaves rest.
export function ensembleIntensity(intensities: readonly number[]) {
  return intensities.length ? Math.max(0, ...intensities) : 0
}

function resolvedMix(mix: Partial<ListeningMix> = listeningMix): ListeningMix {
  return { ...listeningMix, ...mix }
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

// Solo-mode gain for the highlighted stem (or, fed ensembleIntensity, for
// the full-orchestra layer), based only on ITS OWN intensity from the
// offline profile — never compared against any other instrument's
// activity. An earlier version of this boost compared the selected part to
// orchestraAverageIntensity, which is recomputed from every instrument's
// current activity; any instrument elsewhere starting or stopping changes
// that average's membership and jumps it discontinuously, which is what
// made the boost sound erratic. This reacts only to its own input, which
// moves smoothly, so there is nothing else to jump against. At its own
// loudest (intensity 1) gain is exactly 1 — no boost; as its own intensity
// falls toward 0, gain rises smoothly toward the ceiling so quiet (piano)
// passages stay clearly audible.
export function soloIntensityGain(intensity: number, mix: Partial<ListeningMix> = listeningMix) {
  if (!(intensity > 0)) return 1
  const resolved = resolvedMix(mix)
  const boostDb = resolved.maxInstrumentBoostDb * (1 - intensity) ** resolved.instrumentBoostEmphasis
  return linearGainFromDb(boostDb)
}

// A future engine receives the current mix immediately and subsequent zoom
// updates; its channel implementation and scheduling stay outside React.
export function connectListeningEngine(engine: { applySelection: (selection: AudioSelection) => void }) {
  const apply = () => engine.applySelection(audioSelection(useNavigationStore.getState().navigation))
  apply()
  return useNavigationStore.subscribe(apply)
}
