import { previewInstrumentContent, previewTechniqueById } from './preview-instrument-content'
import type { OrchestraInstrument } from '../orchestra-map/config'

// Techniques and demonstrations are modeled separately from anatomy parts —
// a technique may apply to several parts, and keeping them keyed by id
// (rather than embedded inside each anatomy part) avoids duplicating the
// same content if that ever happens.

export type Demonstration =
  | { id: string; type: 'audio'; title?: string; src: string; durationSeconds?: number }
  | { id: string; type: 'video'; title?: string; src: string; poster?: string }
  | { id: string; type: 'interactive'; title?: string; interactionId: string }
  | { id: string; type: 'comparison'; title?: string; comparisonId: string }

export type Technique = {
  id: string
  title: string
  description: string
  mediaIntent?: 'video'
  demonstrationIds: string[]
}

const techniques: Record<string, Technique> = {
  'col-legno': { id: 'col-legno', title: 'Col legno', description: 'In col legno battuto, the player taps the strings with the wood of the bow, creating a light, percussive sound.', demonstrationIds: [] },
  chords: { id: 'chords', title: 'Chords', description: 'The player sounds several strings together or rolls across them to form a chord.', demonstrationIds: [] },
  harmonics: { id: 'harmonics', title: 'Harmonics', description: 'Lightly touching a string at a harmonic node lets a higher partial sound instead of its fundamental.', demonstrationIds: [] },
  arco: { id: 'arco', title: 'Arco', description: 'The player draws the bow hair across the strings to produce a sustained tone.', mediaIntent: 'video', demonstrationIds: ['arco-video'] },
  pizzicato: { id: 'pizzicato', title: 'Pizzicato', description: 'The player plucks a string with a finger instead of using the bow.', mediaIntent: 'video', demonstrationIds: ['prototype-violin-video'] },

  'sul-ponticello': {
    id: 'sul-ponticello',
    title: 'Sul ponticello',
    // Bowing NEAR the bridge, not on it — a real, easy-to-make mistake worth
    // stating explicitly rather than leaving implicit.
    description: 'The player bows very close to the bridge — not on it — emphasizing higher overtones for a bright, glassy sound.',
    demonstrationIds: [],
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

// Local prototype recordings are served from the app origin. Replace with
// mediaUrl() once the recordings are hosted.
function localMedia(path: string) {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

const demonstrations: Record<string, Demonstration> = {
  'shared-technique-audio': {
    id: 'shared-technique-audio', type: 'audio',
    title: 'Shared violin chords placeholder — technique unverified',
    src: localMedia('audio/instruments/violin/chords.ogg'),
    // Measured from the Ogg granule count (385540 samples at 44100 Hz).
    durationSeconds: 385540 / 44100,
  },
  'arco-video': { id: 'arco-video', type: 'video', title: 'Arco', src: localMedia('videos/instruments/violin/arco.mp4') },
  'prototype-violin-video': {
    id: 'prototype-violin-video', type: 'video',
    title: 'Violin test footage — not a demonstration of the selected technique',
    src: localMedia('videos/instruments/violin/arco.mp4'),
  },
  'sul-ponticello-video': {
    id: 'sul-ponticello-video',
    type: 'video',
    title: 'Sul ponticello',
    // Temporary test clip. The file is an arco take, not a verified sul
    // ponticello recording.
    src: localMedia('videos/instruments/violin/arco.mp4'),
  },
  'timpani-stroke-video': {
    id: 'timpani-stroke-video',
    type: 'video',
    title: 'Stroke',
    src: localMedia('videos/instruments/violin/arco.mp4'),
  },
  'timpani-tremolo-video': {
    id: 'timpani-tremolo-video',
    type: 'video',
    title: 'Tremolo',
    src: localMedia('videos/instruments/violin/arco.mp4'),
  },
}

// Which anatomy anchor node names (instrument-anatomy.ts) link to which
// techniques. These relationships are navigation entry points, not exclusive
// claims about where a technique acts on the instrument.
const anatomyPartTechniques: Partial<Record<string, string[]>> = {
  Anchor_Bridge: ['sul-ponticello', 'chords', 'pizzicato'],
  Anchor_Bow: ['col-legno', 'arco'],
  Anchor_Fingerboard: ['harmonics'],
}

// Timpani has no anchors of its own yet, so these techniques are hung on the
// violin model's chinrest while that model stands in for the timpani.
const instrumentPartTechniques: Partial<Record<OrchestraInstrument, Partial<Record<string, string[]>>>> = {
  timpani: {
    Anchor_Chinrest: ['stroke', 'tremolo'],
  },
}

function withPlaceholderAudio(technique: Technique): Technique {
  if (technique.mediaIntent === 'video' || technique.demonstrationIds.includes('shared-technique-audio')) return technique
  return { ...technique, demonstrationIds: [...technique.demonstrationIds, 'shared-technique-audio'] }
}

export function techniqueHasAudio(technique: Technique): boolean {
  return technique.demonstrationIds.some(id => demonstrations[id]?.type === 'audio')
}

export function techniqueById(id: string): Technique | undefined {
  const technique = techniques[id] ?? previewTechniqueById(id)
  return technique ? withPlaceholderAudio(technique) : undefined
}

export function demonstrationById(id: string): Demonstration | undefined {
  return demonstrations[id]
}

export function techniqueHasVideo(technique: Technique): boolean {
  return technique.demonstrationIds.some(id => demonstrations[id]?.type === 'video')
}

export function anatomyPartHasMedia(nodeName: string, instrumentId: OrchestraInstrument): boolean {
  return techniquesForAnatomyPart(nodeName, instrumentId).some(technique =>
    technique.demonstrationIds.some(id => {
      const type = demonstrations[id]?.type
      return type === 'audio' || type === 'video'
    }),
  )
}

export function techniquesForAnatomyPart(nodeName: string, instrumentId?: OrchestraInstrument): Technique[] {
  const preview = instrumentId ? previewInstrumentContent[instrumentId] : undefined
  if (preview) {
    const part = preview.parts[nodeName]
    return part ? [...part.techniques, ...(part.techniqueIds ?? []).flatMap(id => techniques[id] ? [techniques[id]] : [])].map(withPlaceholderAudio) : []
  }
  const override = instrumentId ? instrumentPartTechniques[instrumentId] : undefined
  const ids = override ? (override[nodeName] ?? []) : (anatomyPartTechniques[nodeName] ?? [])
  return ids.flatMap(id => {
    const technique = techniques[id]
    return technique ? [withPlaceholderAudio(technique)] : []
  })
}
