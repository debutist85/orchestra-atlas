import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import gsap from 'gsap'
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

type HintSequenceProps = {
  colors: string[]
  loading: boolean
  name?: string
  orchestra: boolean
  paused: boolean
  onCycle?: () => void
}

function HintSequence({ colors, loading, name, orchestra, paused, onCycle }: HintSequenceProps) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const idleSlotRef = useRef<HTMLSpanElement>(null)
  const preparingSlotRef = useRef<HTMLSpanElement>(null)
  const idleCopyRef = useRef<HTMLSpanElement>(null)
  const preparingCopyRef = useRef<HTMLSpanElement>(null)
  const previousLoading = useRef<boolean | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const idleSlot = idleSlotRef.current
    const preparingSlot = preparingSlotRef.current
    if (!root || !idleSlot || !preparingSlot) return
    // Both text rows participate in sizing, but the real cluster is overlaid.
    // Measure its slots so fonts, wrapping, and responsive gaps stay aligned.
    const measure = () => {
      root.style.setProperty('--hint-idle-x', `${idleSlot.offsetLeft}px`)
      root.style.setProperty('--hint-preparing-x', `${preparingSlot.offsetLeft}px`)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(idleSlot)
    observer.observe(preparingSlot)
    document.fonts.addEventListener('loadingdone', measure)
    return () => {
      observer.disconnect()
      document.fonts.removeEventListener('loadingdone', measure)
    }
  }, [name, orchestra])

  useLayoutEffect(() => {
    const root = rootRef.current
    const idleCopy = idleCopyRef.current
    const preparingCopy = preparingCopyRef.current
    const cluster = root?.querySelector<HTMLElement>('.exploration-hint__cluster')
    const glyph = root?.querySelector<HTMLElement>('.constellation-glyph')
    if (!idleCopy || !preparingCopy || !cluster || !glyph) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let timeline: gsap.core.Timeline | undefined
    const settle = () => {
      timeline?.kill()
      gsap.set(cluster, { '--hint-progress': loading ? 1 : 0 })
      gsap.set(idleCopy, { opacity: loading ? 0 : 1 })
      gsap.set(preparingCopy, { opacity: loading ? 1 : 0 })
      glyph.dataset.animated = String(loading && !reduced.matches)
    }
    const first = previousLoading.current === null
    const changed = previousLoading.current !== loading
    previousLoading.current = loading
    // An unchanged request can be a Strict Mode effect replay on mount.
    if (reduced.matches || (first && !loading) || !changed) settle()
    else {
      if (first) gsap.set(cluster, { '--hint-progress': 0 })
      glyph.dataset.animated = 'false'
      timeline = gsap.timeline()
        .to([idleCopy, preparingCopy], { opacity: 0, duration: 0.18, ease: 'power1.out' })
        .call(() => { glyph.dataset.animated = String(loading) })
        .to(cluster, { '--hint-progress': loading ? 1 : 0, duration: 0.35, ease: 'power1.inOut' })
        .to(loading ? preparingCopy : idleCopy, { opacity: 1, duration: 0.2, ease: 'power1.out' })
    }
    reduced.addEventListener('change', settle)
    return () => {
      // Preserve rendered values on direction changes; reverting would snap.
      timeline?.kill()
      reduced.removeEventListener('change', settle)
    }
  }, [loading])

  return <span ref={rootRef} className="exploration-hint__sequence relative inline-grid min-w-0 max-w-full items-center"
    data-loading={loading} aria-hidden="true">
    <span ref={idleCopyRef} className="exploration-hint__idle col-start-1 row-start-1 flex min-w-0 items-center gap-[8px] [@media(max-width:480px)]:gap-[5px]">
      <span>{orchestra ? 'Or select' : 'Select'}</span>
      <span ref={idleSlotRef} className="inline-block h-[30px] w-[44px] flex-[0_0_44px]" />
      <span>to explore</span>
    </span>
    <span ref={preparingCopyRef} className="exploration-hint__preparing col-start-1 row-start-1 flex min-w-0 items-center gap-[8px] opacity-0 [@media(max-width:480px)]:gap-[5px]">
      <span>Preparing {name ?? 'instrument'}</span>
      <span ref={preparingSlotRef} className="inline-block h-[30px] w-[44px] flex-[0_0_44px]" />
    </span>
    <span className="exploration-hint__cluster absolute top-1/2 left-0 flex h-[30px] w-[44px] items-center">
      {/* The sequence owns data-animated imperatively after its copy fade. */}
      <ConstellationGlyph colors={colors} paused={paused} onCycle={loading ? onCycle : undefined} />
    </span>
  </span>
}

export function ExplorationHint({ state, loading = false, name, orchestra = false, paused = false, onCycle }: {
  state: NavigationState; loading?: boolean; name?: string; orchestra?: boolean; paused?: boolean; onCycle?: () => void
}) {
  return <div className="exploration-hint pointer-events-none flex min-h-[32px] items-center justify-center gap-[8px] font-sans text-[10px] leading-[1.4] tracking-[0.12em] text-navigation uppercase whitespace-nowrap [@media(max-width:480px)]:gap-[5px] [@media(max-width:480px)]:text-[9px] [@media(max-width:480px)]:tracking-[0.08em]" role="status" aria-live="polite" aria-atomic="true">
    <span className="sr-only">{loading ? `Preparing ${name ?? 'instrument'}` : `${orchestra ? 'Or select' : 'Select'} to explore`}</span>
    <HintSequence colors={explorationColors(state)}
      loading={loading} name={name} orchestra={orchestra} paused={paused} onCycle={onCycle} />
  </div>
}
