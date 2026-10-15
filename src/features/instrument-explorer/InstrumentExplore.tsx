import { forwardRef, lazy, Suspense, useEffect, useState, useRef, useLayoutEffect, useImperativeHandle, type CSSProperties } from 'react'

import type { InstrumentExperience } from './explorable-instruments'
import { useAnatomyStore } from '../../store/anatomy-store'
import { colorsForInstrument, explorationNeutralColors } from '../../theme/instrument-colors'
import { AnatomyPanel } from './AnatomyPanel'
import { AnatomyDetailPanel } from './AnatomyDetailPanel'
import { DemonstrationStage } from './DemonstrationStage'

const ViolinModel = lazy(() => import('./ViolinModel').then(module => ({ default: module.ViolinModel })))

type Props = {
  experience: InstrumentExperience
  loadModel: boolean
  onModelError: () => void
  onModelReady: () => void
}

export const InstrumentExplore = forwardRef<HTMLElement, Props>(function InstrumentExplore(
  { experience, loadModel, onModelError, onModelReady }, ref,
) {
  const colors = colorsForInstrument(experience.instrumentId)
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  useImperativeHandle(ref, () => rootRef.current!, [])
  useLayoutEffect(() => {
    const root = rootRef.current
    const header = root?.querySelector<HTMLElement>('[data-explore-header]')
    const aside = root?.querySelector<HTMLElement>('aside')
    if (!root || !header || !aside) return
    // Measure the collapsed header, never the animated description, so the
    // canvas keeps its size. On a phone the summary overlaps the canvas;
    // on a portrait tablet it sits beside the title inside this header.
    const measure = () => {
      const style = getComputedStyle(aside)
      const headerHeight = header.offsetHeight + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)
      root.style.setProperty('--explore-stage-height', `${Math.max(1, root.clientHeight - headerHeight)}px`)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    observer.observe(header)
    measure()
    return () => observer.disconnect()
  }, [])
  const returnToInstrument = useAnatomyStore(state => state.returnToInstrument)
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  // Leaving Explore (this component unmounting) always resets anatomy state,
  // so re-entering — this or a different instrument — starts at the general
  // view rather than mid-technique.
  useEffect(() => returnToInstrument, [returnToInstrument])

  return <section
    ref={rootRef}
    className="instrument-explore group"
    style={{
      '--instrument-accent': colors.accent,
      '--instrument-surface': colors.surface,
      '--instrument-text': colors.text,
      '--instrument-muted': colors.muted,
      '--exploration-neutral-surface': explorationNeutralColors.surface,
      '--exploration-neutral-text': explorationNeutralColors.text,
    } as CSSProperties}
    aria-label={`${experience.name} exploration`}
    data-part-open={selectedPartId ? 'true' : 'false'}
    data-demo-open={demonstrationOpen ? 'true' : 'false'}
    data-description-open={descriptionOpen ? 'true' : 'false'}
  >
    <aside className="instrument-explore__chrome min-w-0 overflow-y-auto bg-[var(--exploration-neutral-surface)] text-[color:var(--exploration-neutral-text)] pt-[calc(var(--map-chrome-height)+170px)] px-[clamp(20px,2.35vw,42px)] pb-[var(--map-footer-height)] opacity-0 translate-y-1.5 explore-stacked:pt-[calc(var(--map-chrome-height)+12px)] explore-stacked:px-5 explore-stacked:pb-4" aria-label={`${experience.name} overview`}>
      <AnatomyPanel instrumentName={experience.name} instrumentId={experience.instrumentId}
        descriptionOpen={descriptionOpen} onToggleDescription={() => setDescriptionOpen(open => !open)} />
    </aside>
    <div className="instrument-explore__stage">
      {/* Shrink the canvas as Anatomy opens, alongside the camera zoom —
          landscape and tablet portrait narrow it horizontally by
          --anatomy-panel-width; phone portrait instead shrinks it
          vertically from the bottom by --canvas-anatomy-shift-bottom (half
          the stage height there, 0 everywhere else — global.css), keeping
          it anchored to the top edge above Anatomy's own bottom sheet.
          Hotspots stay correctly placed through either resize:
          ViolinModel.tsx's ResizeObserver watches this same shrinking box
          (whichever dimension changes) and reprojects them every frame.
          Opening Demonstration never resizes this box further. Both panels
          travel together in .instrument-explore__rail; the canvas only fades
          in place behind them
          (instrument-explore__model-canvas--dimmed in ViolinModel.tsx). */}
      <div className={`absolute top-0 left-0 transition-[right,bottom] duration-[0.6s] ease-[var(--demo-panel-ease)] motion-reduce:transition-none ${selectedPartId ? 'right-0 bottom-[var(--canvas-anatomy-shift-bottom)] landscape:right-[var(--anatomy-panel-width)] explore-tablet-portrait:right-[var(--anatomy-panel-width)]' : 'right-0 bottom-0'}`}>
        <div className="instrument-explore__model">
          {experience.modelUrl && loadModel
            ? <Suspense fallback={<output className="instrument-explore__status">Preparing 3D model</output>}>
                <ViolinModel instrumentId={experience.instrumentId} url={experience.modelUrl} onReady={onModelReady} onError={onModelError} />
              </Suspense>
            : !experience.modelUrl && <p className="instrument-explore__status">3D model coming soon</p>}
        </div>
      </div>
      <div className="instrument-explore__rail">
        <AnatomyDetailPanel instrumentId={experience.instrumentId} />
        <DemonstrationStage />
      </div>
    </div>
  </section>
})
