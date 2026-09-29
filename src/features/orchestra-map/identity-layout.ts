import type { OrchestraInstrument } from './config'
import type { FamilyId, NavigationState } from './utils/navigation'

export type IdentityLayout = {
  /** CSS lengths: percentages are relative to the full stage, including chrome. */
  top: string
  left: string
  /** Any CSS font-size value, including clamp(), min(), vw and vh. */
  fontSize: string
  /** Which horizontal point of the heading sits at `left`. */
  anchor: 'left' | 'center' | 'right'
}
export type IdentityLayouts = Record<'portrait' | 'landscape', IdentityLayout>

// Each call creates independent values: editing one subject never changes another.
const familyLayout = (): IdentityLayouts => ({
  portrait: { top: '32%', left: '45%', fontSize: 'clamp(72px, 23vw, 130px)', anchor: 'center' },
  landscape: { top: '27%', left: '39%', fontSize: 'clamp(64px, 11vw, min(180px, 29vh))', anchor: 'center' },
})
const instrumentLayout = (portraitSize = 'clamp(76px, 25vw, 140px)'): IdentityLayouts => ({
  portrait: { top: '30%', left: '45%', fontSize: portraitSize, anchor: 'center' },
  landscape: { top: '25%', left: '36%', fontSize: 'clamp(64px, 13vw, min(210px, 29vh))', anchor: 'center' },
})

/** Stage typography only; no navigation state, camera, or geometry settings. */
export const identityLayouts: {
  orchestra: IdentityLayouts
  families: Record<FamilyId, IdentityLayouts>
  instruments: Record<OrchestraInstrument, IdentityLayouts>
} = {
  orchestra: {
    portrait: { top: 'calc(var(--map-chrome-height) + 13%)', left: '50%', fontSize: 'clamp(60px, 18vw, 100px)', anchor: 'center' },
    landscape: { top: 'calc(var(--map-chrome-height) + 8%)', left: '50%', fontSize: 'clamp(56px, 8vw, min(150px, 25vh))', anchor: 'center' },
  },
  families: {
    strings: familyLayout(),
    woodwinds: familyLayout(),
    brass: familyLayout(),
    percussion: familyLayout(),
    other: familyLayout(),
  },
  instruments: {
    violin: {
      portrait: { top: '34%', left: '-0.4px', fontSize: 'clamp(120px, 42vw, 220px)', anchor: 'left' },
      landscape: { top: '26%', left: '-0.4px', fontSize: 'clamp(64px, 24vw, min(360px, 40vh))', anchor: 'left' },
    },
    violin1: instrumentLayout(),
    violin2: instrumentLayout(),
    viola: instrumentLayout(),
    cello: instrumentLayout(),
    doubleBass: instrumentLayout('clamp(54px, 16vw, 90px)'),
    flute: instrumentLayout(),
    oboe: instrumentLayout(),
    clarinet: instrumentLayout(),
    bassoon: instrumentLayout(),
    horn: instrumentLayout(),
    trumpet: instrumentLayout(),
    trombone: instrumentLayout(),
    tuba: instrumentLayout(),
    percussion: instrumentLayout(),
    timpani: instrumentLayout(),
    pitchedPercussion: instrumentLayout('clamp(42px, 12vw, 68px)'),
    unpitchedPercussion: instrumentLayout('clamp(42px, 12vw, 68px)'),
    harp: instrumentLayout(),
    piano: instrumentLayout(),
    keyboard: instrumentLayout(),
    celesta: instrumentLayout(),
  },
}

export function identityLayoutVariables(navigation: NavigationState): Record<string, string> {
  const layouts = navigation.level === 'orchestra' ? identityLayouts.orchestra
    : navigation.level === 'family' ? identityLayouts.families[navigation.familyId]
    : identityLayouts.instruments[navigation.instrumentId]
  const variables: Record<string, string> = {}
  for (const orientation of ['portrait', 'landscape'] as const) {
    const layout = layouts[orientation]
    variables[`--identity-${orientation}-top`] = layout.top
    variables[`--identity-${orientation}-left`] = layout.left
    variables[`--identity-${orientation}-size`] = layout.fontSize
    variables[`--identity-${orientation}-anchor`] = layout.anchor === 'center' ? '-50%' : layout.anchor === 'right' ? '-100%' : '0%'
  }
  return variables
}
