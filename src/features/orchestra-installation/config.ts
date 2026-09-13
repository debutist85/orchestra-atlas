export const seatingPresetNames = ['compact', 'classical-wide', 'installation-spread'] as const
export type SeatingPresetName = (typeof seatingPresetNames)[number]
export type OrchestraFamily = 'strings' | 'woodwinds' | 'brass' | 'percussion' | 'auxiliary'
export type OrchestraInstrument =
  | 'conductor'
  | 'violin1' | 'violin2' | 'viola' | 'cello' | 'doubleBass'
  | 'flute' | 'oboe' | 'clarinet' | 'bassoon'
  | 'horn' | 'trumpet' | 'trombone' | 'tuba' | 'percussion' | 'timpani'
  | 'harp' | 'piano'
export type OrchestraSceneConfig = {
  orchestraScale: number
  conductorOrigin: [number, number, number]
  formationRotation: number
  surfaceWarp: { height: number }
  showNodeNumbers: boolean
  playerSpacing: number
  sectionSpacing: number
  equalArcSpacing?: string[][]
  finalCenterlines?: Record<string, string[]>
  finalArcSpacing?: string[][]
  mergedNodeGroups?: {
    id: string
    sources: [string, string]
    endpoints: [string, string]
    radiusScale: number
    spacingScale?: number
    equalizeRadii?: boolean
  }[]
  anchoredArcCompression?: {
    ids: string[]
    anchor: string
    scale: number
  }[]
  hiddenNodeIds?: string[]
  centeredArcSpacing?: {
    ids: [string, string, string]
    gap?: number
    matchSpacingOf?: string[]
  }[]
  strings: {
    innerRadius: number
    rowSpacing: number
    angularSpan: number
    sectionGap: number
    sections: {
      instrument: 'violin1' | 'violin2' | 'viola' | 'cello'
      rowCounts: number[]
      radiusScale: number
      nodeRadiusScales?: Record<string, number>
      nodeAlignments?: Record<string, [number, number][]>
      arcMidpoints?: Record<string, [string, string]>
      hiddenSeats?: string[]
      arcNeighbors?: Record<string, { seat: string; gap: number }>
      insertedArcNodes?: { id: string; after: string; radiusScale: number }[]
      mergedSeats?: { row: number; firstSeat: number; lastSeat: number; radiusScale?: number; alignWithRowEnds?: boolean; alignWithSeats?: [number, number][] }[]
      rowOverrides?: Record<number, {
        rowOffset?: number
        radiusScale: number
        alignOuterEdge?: boolean
        radialFraction?: number
      }>
    }[]
  }
  conductor: { radiusScale: number }
  playerObject: { radius: number }
  familyColors: Record<OrchestraFamily, string>
  camera: { position: [number, number, number]; target: [number, number, number]; fov: number }
}

