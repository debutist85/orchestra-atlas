import type { OrchestraInstrument } from '../orchestra-map/config'
import { familyIds } from '../orchestra-map/utils/navigation'
import { familyInstrumentIds } from '../../store/catalog'
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
  const allowed = available ? new Set(available) : undefined
  const familyStem = selection.selectedFamilyId
    ? excerpt.familyStems?.[selection.selectedFamilyId]
    : undefined
  const familyStemId = familyStem ? leafStemId(familyStem) : undefined
  const stemIds = familyStemId && (!allowed || allowed.has(familyStemId))
    ? [familyStemId]
    : leafStemIdsForInstruments(excerpt, selection.selectedInstrumentIds, allowed)
  if (!stemIds.length) return { mode: 'orchestra', stemIds: [] }
  return { mode: 'focus', stemIds }
}

// Each family and instrument is one pre-mixed file. Speculation follows the
// next navigation step instead of rotating through every manifest stem:
// orchestra view warms the family mixes, a family view warms its instruments,
// and an instrument view warms its family mix plus sibling instruments.
export function speculativeStemIds(
  excerpt: ExcerptDefinition,
  available: readonly string[] | ReadonlySet<string>,
  focusedStemIds: readonly string[],
) {
  const allowed = new Set(available)
  const groups = familyIds.flatMap(familyId => {
    const file = excerpt.familyStems?.[familyId]
    const familyStemId = file ? leafStemId(file) : undefined
    if (!familyStemId || !allowed.has(familyStemId)) return []
    return [{
      familyStemId,
      instruments: leafStemIdsForInstruments(excerpt, familyInstrumentIds(familyId), allowed),
    }]
  })
  const focused = new Set(focusedStemIds)
  if (!focused.size) return [...new Set(groups.map(group => group.familyStemId))]
  const group = groups.find(candidate =>
    focused.has(candidate.familyStemId) || candidate.instruments.some(id => focused.has(id)))
  if (!group) return []
  const candidates = focused.has(group.familyStemId)
    ? group.instruments
    : [group.familyStemId, ...group.instruments]
  return [...new Set(candidates.filter(id => !focused.has(id)))]
}
