import type { OrchestraSectionId } from './config'

export type OrchestraNodeDefinition = {
  id: string
  sectionId: OrchestraSectionId
  x: number
  z: number
  radius: number
}

// Canonical Prototype 01A layout. Array order is the visible node numbering.
export const orchestraNodes: readonly OrchestraNodeDefinition[] = [
  { id: 'violin1-1-1', sectionId: 'strings', x: -2.556711, z: -0.867887, radius: 0.2 }, // 1
  { id: 'violin1-1-2', sectionId: 'strings', x: -2.120356, z: -1.671554, radius: 0.2 }, // 2
  { id: 'violin1-2-1', sectionId: 'strings', x: -3.758159, z: -1.042230, radius: 0.2 }, // 3
  { id: 'violin1-2-2', sectionId: 'strings', x: -3.427387, z: -1.860919, radius: 0.2 }, // 4
  { id: 'violin1-2-3', sectionId: 'strings', x: -2.920927, z: -2.584218, radius: 0.2 }, // 5
  { id: 'violin1-3-1', sectionId: 'strings', x: -4.951188, z: -1.223003, radius: 0.2 }, // 6
  { id: 'violin1-3-2', sectionId: 'strings', x: -4.672559, z: -2.043819, radius: 0.2 }, // 7
  { id: 'violin1-3-3', sectionId: 'strings', x: -4.258949, z: -2.805594, radius: 0.2 }, // 8
  { id: 'violin1-3-4', sectionId: 'strings', x: -3.722307, z: -3.486321, radius: 0.2 }, // 9
  { id: 'violin1-4-1', sectionId: 'strings', x: -6.140996, z: -1.406476, radius: 0.2 }, // 10
  { id: 'violin1-4-2', sectionId: 'strings', x: -5.893297, z: -2.226892, radius: 0.2 }, // 11
  { id: 'violin1-4-3', sectionId: 'strings', x: -5.536548, z: -3.0061, radius: 0.2 }, // 12
  { id: 'violin1-4-4', sectionId: 'strings', x: -5.077348, z: -3.729683, radius: 0.2 }, // 13
  { id: 'violin1-4-5', sectionId: 'strings', x: -4.524196, z: -4.384251, radius: 0.2 }, // 14
  { id: 'violin1-5-3', sectionId: 'keyboard-instruments', x: -6.591128, z: -3.578691, radius: 0.441887 }, // 15
  { id: 'violin1-5-5', sectionId: 'plucked-instruments', x: -5.885049, z: -4.649323, radius: 0.441887 }, // 16
  { id: 'violin2-1-1', sectionId: 'strings', x: -1.36019, z: -2.332356, radius: 0.2 }, // 17
  { id: 'violin2-1-2', sectionId: 'strings', x: -0.503615, z: -2.652616, radius: 0.2 }, // 18
  { id: 'violin2-2-1', sectionId: 'strings', x: -2.152554, z: -3.252155, radius: 0.2 }, // 19
  { id: 'violin2-2-3', sectionId: 'woodwinds', x: -0.919383, z: -3.790084, radius: 0.276 }, // 20
  { id: 'violin2-2-inserted-1', sectionId: 'woodwinds', x: 0, z: -3.9, radius: 0.276 }, // 21
  { id: 'violin2-3-1', sectionId: 'strings', x: -2.934347, z: -4.171284, radius: 0.2 }, // 22
  { id: 'violin2-3-2', sectionId: 'strings', x: -2.185559, z: -4.607964, radius: 0.2 }, // 23
  { id: 'violin2-3-3', sectionId: 'woodwinds', x: -1.373634, z: -4.91153, radius: 0.276 }, // 24
  { id: 'violin2-3-4', sectionId: 'woodwinds', x: -0.462965, z: -5.078943, radius: 0.276 }, // 25
  { id: 'violin2-4-1', sectionId: 'strings', x: -3.711937, z: -5.090336, radius: 0.2 }, // 26
  { id: 'violin2-4-2', sectionId: 'strings', x: -2.986756, z: -5.547007, radius: 0.2 }, // 27
  { id: 'violin2-4-3', sectionId: 'strings', x: -2.206307, z: -5.901035, radius: 0.2 }, // 28
  { id: 'violin2-4-4', sectionId: 'brass', x: -1.111305, z: -6.20121, radius: 0.352397 }, // 29
  { id: 'strings-ring-4-bridge', sectionId: 'brass', x: 0, z: -6.3, radius: 0.352397 }, // 30
  { id: 'violin2-5-1', sectionId: 'percussion', x: -4.494302, z: -6.004269, radius: 0.373776 }, // 31
  { id: 'violin2-5-inserted-1', sectionId: 'percussion', x: -3.249714, z: -6.75939, radius: 0.373776 }, // 32
  { id: 'violin2-5-3', sectionId: 'percussion', x: -1.882694, z: -7.259853, radius: 0.373776 }, // 33
  { id: 'violin2-5-5', sectionId: 'percussion', x: -0.444744, z: -7.486802, radius: 0.497123 }, // 34
  { id: 'viola-1-1', sectionId: 'strings', x: 0.503615, z: -2.652616, radius: 0.23 }, // 35
  { id: 'viola-1-2', sectionId: 'strings', x: 1.36019, z: -2.332356, radius: 0.23 }, // 36
  { id: 'viola-2-1', sectionId: 'woodwinds', x: 0.919383, z: -3.790084, radius: 0.276 }, // 37
  { id: 'viola-2-3', sectionId: 'strings', x: 2.152554, z: -3.252155, radius: 0.23 }, // 38
  { id: 'viola-3-1', sectionId: 'woodwinds', x: 0.462965, z: -5.078943, radius: 0.276 }, // 39
  { id: 'viola-3-2', sectionId: 'woodwinds', x: 1.373634, z: -4.91153, radius: 0.276 }, // 40
  { id: 'viola-3-3', sectionId: 'strings', x: 2.185559, z: -4.607964, radius: 0.23 }, // 41
  { id: 'viola-3-4', sectionId: 'strings', x: 2.934347, z: -4.171284, radius: 0.23 }, // 42
  { id: 'viola-4-2', sectionId: 'brass', x: 1.111305, z: -6.20121, radius: 0.352397 }, // 43
  { id: 'viola-4-3', sectionId: 'strings', x: 2.206307, z: -5.901035, radius: 0.23 }, // 44
  { id: 'viola-4-4', sectionId: 'strings', x: 2.986756, z: -5.547007, radius: 0.23 }, // 45
  { id: 'viola-4-5', sectionId: 'strings', x: 3.711937, z: -5.090336, radius: 0.23 }, // 46
  { id: 'viola-5-2', sectionId: 'brass', x: 2.548304, z: -7.053804, radius: 0.373776 }, // 47
  { id: 'viola-5-3', sectionId: 'brass', x: 3.560191, z: -6.601139, radius: 0.373776 }, // 48
  { id: 'viola-5-4', sectionId: 'brass', x: 4.494302, z: -6.004269, radius: 0.373776 }, // 49
  { id: 'cello-1-1', sectionId: 'strings', x: 2.120356, z: -1.671554, radius: 0.281828 }, // 50
  { id: 'cello-1-2', sectionId: 'strings', x: 2.556711, z: -0.867887, radius: 0.281828 }, // 51
  { id: 'cello-2-1', sectionId: 'strings', x: 2.920927, z: -2.584218, radius: 0.281828 }, // 52
  { id: 'cello-2-2', sectionId: 'strings', x: 3.427387, z: -1.860919, radius: 0.281828 }, // 53
  { id: 'cello-2-3', sectionId: 'strings', x: 3.758159, z: -1.04223, radius: 0.281828 }, // 54
  { id: 'cello-3-1', sectionId: 'strings', x: 3.722307, z: -3.486321, radius: 0.281828 }, // 55
  { id: 'cello-3-2', sectionId: 'strings', x: 4.258949, z: -2.805594, radius: 0.281828 }, // 56
  { id: 'cello-3-3', sectionId: 'strings', x: 4.672559, z: -2.043819, radius: 0.281828 }, // 57
  { id: 'cello-3-4', sectionId: 'strings', x: 4.951188, z: -1.223003, radius: 0.281828 }, // 58
  { id: 'cello-4-1', sectionId: 'strings', x: 4.524196, z: -4.384251, radius: 0.373776 }, // 59
  { id: 'cello-4-2', sectionId: 'strings', x: 5.077348, z: -3.729683, radius: 0.373776 }, // 60
  { id: 'cello-4-3', sectionId: 'strings', x: 5.536548, z: -3.0061, radius: 0.373776 }, // 61
  { id: 'cello-4-4', sectionId: 'strings', x: 5.893297, z: -2.226892, radius: 0.373776 }, // 62
  { id: 'cello-4-5', sectionId: 'strings', x: 6.140996, z: -1.406476, radius: 0.373776 }, // 63
  { id: 'conductor', sectionId: 'conductor', x: 0, z: 0, radius: 0.44 }, // 64
]
