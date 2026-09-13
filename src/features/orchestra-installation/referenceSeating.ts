import type { OrchestraFamily, OrchestraInstrument } from './config'

export type ReferenceSeatingGroup = {
  family: OrchestraFamily
  instrument: OrchestraInstrument
  seats: [number, number][]
}

// Hand-traced symbol centers in the supplied 540 × 312 diagram.
// Each symbol becomes one sphere (including the piano/harp); these are diagram
// positions, not asserted player counts for a canonical orchestral arrangement.
// Coordinates are [image x, image y], with the conductor at [270, 270].
export const referenceSeating: ReferenceSeatingGroup[] = [
  { family: 'strings', instrument: 'violin1', seats: [
    [33, 263], [70, 263], [109, 263],
    [48, 239], [83, 240], [122, 242],
    [68, 213], [99, 218], [128, 224],
    [86, 184], [110, 194], [132, 202],
  ] },
  { family: 'strings', instrument: 'violin2', seats: [
    [157, 264], [200, 266],
    [151, 235], [187, 244],
    [147, 207], [180, 219],
    [137, 177], [167, 195],
    [124, 151], [151, 163], [177, 177],
    [151, 123], [176, 137],
    [179, 99], [196, 113],
  ] },
  { family: 'strings', instrument: 'viola', seats: [
    [339, 266], [374, 265],
    [342, 242], [371, 240],
    [349, 218], [373, 212],
    [357, 190], [380, 185],
    [353, 159], [378, 164],
    [358, 131], [383, 144],
  ] },
  { family: 'strings', instrument: 'cello', seats: [
    [400, 265], [444, 263],
    [405, 237], [441, 237],
    [411, 206], [443, 209],
    [415, 178], [442, 184],
    [418, 149], [439, 160],
  ] },
  { family: 'strings', instrument: 'doubleBass', seats: [
    [490, 258], [486, 227], [477, 195], [464, 165], [449, 138],
  ] },
  { family: 'woodwinds', instrument: 'oboe', seats: [[220, 232], [233, 214]] },
  { family: 'woodwinds', instrument: 'flute', seats: [[301, 233], [310, 214]] },
  { family: 'woodwinds', instrument: 'clarinet', seats: [
    [255, 229], [260, 210], [232, 180], [232, 156], [232, 138],
  ] },
  { family: 'woodwinds', instrument: 'bassoon', seats: [
    [282, 229], [282, 210], [306, 181], [307, 157], [308, 138],
  ] },
  { family: 'brass', instrument: 'horn', seats: [[241, 105], [280, 106], [319, 109]] },
  { family: 'brass', instrument: 'trumpet', seats: [[291, 36], [302, 55], [311, 74]] },
  { family: 'brass', instrument: 'trombone', seats: [[358, 55], [366, 72], [376, 89]] },
  { family: 'brass', instrument: 'tuba', seats: [[413, 96], [430, 108]] },
  { family: 'percussion', instrument: 'timpani', seats: [[220, 43], [253, 40], [239, 66]] },
  { family: 'percussion', instrument: 'percussion', seats: [[91, 113], [131, 82], [174, 58]] },
  { family: 'auxiliary', instrument: 'harp', seats: [[63, 160]] },
  { family: 'auxiliary', instrument: 'piano', seats: [[43, 203]] },
]
