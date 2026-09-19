import type { OrchestraInstrument } from '../orchestra-map/config'
import { leafStemId, type ExcerptDefinition } from './excerpt'
import type { AudioSelection } from './audio-selection'

export type PlaybackMode = 'orchestra' | 'focus'
export type PlaybackPlan =
  | { mode: 'orchestra'; stemIds: readonly [] }
  | { mode: 'focus'; stemIds: readonly string[] }

export function leafStemIdsForInstruments(
  excerpt: ExcerptDefinition,
  instrumentIds: readonly OrchestraInstrument[],
  available?: ReadonlySet<string> | readonly string[],
) {
  const allowed = available ? new Set(available) : undefined
  const ids = instrumentIds.flatMap(instrument => excerpt.stems[instrument] ?? []).map(leafStemId)
  return allowed ? ids.filter(id => allowed.has(id)) : ids
}

export function playbackPlan(
  selection: AudioSelection,
  excerpt: ExcerptDefinition,
  available?: ReadonlySet<string> | readonly string[],
): PlaybackPlan {
  if (!selection.selectedInstrumentIds.length || selection.effectiveListeningMode === 'normal') {
    return { mode: 'orchestra', stemIds: [] }
  }
  const stemIds = leafStemIdsForInstruments(excerpt, selection.selectedInstrumentIds, available)
  if (!stemIds.length) return { mode: 'orchestra', stemIds: [] }
  return { mode: 'focus', stemIds }
}
