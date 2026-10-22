import { orchestraSceneConfig, type OrchestraInstrument } from '../../orchestra-map/config'
import { familyName, type NavigationState } from '../../orchestra-map/utils/navigation'
import { instrumentCatalog } from '../../../store/catalog'
import { mediaUrl } from '../../../lib/media-url'
import type { CameraPreset } from './anatomy-camera'

export type InstrumentExperience = {
  instrumentId: OrchestraInstrument
  name: string
  familyName: string
  description?: string
  modelUrl?: string
  // Turns the model from its authored pose to face the camera (radians,
  // Euler XYZ), applied once at load before it is centered.
  modelRotation: readonly [number, number, number]
  // Opening orbit. Framing keeps this direction and fits the distance to
  // the stage, so the captured distance is only the angle it was taken from.
  initialCamera?: CameraPreset
  // Credits for the 3D model, shown in the explorer; absent for a model
  // without verified provenance (no credits button then).
  modelAttribution?: ModelAttribution
  // A recorded orchestral performance featuring the instrument, opened from
  // the description into the off-canvas panel.
  performance?: InstrumentPerformance
}

// A YouTube video and where in it the instrument is heard.
export type InstrumentPerformance = {
  videoId: string
  startSeconds: number
  performer: string
  ensemble: string
}

// Privacy-enhanced host, autoplay on open (the trigger click is the user
// gesture), and as little player UI as YouTube allows: no control bar
// (clicking the video still pauses and resumes), no fullscreen button or
// keyboard shortcuts, no annotations, related videos only from the same
// channel, inline on iOS. YouTube keeps its title and logo overlays
// regardless; showinfo and modestbranding no longer have any effect.
// enablejsapi (with the page origin) adds no UI; it lets the player report
// when it starts playing, so the panel can fade the picture in then.
export const performanceEmbedOrigin = 'https://www.youtube-nocookie.com'
export function performanceEmbedUrl(performance: InstrumentPerformance, pageOrigin?: string) {
  const params = new URLSearchParams({
    start: String(performance.startSeconds),
    autoplay: '1',
    controls: '0',
    fs: '0',
    disablekb: '1',
    rel: '0',
    iv_load_policy: '3',
    playsinline: '1',
  })
  if (pageOrigin) {
    params.set('enablejsapi', '1')
    params.set('origin', pageOrigin)
  }
  return `${performanceEmbedOrigin}/embed/${performance.videoId}?${params}`
}

// Rights metadata for a model asset, kept here beside its URL rather than in
// the GLB, so a model's credits can change without re-exporting it. Generic
// over source and license: nothing below is specific to Sketchfab or CC BY.
export type ModelAttribution = {
  title: string
  creator: string
  creatorUrl: string
  // The original model's page, and the platform it is on (link text).
  sourceUrl: string
  sourceName?: string
  license: string
  licenseUrl: string
  // What this project changed, as required by licenses like CC BY.
  modifications: string
  copyrightNotice?: string
  disclaimerNotice?: string
  // Changes made by earlier adapters, for a model that is itself an adaptation.
  previousModifications?: string
  // docs/architecture.md, "Licensing Metadata Architecture". Not shown to
  // visitors; an agent must never set 'approved'.
  verificationStatus: 'discovered' | 'researched' | 'requires-review' | 'approved' | 'rejected'
}

const modelUrls: Partial<Record<OrchestraInstrument, string>> = {
  violin: mediaUrl('3d/violin/violin-web-anchors.glb'),
  horn: mediaUrl('3d/horn/horn.glb'),
  trumpet: mediaUrl('3d/trumpet/trumpet.glb'),
  flute: mediaUrl('3d/flute/flute.glb'),
  trombone: mediaUrl('3d/trombone/trombone.glb'),
  // No timpani model yet. The violin GLB stands in so its anchors can host
  // timpani technique tests.
  timpani: mediaUrl('3d/violin/violin-web-anchors.glb'),
}

