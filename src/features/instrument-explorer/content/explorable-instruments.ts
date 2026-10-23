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
// (clicking the video still pauses and resumes) or keyboard shortcuts, no
// annotations, related videos only from the same channel, inline on iOS.
// Fullscreen stays allowed: the panel offers its own button for it. YouTube keeps its title and logo overlays
// regardless; showinfo and modestbranding no longer have any effect.
// enablejsapi (with the page origin) adds no UI; it lets the player report
// when it starts playing, so the panel can fade the picture in then.
export const performanceEmbedOrigin = 'https://www.youtube-nocookie.com'
export function performanceEmbedUrl(performance: InstrumentPerformance, pageOrigin?: string) {
  const params = new URLSearchParams({
    start: String(performance.startSeconds),
    autoplay: '1',
    controls: '0',
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

// Rights metadata for a model asset, read from its public license record
// rather than the GLB, so a model's credits can change without re-exporting it. Generic
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

// The one model table: every instrument's model is chosen here and nowhere
// else. Each names the public license record of its asset (public/licenses/),
// which gives the file's path under the media CDN and, once its rights are
// known, the credits shown in the explorer, so the two cannot drift apart.
// `rotation` only for a model not authored facing the camera; `camera` is the
// opening view, authored against that model's geometry.
type ModelConfig = {
  license: string
  rotation?: readonly [number, number, number]
  camera?: CameraPreset
}
const models: Partial<Record<OrchestraInstrument, ModelConfig>> = {
  // Lies on its side: its front plane is turned square to the camera.
  violin: { license: 'violin', rotation: [Math.PI / 2, 0, 0] },
  cello: { license: 'instrument-pack/cello' },
  doubleBass: { license: 'instrument-pack/double-bass' },
  // Deliberately the earlier Basic Flute rather than the pack's. It runs
  // toward the camera, so a quarter turn around Y lays it across the view.
  flute: {
    license: 'flute',
    rotation: [0, Math.PI / 2, 0],
    camera: { target: [0, 0, 0], position: [-44.3396, 40.3268, 41.4444] },
  },
  oboe: { license: 'instrument-pack/oboe', camera: { target: [0, 0, 0], position: [5.3870, 1.8539, -2.4230] } },
  clarinet: { license: 'instrument-pack/clarinet', camera: { target: [0, 0, 0], position: [3.6401, 2.6530, -2.1600] } },
  bassoon: { license: 'instrument-pack/bassoon', camera: { target: [0, 0, 0], position: [3.3919, 1.2637, -3.4655] } },
  // Exported upside down.
  horn: {
    license: 'instrument-pack/horn',
    rotation: [Math.PI, 0, 0],
    camera: { target: [0, 0, 0], position: [3.4504, 1.3227, 0.5287] },
  },
  trumpet: { license: 'instrument-pack/trumpet', camera: { target: [0, 0, 0], position: [3.8354, -1.1959, 2.6253] } },
  trombone: { license: 'instrument-pack/trombone', camera: { target: [0, 0, 0], position: [4.5950, 3.5221, 1.9918] } },
  tuba: { license: 'instrument-pack/tuba', camera: { target: [0, 0, 0], position: [4.4713, 2.9708, 2.3578] } },
  timpani: { license: 'instrument-pack/timpani' },
}
const noRotation = [0, 0, 0] as const

// A public license record. Unknown rights are explicit nulls, as for the
// violin GLB, which carries no source metadata: it has no credits (and no
// credits button) until its provenance is confirmed.
type LicenseRecord = Omit<ModelAttribution, 'license'> & { assetPath: string; license: string | null }
const licenseRecords = import.meta.glob<LicenseRecord>('../../../../public/licenses/**/*.json', {
  eager: true, import: 'default',
})

function modelRecord(instrumentId: OrchestraInstrument) {
  const model = models[instrumentId]
  if (!model) return undefined
  const record = licenseRecords[`../../../../public/licenses/${model.license}.json`]
  if (!record) throw new Error(`No license record public/licenses/${model.license}.json for the ${instrumentId} model`)
  return record
}

// The model asset, relative to public/: what identifies its geometry.
export function modelAssetPath(instrumentId: OrchestraInstrument) {
  return modelRecord(instrumentId)?.assetPath
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

const experiences = new Map<OrchestraInstrument, InstrumentExperience>(instrumentCatalog.map(instrument => {
  const model = models[instrument.instrument]
  const record = modelRecord(instrument.instrument)
  return [
    instrument.instrument,
    {
      instrumentId: instrument.instrument,
      name: instrument.name,
      familyName: familyName(orchestraSceneConfig, instrument.familyId),
      description: descriptions[instrument.instrument],
      modelUrl: record && mediaUrl(record.assetPath),
      modelRotation: model?.rotation ?? noRotation,
      initialCamera: model?.camera,
      modelAttribution: record?.license ? { ...record, license: record.license } : undefined,
      performance: performances[instrument.instrument],
    },
  ]
}))

export const violinExperience = experiences.get('violin')!

export function instrumentExperience(navigation: NavigationState) {
  return navigation.level === 'instrument' ? experiences.get(navigation.instrumentId) : undefined
}

export function canExplore(navigation: NavigationState) {
  return instrumentExperience(navigation) !== undefined
}
