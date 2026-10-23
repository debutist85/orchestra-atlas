import { mediaUrl } from '../../../lib/media-url'
import type { OrchestraInstrument } from '../../orchestra-map/config'

// Per-part technique actions and their media. Anatomy text is always visible.
//
// Techniques are a shared catalog, separate from parts and instruments — the
// same technique can belong to several parts or instruments without
// duplicating its content. Which part offers which technique, and in which
// media, is configured per instrument; where the media files live, too.

export type ActionMedia = 'audio' | 'video'

export type Technique = {
  id: string
  title: string
  description: string
}

// Short, general descriptions pending musical review, like the rest of the
// explorer's copy.
const techniques: Record<string, Technique> = {
  arco: {
    id: 'arco',
    title: 'Arco',
    description: 'Played with the bow — the hair drawn across the string. The default way of sounding a bowed string instrument.',
  },
  'col-legno': {
    id: 'col-legno',
    title: 'Col legno',
    description: 'The player strikes or draws the strings with the wooden stick of the bow instead of its hair, for a dry, percussive sound.',
  },
  'sul-ponticello': {
    id: 'sul-ponticello',
    title: 'Sul ponticello',
    // Bowing NEAR the bridge, not on it — a real, easy-to-make mistake worth
    // stating explicitly rather than leaving implicit.
    description: 'The player bows very close to the bridge — not on it — emphasizing higher overtones for a bright, glassy sound.',
  },
  'sul-tasto': {
    id: 'sul-tasto',
    title: 'Sul tasto',
    description: 'The player bows over the fingerboard for a softer, veiled sound.',
  },
  chords: {
    id: 'chords',
    title: 'Chords',
    description: 'Several strings sounded together. Chords of three or four notes are broken across the strings, since the curved bridge lets the bow hold only two at once.',
  },
  pizzicato: {
    id: 'pizzicato',
    title: 'Pizzicato',
    description: 'The strings are plucked with the fingers instead of bowed, for a short, detached sound.',
  },
  harmonics: {
    id: 'harmonics',
    title: 'Harmonics',
    description: 'The player touches a string lightly at certain points, without pressing it down, producing a high, pure, flute-like tone.',
  },
  stroke: {
    id: 'stroke',
    title: 'Stroke',
    description: 'A single mallet stroke on the drumhead. The way the mallet meets the head shapes the attack and the volume.',
  },
  tremolo: {
    id: 'tremolo',
    title: 'Tremolo',
    description: 'A roll of rapid repeated strokes that sustains the pitch.',
  },
}

// Per instrument, per anatomy part (the anchor's GLB node name, as in
// instrument-anatomy.ts): technique id → the media it is demonstrated in,
// in display order. A part listed with no techniques, or not listed at all,
// has no actions. Techniques are listened to only: each instrument's one
// video is its performance (PerformanceStage), not per technique.
export type PartTechniques = Readonly<Record<string, readonly ActionMedia[]>>
export type InstrumentPartActions = Readonly<Record<string, PartTechniques>>

export const instrumentPartActions: Partial<Record<OrchestraInstrument, InstrumentPartActions>> = {
  violin: {
    Anchor_Bow: { arco: ['audio'], tremolo: ['audio'], 'col-legno': ['audio'] },
    Anchor_Bridge: { pizzicato: ['audio'], 'sul-ponticello': ['audio'], 'sul-tasto': ['audio'] },
    Anchor_Fingerboard: { harmonics: ['audio'] },
    Anchor_Chinrest: {},
    Anchor_FHole_Right: {},
    Anchor_Pegbox: {},
    Anchor_Scroll: {},
    Anchor_Tailpiece: {},
  },
}

// Media sources are keyed by instrument, technique, and medium.
type MediaSource = { src: string; poster?: string }
const instrumentSources: Partial<Record<OrchestraInstrument, Record<string, Partial<Record<ActionMedia, MediaSource>>>>> = {
  violin: {
    arco: {
      audio: { src: mediaUrl('audio/instruments/violin/arco.m4a') },
    },
    tremolo: { audio: { src: mediaUrl('audio/instruments/violin/tremolo.m4a') } },
    'col-legno': { audio: { src: mediaUrl('audio/instruments/violin/col_legno.m4a') } },
    pizzicato: { audio: { src: mediaUrl('audio/instruments/violin/pizzicato.m4a') } },
    'sul-ponticello': { audio: { src: mediaUrl('audio/instruments/violin/sul_ponticello.m4a') } },
    'sul-tasto': { audio: { src: mediaUrl('audio/instruments/violin/sul_tasto.m4a') } },
    harmonics: { audio: { src: mediaUrl('audio/instruments/violin/harmonics.m4a') } },
  },
}

export type PartAction = { kind: 'technique'; id: string; title: string; technique: Technique; media: readonly ActionMedia[] }

export type Demonstration = { id: string; type: ActionMedia; title: string; src: string; poster?: string }

// The part’s techniques in configured order. Unknown
// technique ids are skipped rather than failing the whole part.
export function partActions(
  instrumentId: OrchestraInstrument,
  partId: string,
  config: Partial<Record<OrchestraInstrument, InstrumentPartActions>> = instrumentPartActions,
): PartAction[] {
  const configured = config[instrumentId]?.[partId] ?? {}
  return Object.entries(configured).flatMap(([techniqueId, media]) => {
    const technique = techniques[techniqueId]
    return technique ? [{ kind: 'technique' as const, id: technique.id, title: technique.title, technique, media }] : []
  })
}

export function partAction(instrumentId: OrchestraInstrument, partId: string, actionId: string) {
  return partActions(instrumentId, partId).find(action => action.id === actionId)
}

// The playable demonstrations of a technique action: its configured media
// that have a file, in configured order.
export function demonstrationsFor(instrumentId: OrchestraInstrument, action: PartAction | undefined): Demonstration[] {
  if (action?.kind !== 'technique') return []
  return action.media.flatMap(type => {
    const source = instrumentSources[instrumentId]?.[action.id]?.[type]
    return source ? [{ id: `${instrumentId}:${action.id}:${type}`, type, title: action.title, ...source }] : []
  })
}

/** Configured technique/media pairs with a playable source for the instrument. */
export function playablePartActions(instrumentId: OrchestraInstrument, partId: string) {
  return partActions(instrumentId, partId).flatMap(action =>
    demonstrationsFor(instrumentId, action).map(demonstration => ({ action, demonstration })))
}

/** Whether a part has a technique to listen to; only such parts get a
 *  hotspot in the full-instrument view. */
export function hasPartAudio(instrumentId: OrchestraInstrument, partId: string) {
  return playablePartActions(instrumentId, partId).some(({ demonstration }) => demonstration.type === 'audio')
}

export type RadialPartAction = {
  id: string
  title: string
  media: ActionMedia | 'discover'
  actionId: string | null
}

/** Discover restores the default note; omit it when there is nothing to switch from. */
export function radialPartActions(instrumentId: OrchestraInstrument, partId: string): RadialPartAction[] {
  const playable = playablePartActions(instrumentId, partId)
  if (!playable.length) return []
  return [
    { id: `${instrumentId}:${partId}:discover`, title: 'Discover', media: 'discover', actionId: null },
    ...playable.map(({ action, demonstration }) => ({
      id: demonstration.id, title: action.title, media: demonstration.type, actionId: action.id,
    })),
  ]
}