// Only for a model not authored facing the camera. The violin GLB lies on its
// side, so its front plane is turned square to the camera without adding a
// perspective turn around Y or Z. The horn and trumpet are used as authored.
// The flute and trombone run toward the camera, so a quarter turn around Y lays each across the view.
const violinRotation = [Math.PI / 2, 0, 0] as const
const modelRotations: Partial<Record<OrchestraInstrument, readonly [number, number, number]>> = {
  violin: violinRotation,
  timpani: violinRotation,
  flute: [0, Math.PI / 2, 0],
  trombone: [0, Math.PI / 2, 0],
}
const initialCameras: Partial<Record<OrchestraInstrument, CameraPreset>> = {
  trombone: { target: [0, 0, 0], position: [1.5959, 1.3744, 2.3848] },
}
const noRotation = [0, 0, 0] as const

// Title, creator, source and license as embedded by Sketchfab in each GLB's
// asset metadata (asset.extras). The horn on R2 is byte-identical to its
// Sketchfab download; the trumpet is still a Sketchfab export but has not
// been compared with an original. The flute and trombone are the same kind of Sketchfab export.
// The violin GLB was re-exported from
// Blender with anchors added and carries no source metadata, so it has no
// credits until its provenance is confirmed.
const ccBy4 = { license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' } as const
const presentedAsPublished = 'None to the model file. Shown with this site’s own lighting, camera framing and part labels.'
const modelAttributions: Partial<Record<OrchestraInstrument, ModelAttribution>> = {
  horn: {
    title: 'French Horn',
    creator: 'Bethanycrandallart',
    creatorUrl: 'https://sketchfab.com/Bethanycrandallart',
    sourceUrl: 'https://sketchfab.com/3d-models/french-horn-90cd992fa19a491f902595ad1b4eade9',
    sourceName: 'Sketchfab',
    ...ccBy4,
    modifications: presentedAsPublished,
    verificationStatus: 'requires-review',
  },
  trumpet: {
    title: 'Trumpet',
    creator: 'Kagelok',
    creatorUrl: 'https://sketchfab.com/Kagelok',
    sourceUrl: 'https://sketchfab.com/3d-models/trumpet-1dc9efd37bf14d1b9d1e3de0ca90435c',
    sourceName: 'Sketchfab',
    ...ccBy4,
    modifications: presentedAsPublished,
    verificationStatus: 'requires-review',
  },
  flute: {
    title: 'Basic Flute',
    creator: 'Tealfox64',
    creatorUrl: 'https://sketchfab.com/tealfox64',
    sourceUrl: 'https://sketchfab.com/3d-models/basic-flute-8eb90edf4b6a44e8a400bfd565b37483',
    sourceName: 'Sketchfab',
    ...ccBy4,
    modifications: presentedAsPublished,
    verificationStatus: 'requires-review',
  },
  trombone: {
    title: 'Used Trombone',
    creator: 'sethgordon',
    creatorUrl: 'https://sketchfab.com/sethgordon',
    sourceUrl: 'https://sketchfab.com/3d-models/used-trombone-3709e96c01694bc791b118e2ce534910',
    sourceName: 'Sketchfab',
    ...ccBy4,
    modifications: presentedAsPublished,
    verificationStatus: 'requires-review',
  },
}

const utahSymphony = 'Utah Symphony'
const performances: Partial<Record<OrchestraInstrument, InstrumentPerformance>> = {
  violin: { videoId: 'SfnSamBCMVA', startSeconds: 360, performer: 'Madeline Adkins', ensemble: utahSymphony },
  viola: { videoId: 'ah6pcLZ0v64', startSeconds: 196, performer: 'Brant Bayless', ensemble: utahSymphony },
  cello: { videoId: '7b6Tsh8Bh_g', startSeconds: 427, performer: 'Rainer Eudeikis', ensemble: utahSymphony },
  doubleBass: { videoId: 'f8C7KjI_tuI', startSeconds: 409, performer: 'David Yavornitzky', ensemble: utahSymphony },
  flute: { videoId: 'YMrDGf0g8WM', startSeconds: 323, performer: 'Mercedes Smith', ensemble: utahSymphony },
  oboe: { videoId: '9TffWExcc_w', startSeconds: 410, performer: 'Robert Stephenson', ensemble: utahSymphony },
  clarinet: { videoId: 'rMtHIbbQhHM', startSeconds: 128, performer: 'Tad Calcara', ensemble: utahSymphony },
  bassoon: { videoId: 'HxryMK7fKMA', startSeconds: 225, performer: 'Lori Wike', ensemble: utahSymphony },
  horn: { videoId: 'lg6b4HoGqbY', startSeconds: 491, performer: 'Edmund Rollett', ensemble: utahSymphony },
  trumpet: { videoId: '1MM8jyrzEdI', startSeconds: 316, performer: 'Travis Peterson', ensemble: utahSymphony },
  trombone: { videoId: 'oaeV-SBeKAY', startSeconds: 365, performer: 'Mark Davidson', ensemble: utahSymphony },
  tuba: { videoId: 'GTGaQ5uCC0k', startSeconds: 364, performer: 'Gary Ofenloch', ensemble: utahSymphony },
  timpani: { videoId: 'e7-z8nLhiW4', startSeconds: 329, performer: 'Eric Hopkins', ensemble: utahSymphony },
}

// General orientation for the
// full-instrument view. Pending musical review like the rest of the
// explorer's copy.
const descriptions: Partial<Record<OrchestraInstrument, string>> = {
  violin: 'The smallest and highest-pitched member of the orchestral string family. Known for its expressive, singing tone.',
  viola: 'The middle voice of the string family, larger and lower than the violin. Known for its warm, darker tone.',
  cello: 'The tenor voice of the string family, held upright between the knees. Known for its rich, singing tone.',
  doubleBass: 'The largest and lowest member of the orchestral string family. Known for its deep, weighty tone.',
  flute: 'The highest voice of the woodwind family. Known for its clear, bright tone.',
  oboe: 'A double-reed woodwind just below the flute. Known for its penetrating, reedy tone.',
  clarinet: 'A single-reed woodwind with a wide range. Known for its warm, flexible tone.',
  bassoon: 'The bass voice of the woodwind family, played with a double reed. Known for its reedy, agile low notes.',
  horn: 'A middle voice of the orchestral brass family, between the trumpet and the trombone. Known for its warm, rounded tone.',
  trumpet: 'The highest and brightest voice of the orchestral brass. Known for its brilliant, penetrating tone.',
  trombone: 'A lower brass voice, played with a slide rather than valves. Known for its broad, singing tone.',
  tuba: 'The lowest voice of the orchestral brass. Known for its deep, rounded foundation.',
  timpani: 'Tunable drums that give the orchestra both pitch and pulse. Known for their resonant, dramatic strokes.',
  pitchedPercussion: 'Mallet instruments that sound definite pitches, such as the xylophone. Known for their bright, clear attacks.',
  unpitchedPercussion: 'Drums and cymbals that color the rhythm rather than hold a pitch. Known for their accents and sustained washes.',
  harp: 'A plucked string instrument with a wide span of pitches. Known for its cascading, resonant sound.',
  celesta: 'A keyboard whose hammers strike metal bars. Known for its delicate, bell-like tone.',
}

const experiences = new Map<OrchestraInstrument, InstrumentExperience>(instrumentCatalog.map(instrument => [
  instrument.instrument,
  {
    instrumentId: instrument.instrument,
    name: instrument.name,
    familyName: familyName(orchestraSceneConfig, instrument.familyId),
    description: descriptions[instrument.instrument],
    modelUrl: modelUrls[instrument.instrument],
    modelRotation: modelRotations[instrument.instrument] ?? noRotation,
    initialCamera: initialCameras[instrument.instrument],
    modelAttribution: modelAttributions[instrument.instrument],
    performance: performances[instrument.instrument],
  },
]))

export const violinExperience = experiences.get('violin')!

export function instrumentExperience(navigation: NavigationState) {
  return navigation.level === 'instrument' ? experiences.get(navigation.instrumentId) : undefined
}

export function canExplore(navigation: NavigationState) {
  return instrumentExperience(navigation) !== undefined
}
