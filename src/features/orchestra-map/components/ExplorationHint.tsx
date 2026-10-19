import type { CSSProperties } from 'react'
import { orchestraSceneConfig as config } from '../config'
import { familyInstruments, type NavigationState } from '../utils/navigation'

function explorationColors(state: NavigationState): string[] {
  const groups = state.level === 'orchestra'
    ? (['strings', 'woodwinds', 'brass', 'percussion'] as const).map(id => config.sections[id].color)
    : familyInstruments(config, state.familyId)
      .filter(group => state.level !== 'instrument' || group.instrument === state.instrumentId)
      .map(group => group.color ?? config.sections[group.sectionId].color)
  return Array.from({ length: 4 }, (_, index) => groups[index % groups.length])
}

export function ConstellationGlyph({ colors, animated = false, paused = false, onCycle }: { colors: string[]; animated?: boolean; paused?: boolean; onCycle?: () => void }) {
  return <span className="constellation-glyph relative inline-block h-[30px] w-[44px] flex-[0_0_44px]" data-animated={animated} data-paused={paused} aria-hidden="true">
    {colors.map((color, index) => <i key={index} onAnimationIteration={index === 0 ? onCycle : undefined} style={{ '--node-color': color, '--phase': index } as CSSProperties} />)}
  </span>
}

export function ExplorationHint({ state, loading = false, name, orchestra = false, paused = false, onCycle }: {
  state: NavigationState; loading?: boolean; name?: string; orchestra?: boolean; paused?: boolean; onCycle?: () => void
}) {
  return <div className="exploration-hint pointer-events-none flex min-h-[32px] items-center justify-center gap-[8px] font-sans text-[10px] leading-[1.4] tracking-[0.12em] text-navigation uppercase whitespace-nowrap [@media(max-width:480px)]:gap-[5px] [@media(max-width:480px)]:text-[9px] [@media(max-width:480px)]:tracking-[0.08em]" role="status" aria-live="polite" aria-atomic="true">
    <span>{loading ? `Preparing ${name}` : orchestra ? 'Or select' : 'Select'}</span>
    <ConstellationGlyph colors={explorationColors(state)} animated={loading} paused={paused} onCycle={onCycle} />
    {!loading && <span>to explore</span>}
  </div>
}
