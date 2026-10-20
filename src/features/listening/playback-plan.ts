import type { OrchestraInstrument } from '../orchestra-map/config'
import { familyIds, type FamilyId } from '../orchestra-map/utils/navigation'
import { familyInstrumentIds } from '../../store/catalog'
import { leafStemId, type ExcerptDefinition } from './excerpt'
import type { AudioSelection } from './audio-selection'

export type PlaybackMode = 'orchestra' | 'focus'
export type PlaybackPlan =
  | { mode: 'orchestra'; stemIds: readonly [] }
  | { mode: 'focus'; stemIds: readonly string[] }

export function instrumentStemId(excerpt: ExcerptDefinition, instrument: OrchestraInstrument) {
  const file = excerpt.stems[instrument]
  return file ? leafStemId(file) : undefined
}

export function familyStemId(excerpt: ExcerptDefinition, familyId: FamilyId) {
  const file = excerpt.familyStems[familyId]
  return file ? leafStemId(file) : undefined
}

// Families that have instruments in the excerpt but no premix. The asset
// scripts refuse to run while any are missing, because focus would
// otherwise fall silent for that family.
export function missingFamilyStems(excerpt: ExcerptDefinition): FamilyId[] {
  return familyIds.filter(familyId => !excerpt.familyStems[familyId]
    && familyInstrumentIds(familyId).some(instrument => excerpt.stems[instrument]))
}

// A family or instrument focus is exactly one pre-mixed stem, or none.
export function playbackPlan(
  selection: AudioSelection,
  excerpt: ExcerptDefinition,
  available?: ReadonlySet<string> | readonly string[],
): PlaybackPlan {
  if (!selection.selectedInstrumentIds.length || selection.effectiveListeningMode === 'normal') {
    return { mode: 'orchestra', stemIds: [] }
  }
  const stemId = selection.selectedFamilyId
    ? familyStemId(excerpt, selection.selectedFamilyId)
    : instrumentStemId(excerpt, selection.selectedInstrumentIds[0])
  const playable = stemId !== undefined && (!available || new Set(available).has(stemId))
  // No stem to isolate (the instrument/family never appears in this
  // recording, e.g. trombone in Beethoven 7/ii) is not the same as nothing
  // being highlighted — it's a permanent rest. Stay in focus mode with an
  // empty stem list so the background still ducks to the scope's quiet
  // level instead of jumping back to the full, unducked orchestra.
  return { mode: 'focus', stemIds: playable ? [stemId] : [] }
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
    const familyStem = familyStemId(excerpt, familyId)
    if (!familyStem || !allowed.has(familyStem)) return []
    const instruments = familyInstrumentIds(familyId)
      .map(instrument => instrumentStemId(excerpt, instrument))
      .filter((id): id is string => !!id && allowed.has(id))
    return [{ familyStemId: familyStem, instruments }]
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
