import type { OrchestraInstrument } from '../features/orchestra-map/config'

// Explicit design palette. Map geometry uses accent; exploration uses the
// coordinated surface and foreground tokens without runtime color conversion.
export const instrumentColors = {
  violin: {
    accent: "#F0772F",
    surface: "#39271E",
    text: "#F3EBE3",
    muted: "#BDA99B",
  },
  secondViolins: {
    accent: "#F26850",
    surface: "#392321",
    text: "#F3EBE3",
    muted: "#C1A5A0",
  },
  viola: {
    accent: "#F75A71",
    surface: "#392129",
    text: "#F3EBE3",
    muted: "#C4A4AC",
  },
  cello: {
    accent: "#FF0F7B",
    surface: "#371D2A",
    text: "#F3EBE3",
    muted: "#BE9EAB",
  },
  contrabass: {
    accent: "#C8168F",
    surface: "#321D2C",
    text: "#F3EBE3",
    muted: "#B99CAF",
  },
  flute: {
    accent: "#2FD8E8",
    surface: "#193237",
    text: "#F3EBE3",
    muted: "#9CBFC3",
  },
  oboe: {
    accent: "#4A7FD6",
    surface: "#202C3D",
    text: "#F3EBE3",
    muted: "#A1B0C5",
  },
  clarinet: {
    accent: "#376BC9",
    surface: "#1D293B",
    text: "#F3EBE3",
    muted: "#9EACC4",
  },
  bassoon: {
    accent: "#5B45C8",
    surface: "#29233B",
    text: "#F3EBE3",
    muted: "#ADA3C4",
  },
  horn: {
    accent: "#F4D941",
    surface: "#36311D",
    text: "#F3EBE3",
    muted: "#C5BDA0",
  },
  trumpet: {
    accent: "#F0AE3B",
    surface: "#382B1D",
    text: "#F3EBE3",
    muted: "#C6B29B",
  },
  trombone: {
    accent: "#EC8235",
    surface: "#39271C",
    text: "#F3EBE3",
    muted: "#C5AC9A",
  },
  tuba: {
    accent: "#E06028",
    surface: "#37241C",
    text: "#F3EBE3",
    muted: "#C0A698",
  },
  timpani: {
    accent: "#DF9CBC",
    surface: "#35262F",
    text: "#F3EBE3",
    muted: "#C5ACBA",
  },
  pitchedPercussion: {
    accent: "#78509E",
    surface: "#2B2335",
    text: "#F3EBE3",
    muted: "#B0A3BC",
  },
  unpitchedPercussion: {
    accent: "#A76BBB",
    surface: "#302438",
    text: "#F3EBE3",
    muted: "#BAA7C2",
  },
  harp: {
    accent: "#E65763",
    surface: "#382326",
    text: "#F3EBE3",
    muted: "#C2A5A8",
  },
  celesta: {
    accent: "#2CB2BA",
    surface: "#1C3233",
    text: "#F3EBE3",
    muted: "#9DBDBD",
  },
} as const;

export type InstrumentColorTokens = { readonly accent: string; readonly surface: string; readonly text: string; readonly muted: string }

// Keep map grouping aliases separate from instrument exploration identity.
export const instrumentPaletteIds = {
  violin: 'violin', violin1: 'violin', violin2: 'secondViolins',
  viola: 'viola', cello: 'cello', doubleBass: 'contrabass',
  flute: 'flute', oboe: 'oboe', clarinet: 'clarinet', bassoon: 'bassoon',
  horn: 'horn', trumpet: 'trumpet', trombone: 'trombone', tuba: 'tuba',
  timpani: 'timpani', pitchedPercussion: 'pitchedPercussion', unpitchedPercussion: 'unpitchedPercussion',
  harp: 'harp', celesta: 'celesta',
} as const satisfies Partial<Record<OrchestraInstrument, keyof typeof instrumentColors>>

export const explorationNeutralColors = {
  surface: '#252321', text: '#F3EBE3', muted: '#BDA99B',
} as const

const neutralPalette: InstrumentColorTokens = {
  accent: explorationNeutralColors.text,
  ...explorationNeutralColors,
}

export function colorsForInstrument(id: OrchestraInstrument): InstrumentColorTokens {
  const paletteId = (instrumentPaletteIds as Partial<Record<OrchestraInstrument, keyof typeof instrumentColors>>)[id]
  return paletteId ? instrumentColors[paletteId] : neutralPalette
}
