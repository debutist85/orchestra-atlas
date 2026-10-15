import { gsap } from 'gsap'
import { forwardRef, lazy, Suspense, useEffect, useState, useRef, useLayoutEffect, useImperativeHandle, type CSSProperties } from 'react'

import type { InstrumentExperience } from './explorable-instruments'
import { useMediaQuery } from '../../lib/use-media-query'
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
    const stage = root?.querySelector<HTMLElement>('.instrument-explore__stage')
    if (!root || !stage) return
    // The stage is whatever height the overview leaves. An open phone
    // description lengthens that overview, and the phone rail follows this
    // shorter box. A portrait tablet's summary sits in the header, so it
    // shortens the stage the same way.
    const measure = () => {
      root.style.setProperty('--explore-stage-height', `${Math.max(1, stage.clientHeight)}px`)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    measure()
    return () => observer.disconnect()
  }, [])
  const returnToInstrument = useAnatomyStore(state => state.returnToInstrument)
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const anatomyOpen = selectedPartId !== null
  const [performanceContentVisible, setPerformanceContentVisible] = useState(demonstrationOpen)
  if (demonstrationOpen && !performanceContentVisible) setPerformanceContentVisible(true)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const media = gsap.matchMedia()
    media.add({ reduced: '(prefers-reduced-motion: reduce)', normal: '(prefers-reduced-motion: no-preference)' }, context => {
      // CSS owns geometry; one timeline owns progress and boundary visibility.
      // Killing on interruption retains current values for the next transition.
      const timeline = gsap.timeline({
        defaults: { duration: context.conditions?.reduced ? 0 : 0.6, ease: 'power2.inOut' },
        onUpdate: () => root.dispatchEvent(new CustomEvent('instrument-panel-progress', {
          detail: { anatomy: Number(gsap.getProperty(root, '--anatomy-progress')) },
        })),
        onComplete: () => {
          if (!demonstrationOpen) setPerformanceContentVisible(false)
        },
      })
      timeline.to(root, {
        '--anatomy-progress': anatomyOpen ? 1 : 0,
        '--performance-progress': demonstrationOpen ? 1 : 0,
      }, 0)
      const anatomyButton = root.querySelector('.instrument-explore__anatomy .instrument-explore__collapse')
      const performanceButton = root.querySelector('.instrument-explore__demonstration .instrument-explore__collapse')
      if (anatomyButton) timeline.to(anatomyButton, { opacity: anatomyOpen ? 1 : 0 }, 0)
      if (performanceButton) timeline.to(performanceButton, { opacity: demonstrationOpen ? 1 : 0 }, 0)
      return () => { timeline.kill() }
    })
    return () => {
      // Preserve in-flight values; matchMedia.revert would reset progress.
      media.kill(false)
    }
  }, [anatomyOpen, demonstrationOpen])
  // Same 719px portrait line as the phone panel rules in global.css.
  const phonePortrait = useMediaQuery('(max-width: 719px) and (orientation: portrait)')
  // Opening a performance on a phone closes the dropdown, so the stage
  // returns to the full height under the demonstration. Other layouts keep
  // their own summary placement.
  const [trackedDemoOpen, setTrackedDemoOpen] = useState(demonstrationOpen)
  if (demonstrationOpen !== trackedDemoOpen) {
    setTrackedDemoOpen(demonstrationOpen)
    if (demonstrationOpen && phonePortrait) setDescriptionOpen(false)
  }
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
    } as CSSProperties}
    aria-label={`${experience.name} exploration`}
    data-part-open={selectedPartId ? 'true' : 'false'}
    data-demo-open={demonstrationOpen ? 'true' : 'false'}
    data-description-open={descriptionOpen ? 'true' : 'false'}
  >
    <aside className="instrument-explore__chrome relative isolate min-h-0 min-w-0 text-text-primary pt-[calc(var(--map-chrome-height)+170px)] px-[clamp(20px,2.35vw,42px)] pb-[var(--map-footer-height)] opacity-0 translate-y-1.5 explore-stacked:pt-[calc(var(--map-chrome-height)+12px)] explore-stacked:px-5 explore-stacked:pb-4" aria-label={`${experience.name} overview`}>
      <div className="instrument-explore__overview-content relative z-[1] h-full overflow-y-auto">
      {experience.placeholderModel && <p className="relative z-[1] mb-3 text-xs leading-relaxed text-text-primary">Violin placeholder model. Hotspot positions are for testing, not this instrument’s anatomy.</p>}
      <AnatomyPanel instrumentName={experience.name} instrumentId={experience.instrumentId}
        descriptionOpen={descriptionOpen} onToggleDescription={() => setDescriptionOpen(open => !open)} />
      </div>
    </aside>
    <div className="instrument-explore__stage">
      {/* Camera projection reserves the panel area while the canvas stays
          full-size. The shared GSAP timeline supplies panel progress. */}
      <div className="instrument-explore__canvas-frame absolute top-0 left-0">
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
        <DemonstrationStage contentVisible={performanceContentVisible} />
      </div>
    </div>
  </section>
})