export const instrumentNames: Record<OrchestraInstrument, string> = {
  conductor: 'Conductor',
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
  // Clockwise in the top-down view, pivoting around the conductor.
  formationRotation: 0,
  // Height of the shallow spherical-cap approximation; use 0 for a flat plane.
  surfaceWarp: { height: -1 },
  showNodeNumbers: true,
  // Player spacing scales the shared radii; section spacing scales the angular gaps.
  playerSpacing: 1,
  sectionSpacing: 1,
  // Display nodes 31, 32, 45, 46, ordered along their shared ring.
  equalArcSpacing: [
    ['violin2-4-4', 'violin2-4-5', 'viola-4-1', 'viola-4-2'],
    ['violin2-3-3', 'violin2-3-4', 'viola-3-1', 'viola-3-2'],
    ['violin2-2-2', 'violin2-2-3', 'viola-2-1', 'viola-2-2'],
  ],
  finalCenterlines: {
    'violin2-5-1': ['violin2-1-1', 'violin2-2-1', 'violin2-3-1', 'violin2-4-1'],
    'violin2-5-5': ['violin2-1-2', 'violin2-2-3', 'violin2-3-4', 'violin2-4-5'],
  },
  finalArcSpacing: [
    ['violin2-5-1', 'violin2-5-inserted-1', 'violin2-5-3', 'violin2-5-5'],
    ['violin2-2-3', 'violin2-2-inserted-1', 'viola-2-1'],
  ],
  mergedNodeGroups: [
    {
      id: 'strings-ring-4-bridge',
      sources: ['violin2-4-5', 'viola-4-1'],
      endpoints: ['violin2-4-4', 'viola-4-2'],
      radiusScale: 0.96 / Math.SQRT2,
      spacingScale: 0.8,
      equalizeRadii: true,
    },
  ],
  anchoredArcCompression: [
    {
      ids: ['viola-5-2', 'viola-5-3', 'viola-5-4'],
      anchor: 'viola-5-4',
      scale: 0.8,
    },
  ],
  hiddenNodeIds: [
    'violin1-5-1',
    'violin1-5-2',
    'violin2-2-2',
    'viola-2-2',
  ],
  centeredArcSpacing: [
    {
      ids: ['violin2-2-3', 'violin2-2-inserted-1', 'viola-2-1'],
      matchSpacingOf: ['violin2-3-3', 'violin2-3-4', 'viola-3-1', 'viola-3-2'],
    },
  ],
  strings: {
    innerRadius: 2.7,
    rowSpacing: 1.2,
    // A slightly closed semicircular fan: 90% of the full 180° opening.
    angularSpan: 162,
    sectionGap: 2,
    sections: [
      {
        instrument: 'violin1', rowCounts: [2, 3, 4, 5, 6], radiusScale: 1,
        // One-based source seats: merge the former nodes 17–18 and 19–20.
        mergedSeats: [
          { row: 5, firstSeat: 3, lastSeat: 4, radiusScale: 1.4 * Math.sqrt(11 / 5) * 1.33 * 0.8 },
          { row: 5, firstSeat: 5, lastSeat: 6, radiusScale: 1.4 * Math.sqrt(11 / 5) * 1.33 * 0.8, alignWithSeats: [[1, 1], [2, 2], [3, 3], [4, 4]] },
        ],
      },
      {
        instrument: 'violin2', rowCounts: [2, 3, 4, 5, 6], radiusScale: 1,
        // One-based "row-seat" keys preserve size edits when display numbers change.
        nodeRadiusScales: { '2-2': 1.15 * 1.2, '2-3': 1.15 * 1.2, '3-3': 1.15 * 1.2, '3-4': 1.15 * 1.2, '4-4': 1.15 * 1.2 * 1.33 * 0.96, '4-5': 1.15 * 1.2 * 1.33 },
        // Former display pairs 33–34, 35–36, 37–38; match the outer viola spheres.
        insertedArcNodes: [
          { id: 'violin2-2-inserted-1', after: 'violin2-2-3', radiusScale: 1.15 * 1.2 },
          { id: 'violin2-5-inserted-1', after: 'violin2-5-1', radiusScale: 1.4 * Math.sqrt(11 / 5) * 0.9 },
        ],
        mergedSeats: [
          { row: 5, firstSeat: 1, lastSeat: 2, radiusScale: 1.4 * Math.sqrt(11 / 5) * 0.9, alignWithSeats: [[1, 2], [2, 2], [3, 2], [4, 2]] },
          { row: 5, firstSeat: 3, lastSeat: 4, radiusScale: 1.4 * Math.sqrt(11 / 5) * 0.9 },
          { row: 5, firstSeat: 5, lastSeat: 6, radiusScale: 1.4 * Math.sqrt(11 / 5) * 1.33 * 0.9, alignWithRowEnds: true },
        ],
      },
      {
        instrument: 'viola', rowCounts: [2, 3, 4, 5, 4], radiusScale: 1.15,
        hiddenSeats: ['5-1'],
        arcMidpoints: { '5-3': ['5-2', '5-4'] },
        nodeRadiusScales: {
          '2-1': 1.2, '2-2': 1.2, '3-1': 1.2, '3-2': 1.2,
          '4-1': 1.2 * 1.33, '4-2': 1.2 * 1.33 * 0.96,
          // Match the current size of nodes 31–33.
          '5-1': 1.4 * Math.sqrt(11 / 5) * 0.9 / 1.15,
          '5-2': 1.4 * Math.sqrt(11 / 5) * 0.9 / 1.15,
          '5-3': 1.4 * Math.sqrt(11 / 5) * 0.9 / 1.15,
          '5-4': 1.4 * Math.sqrt(11 / 5) * 0.9 / 1.15,
        },
        nodeAlignments: {
          '5-1': [[1, 1], [2, 1], [3, 1], [4, 1]],
          '5-4': [[1, 2], [2, 3], [3, 4], [4, 5]],
        },
      },
      {
        // The cello fan uses four progressively wider rings: 2, 3, 4, then 5 seats.
        // Preserve the section's occupied area by scaling its 14 remaining nodes
        // proportionally against the previous 19-seat layout.
        instrument: 'cello', rowCounts: [2, 3, 4, 5], radiusScale: 1.4 * Math.sqrt(19 / 14) * 0.8,
        // Follow the shared ring spacing: nodes 50–58 occupy rings 1–3 and
        // nodes 59–63 occupy ring 4.
        rowOverrides: {
          0: { radiusScale: 1.2 * 0.9 },
          1: { radiusScale: 1.2 * 0.9 },
          2: { radiusScale: 1.2 * 0.9 },
          // Match nodes 59–63 to the current radius of node 47.
          3: {
            radiusScale: Math.sqrt(11 / 5) * 0.9
              / (Math.sqrt(19 / 14) * 0.8),
          },
        },
      },
    ],
  },
  // Appended after the players so their established display numbers stay stable.
  // This closely matches the current radius of node 15.
  conductor: { radiusScale: 2.2 },
  playerObject: { radius: 0.2 },
  familyColors,
  camera: { position: [0, 30, 0], target: [0, 0, 0], fov: 24 },
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
