export const seatingPresetNames = ['compact', 'classical-wide', 'installation-spread'] as const
export type SeatingPresetName = (typeof seatingPresetNames)[number]
export type OrchestraFamily = 'strings' | 'woodwinds' | 'brass' | 'percussion' | 'auxiliary'
export type OrchestraInstrument =
  | 'violin1' | 'violin2' | 'viola' | 'cello' | 'doubleBass'
  | 'flute' | 'oboe' | 'clarinet' | 'bassoon'
  | 'horn' | 'trumpet' | 'trombone' | 'tuba' | 'percussion' | 'timpani'
  | 'harp' | 'piano'
export type OrchestraSceneConfig = {
  orchestraScale: number
  conductorOrigin: [number, number, number]
  playerSpacing: number
  sectionSpacing: number
  strings: {
    innerRadius: number
    rowSpacing: number
    angularSpan: number
    sectionGap: number
    sections: {
      instrument: 'violin1' | 'violin2' | 'viola' | 'cello'
      rowCounts: number[]
      radiusScale: number
    }[]
  }
  playerObject: { radius: number }
  familyColors: Record<OrchestraFamily, string>
  camera: { position: [number, number, number]; target: [number, number, number]; fov: number }
}

export const instrumentNames: Record<OrchestraInstrument, string> = {
  violin1: '1st violins', violin2: '2nd violins', viola: 'Violas', cello: 'Cellos',
  doubleBass: 'Double basses', flute: 'Flutes', oboe: 'Oboes',
  clarinet: 'Clarinets', bassoon: 'Bassoons', horn: 'Horns',
  trumpet: 'Trumpets', trombone: 'Trombones', tuba: 'Tubas', percussion: 'Percussion',
  timpani: 'Timpani', harp: 'Harp', piano: 'Piano',
}
// Shared customizable palette. Auxiliary is a provisional grouping for this diagram.
export const familyColors: Record<OrchestraFamily, string> = {
  strings: '#e85870',
  woodwinds: '#429dcc',
  brass: '#d9b65d',
  percussion: '#a887c4',
  auxiliary: '#72b8a4',
}
const baseline: OrchestraSceneConfig = {
  orchestraScale: 1,
  conductorOrigin: [0, 0, 0],
  // Player spacing scales the shared radii; section spacing scales the angular gaps.
  playerSpacing: 1,
  sectionSpacing: 1,
  strings: {
    innerRadius: 2.7,
    rowSpacing: 1.2,
    angularSpan: 180,
    sectionGap: 2,
    sections: [
      { instrument: 'violin1', rowCounts: [2, 3, 4, 5, 6], radiusScale: 1 },
      { instrument: 'violin2', rowCounts: [2, 3, 4, 5, 6], radiusScale: 1 },
      { instrument: 'viola', rowCounts: [2, 3, 4, 5, 6], radiusScale: 1.15 },
      { instrument: 'cello', rowCounts: [2, 3, 4, 5, 6], radiusScale: 1.4 },
    ],
  },
  playerObject: { radius: 0.2 },
  familyColors,
  camera: { position: [0, 30, 0], target: [0, 0, 0], fov: 38 },
}
export const orchestraScenePresets: Record<SeatingPresetName, OrchestraSceneConfig> = {
  compact: { ...baseline, orchestraScale: 0.9 },
  'classical-wide': baseline,
  'installation-spread': { ...baseline, orchestraScale: 1.08 },
}
export const defaultSeatingPreset: SeatingPresetName = 'classical-wide'
export function isSeatingPresetName(value: string | null): value is SeatingPresetName {
  return seatingPresetNames.some((name) => name === value)
}
