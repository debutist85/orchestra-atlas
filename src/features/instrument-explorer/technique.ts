import type { OrchestraInstrument } from '../orchestra-map/config'

// Techniques and demonstrations are modeled separately from anatomy parts —
// a technique may apply to several parts, and keeping them keyed by id
// (rather than embedded inside each anatomy part) avoids duplicating the
// same content if that ever happens.

export type Demonstration =
  | { id: string; type: 'audio'; title?: string; src: string }
  | { id: string; type: 'video'; title?: string; src: string; poster?: string }
  | { id: string; type: 'interactive'; title?: string; interactionId: string }
  | { id: string; type: 'comparison'; title?: string; comparisonId: string }

export type Technique = {
  id: string
  title: string
  description: string
  demonstrationIds: string[]
}

const techniques: Record<string, Technique> = {
  'sul-ponticello': {
    id: 'sul-ponticello',
    title: 'Sul ponticello',
    // Bowing NEAR the bridge, not on it — a real, easy-to-make mistake worth
    // stating explicitly rather than leaving implicit.
    description: 'The player bows very close to the bridge — not on it — emphasizing higher overtones for a bright, glassy sound.',
    demonstrationIds: ['sul-ponticello-video'],
  },
  stroke: {
    id: 'stroke',
    title: 'Stroke',
    description: 'A single mallet stroke on the drumhead. The way the mallet meets the head shapes the attack and the volume.',
    demonstrationIds: ['timpani-stroke-video'],
  },
  tremolo: {
    id: 'tremolo',
    title: 'Tremolo',
    description: 'A roll of rapid repeated strokes that sustains the pitch.',
    demonstrationIds: ['timpani-tremolo-video'],
  },
}

// Local test files under public/videos (gitignored). Served from the app
// origin so they play without an R2 upload. Replace with mediaUrl() once
// the recordings are hosted.
function localVideo(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

const demonstrations: Record<string, Demonstration> = {
  'sul-ponticello-video': {
    id: 'sul-ponticello-video',
    type: 'video',
    title: 'Sul ponticello',
    // Temporary test clip. The file is an arco take, not a verified sul
    // ponticello recording.
    src: localVideo('videos/instruments/violin/arco.mp4'),
  },
  'timpani-stroke-video': {
    id: 'timpani-stroke-video',
    type: 'video',
    title: 'Stroke',
    src: localVideo('videos/instruments/timpani/timpanist_male_default.mp4'),
  },
  'timpani-tremolo-video': {
    id: 'timpani-tremolo-video',
    type: 'video',
    title: 'Tremolo',
    src: localVideo('videos/instruments/timpani/timpanist_male_tremolo.mp4'),
  },
}

// Which anatomy anchor node names (instrument-anatomy.ts) link to which
// techniques. Only the bridge is populated for the violin — every other
// part resolves to no techniques and shows description-only content.
const anatomyPartTechniques: Partial<Record<string, string[]>> = {
  Anchor_Bridge: ['sul-ponticello'],
}

// Timpani has no anchors of its own yet, so these techniques are hung on the
// violin model's chinrest while that model stands in for the timpani.
const instrumentPartTechniques: Partial<Record<OrchestraInstrument, Partial<Record<string, string[]>>>> = {
  timpani: {
    Anchor_Chinrest: ['stroke', 'tremolo'],
  },
}

export function techniqueById(id: string): Technique | undefined {
  return techniques[id]
}

export function demonstrationById(id: string): Demonstration | undefined {
  return demonstrations[id]
}

export function techniqueHasVideo(technique: Technique): boolean {
  return technique.demonstrationIds.some(id => demonstrations[id]?.type === 'video')
}

export function techniquesForAnatomyPart(nodeName: string, instrumentId?: OrchestraInstrument): Technique[] {
  const override = instrumentId ? instrumentPartTechniques[instrumentId] : undefined
  const ids = override ? (override[nodeName] ?? []) : (anatomyPartTechniques[nodeName] ?? [])
  return ids.flatMap(id => {
    const technique = techniques[id]
    return technique ? [technique] : []
  })
}
