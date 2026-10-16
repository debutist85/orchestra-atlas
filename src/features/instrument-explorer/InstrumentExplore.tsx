import { gsap } from 'gsap'
import { forwardRef, lazy, Suspense, useEffect, useId, useState, useRef, useLayoutEffect, useImperativeHandle, type CSSProperties } from 'react'

import type { InstrumentExperience } from './explorable-instruments'
import { useMediaQuery } from '../../lib/use-media-query'
import { useAnatomyStore } from '../../store/anatomy-store'
import { colorsForInstrument, explorationNeutralColors } from '../../theme/instrument-colors'
import { AnatomyPanel } from './AnatomyPanel'
import { AnatomyDetailPanel } from './AnatomyDetailPanel'
import { DemonstrationStage } from './DemonstrationStage'
import { phoneLandscapeQuery } from './experience-motion'
import { instrumentSummary } from './instrument-summary'

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
  const summary = instrumentSummary(experience.instrumentId)
  const descriptionSheetId = useId()
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const phoneLandscape = useMediaQuery(phoneLandscapeQuery)
  const portrait = useMediaQuery('(orientation: portrait)')
  const descriptionSheetOpen = (phoneLandscape || portrait) && descriptionOpen && !!summary
  const rootRef = useRef<HTMLElement>(null)
  useImperativeHandle(ref, () => rootRef.current!, [])
  useLayoutEffect(() => {
    const root = rootRef.current
    const stage = root?.querySelector<HTMLElement>('.instrument-explore__stage')
    const chrome = root?.querySelector<HTMLElement>('.instrument-explore__chrome')
    if (!root || !stage || !chrome) return
    // The stage is whatever height the overview leaves. The overview height
    // lets the canvas continue behind that translucent panel. The description
    // sheet's own height places its chevron on the sliding edge.
    const panels = [...root.querySelectorAll<HTMLElement>('.instrument-explore__anatomy')]
    const sheet = root.querySelector<HTMLElement>('.instrument-explore__description-sheet')
    const measure = () => {
      root.style.setProperty('--explore-stage-height', `${Math.max(1, stage.clientHeight)}px`)
      root.style.setProperty('--explore-overview-height', `${chrome.offsetHeight}px`)
      if (sheet) root.style.setProperty('--description-sheet-height', `${sheet.offsetHeight}px`)
      const panel = panels.find(element => getComputedStyle(element).display !== 'none')
      if (panel) root.style.setProperty('--anatomy-content-height', `${panel.offsetHeight}px`)
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage)
    observer.observe(chrome)
    if (sheet) observer.observe(sheet)
    panels.forEach(panel => observer.observe(panel))
    measure()
    return () => observer.disconnect()
  }, [])
  const returnToInstrument = useAnatomyStore(state => state.returnToInstrument)
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const contextualPrototype = experience.instrumentId === 'violin' && new URLSearchParams(window.location.search).get('constellation') !== 'off'
  const contextualSelected = contextualPrototype && selectedPartId !== null
  const discoveryOpen = useAnatomyStore(state => state.discoveryOpen)
  const techniqueNoteId = useAnatomyStore(state => state.techniqueNoteId)
  const selectedTechniqueId = useAnatomyStore(state => state.selectedTechniqueId)
  const anatomyOpen = selectedPartId !== null && (!contextualSelected || discoveryOpen || techniqueNoteId !== null || demonstrationOpen)
  const [retainedNode, setRetainedNode] = useState<{ partId: string; nodeId: string } | null>(null)
  const currentNodeId = techniqueNoteId ?? (demonstrationOpen ? selectedTechniqueId : discoveryOpen ? 'discover' : null)
  if (contextualSelected && selectedPartId && currentNodeId && (retainedNode?.nodeId !== currentNodeId || retainedNode.partId !== selectedPartId)) {
    setRetainedNode({ partId: selectedPartId, nodeId: currentNodeId })
  }
  const retainedNodeId = retainedNode?.partId === selectedPartId ? retainedNode.nodeId : null
  const [performanceContentVisible, setPerformanceContentVisible] = useState(demonstrationOpen)
  if (demonstrationOpen && !performanceContentVisible) setPerformanceContentVisible(true)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const media = gsap.matchMedia()
    media.add({ reduced: '(prefers-reduced-motion: reduce)', normal: '(prefers-reduced-motion: no-preference)' }, context => {
      // CSS owns geometry; one timeline owns progress and boundary visibility.
      // Killing on interruption retains current values for the next transition.
      const nodeOpen = discoveryOpen || techniqueNoteId !== null || demonstrationOpen
      // Playback stays hidden for the whole close. The flag clears only when
      // this slide finishes, including a reduced-motion settle.
      if (nodeOpen) root.dataset.panelClear = 'false'
      const timeline = gsap.timeline({
        defaults: { duration: context.conditions?.reduced ? 0 : 0.6, ease: 'power2.inOut' },
        onUpdate: () => root.dispatchEvent(new CustomEvent('instrument-panel-progress', {
          detail: {
            anatomy: Number(gsap.getProperty(root, '--anatomy-progress')),
            performance: Number(gsap.getProperty(root, '--performance-progress')),
            description: Number(gsap.getProperty(root, '--description-progress')),
          },
        })),
        onComplete: () => {
          if (!demonstrationOpen) setPerformanceContentVisible(false)
          if (!anatomyOpen) setRetainedNode(null)
          if (!nodeOpen) {
            root.dataset.panelClear = 'true'
            root.dispatchEvent(new CustomEvent('instrument-panel-settled'))
          }
        },
      })
      timeline.to(root, {
        '--anatomy-progress': anatomyOpen ? 1 : 0,
        '--performance-progress': demonstrationOpen ? 1 : 0,
        '--description-progress': descriptionSheetOpen ? 1 : 0,
      }, 0)
      return () => { timeline.kill() }
    })
    return () => {
      // Preserve in-flight values; matchMedia.revert would reset progress.
      media.kill(false)
    }
  }, [anatomyOpen, demonstrationOpen, descriptionSheetOpen, discoveryOpen, techniqueNoteId])
  // The description sheet and Anatomy or a demonstration cover the same
  // part of the stage, in phone landscape and in portrait, so opening either
  // side closes the other. A performance on a phone also closes the sheet so
  // the demonstration can use the stage.
  const [trackedDemoOpen, setTrackedDemoOpen] = useState(demonstrationOpen)
  if (demonstrationOpen !== trackedDemoOpen) {
    setTrackedDemoOpen(demonstrationOpen)
    if (demonstrationOpen && (portrait || phoneLandscape)) setDescriptionOpen(false)
  }
  const [trackedAnatomyOpen, setTrackedAnatomyOpen] = useState(anatomyOpen)
  if (anatomyOpen !== trackedAnatomyOpen) {
    setTrackedAnatomyOpen(anatomyOpen)
    if (anatomyOpen && (portrait || phoneLandscape)) setDescriptionOpen(false)
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
    data-contextual={contextualSelected ? 'true' : 'false'}
    data-part-open={selectedPartId ? 'true' : 'false'}
    data-demo-open={demonstrationOpen ? 'true' : 'false'}
    data-description-open={descriptionOpen ? 'true' : 'false'}
  >
    <aside className="instrument-explore__chrome relative isolate min-h-0 min-w-0 text-text-primary pt-[calc(var(--map-chrome-height)+170px)] px-[clamp(20px,2.35vw,42px)] pb-[var(--map-footer-height)] opacity-0 translate-y-1.5 explore-stacked:pt-[calc(var(--map-chrome-height)+12px)] explore-stacked:px-5 explore-stacked:pb-[calc(var(--explore-chevron-size)/2+1.75rem)]" aria-label={`${experience.name} overview`}>
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
                <ViolinModel retainedNodeId={retainedNodeId} performanceVisible={performanceContentVisible} contextualPrototype={contextualPrototype} instrumentId={experience.instrumentId} url={experience.modelUrl} onReady={onModelReady} onError={onModelError} />
              </Suspense>
            : !experience.modelUrl && <p className="instrument-explore__status">3D model coming soon</p>}
        </div>
      </div>
      <div className="instrument-explore__rail">
        <AnatomyDetailPanel instrumentId={experience.instrumentId} />
        <DemonstrationStage contentVisible={performanceContentVisible} />
      </div>
      {contextualPrototype && <AnatomyDetailPanel instrumentId={experience.instrumentId} contextual />}
    </div>
    {summary && <>
      <div id={descriptionSheetId} className="instrument-explore__description-sheet text-text-primary" role="region"
        aria-label={`${experience.name} description`} inert={!descriptionSheetOpen}>
        <p className="m-0 font-editorial text-base leading-[1.65]">{summary}</p>
      </div>
      <button type="button" className="instrument-explore__description-chevron"
        aria-label={descriptionSheetOpen ? 'Hide description' : 'Show description'}
        aria-expanded={descriptionSheetOpen} aria-controls={descriptionSheetId}
        onClick={() => {
          // The sheet slides into the same third as Anatomy and Demonstration.
          // Opening it closes those panels; opening them closes the sheet.
          if (!descriptionOpen) {
            const state = useAnatomyStore.getState()
            if (contextualPrototype) {
              if (state.techniqueNoteId) state.closeTechniqueNote()
              if (state.discoveryOpen) state.closeDiscovery()
              if (state.demonstrationOpen) state.closeDemonstration()
            } else if (state.selectedPartId) {
              state.returnToInstrument()
            }
          }
          setDescriptionOpen(open => !open)
        }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </>}
  </section>
})
