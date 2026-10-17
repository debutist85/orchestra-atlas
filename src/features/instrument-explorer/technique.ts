import type { OrchestraInstrument } from '../orchestra-map/config'

// What a visitor can do with a focused anatomy part: its actions. Every part
// has "Discover" (the part's own description, instrument-anatomy.ts),
// followed by the playing techniques configured for that part on that
// instrument, each with the media it is demonstrated in.
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
// still has Discover.
export type PartTechniques = Readonly<Record<string, readonly ActionMedia[]>>
export type InstrumentPartActions = Readonly<Record<string, PartTechniques>>

export const instrumentPartActions: Partial<Record<OrchestraInstrument, InstrumentPartActions>> = {
  violin: {
    Anchor_Bow: { 'col-legno': ['audio'], arco: ['video'] },
    Anchor_Bridge: { 'sul-ponticello': ['audio'], chords: ['audio'], pizzicato: ['video'] },
    Anchor_Fingerboard: { harmonics: ['audio'] },
    Anchor_Chinrest: {},
    Anchor_FHole_Right: {},
    Anchor_Pegbox: {},
    Anchor_Scroll: {},
    Anchor_Tailpiece: {},
  },
  // No timpani model yet: its techniques are hung on the stand-in violin
  // model's chinrest.
  timpani: {
    Anchor_Chinrest: { stroke: ['video'], tremolo: ['video'] },
  },
}

// Media files, per instrument and technique. A configured medium without a
// file shows as not yet available.
type MediaSource = { src: string; poster?: string }
// Local test files under public/videos (gitignored), served from the app
// origin so they play without an R2 upload. Replace with mediaUrl() once the
// recordings are hosted.
function localVideo(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}
const demonstrationSources: Partial<Record<OrchestraInstrument, Record<string, Partial<Record<ActionMedia, MediaSource>>>>> = {
  violin: {
    arco: { video: { src: localVideo('videos/instruments/violin/arco.mp4') } },
  },
  timpani: {
    stroke: { video: { src: localVideo('videos/instruments/timpani/timpanist_male_default.mp4') } },
    tremolo: { video: { src: localVideo('videos/instruments/timpani/timpanist_male_tremolo.mp4') } },
  },
}

export const discoverActionId = 'discover'

export type PartAction =
  | { kind: 'discover'; id: typeof discoverActionId; title: string }
  | { kind: 'technique'; id: string; title: string; technique: Technique; media: readonly ActionMedia[] }

export type Demonstration = { id: string; type: ActionMedia; title: string; src: string; poster?: string }

export function techniqueById(id: string): Technique | undefined {
  return techniques[id]
}

// Discover first, then the part's techniques in configured order. Unknown
// technique ids are skipped rather than failing the whole part.
export function partActions(
  instrumentId: OrchestraInstrument,
  partId: string,
  config: Partial<Record<OrchestraInstrument, InstrumentPartActions>> = instrumentPartActions,
): PartAction[] {
  const configured = config[instrumentId]?.[partId] ?? {}
  return [
    { kind: 'discover', id: discoverActionId, title: 'Discover' },
    ...Object.entries(configured).flatMap(([techniqueId, media]) => {
      const technique = techniques[techniqueId]
      return technique ? [{ kind: 'technique' as const, id: technique.id, title: technique.title, technique, media }] : []
    }),
  ]
}

export function partAction(instrumentId: OrchestraInstrument, partId: string, actionId: string) {
  return partActions(instrumentId, partId).find(action => action.id === actionId)
}

// The playable demonstrations of a technique action: its configured media
// that have a file, in configured order.
export function demonstrationsFor(instrumentId: OrchestraInstrument, action: PartAction | undefined): Demonstration[] {
  if (action?.kind !== 'technique') return []
  const sources = demonstrationSources[instrumentId]?.[action.id] ?? {}
  return action.media.flatMap(type => {
    const source = sources[type]
    return source ? [{ id: `${instrumentId}:${action.id}:${type}`, type, title: action.title, ...source }] : []
  })
}
