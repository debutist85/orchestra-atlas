import { forwardRef, lazy, Suspense, useEffect, useState, useRef, useLayoutEffect, useImperativeHandle } from 'react'

import type { InstrumentExperience } from './explorable-instruments'
import { useAnatomyStore } from '../../store/anatomy-store'
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
  const [descriptionOpen, setDescriptionOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)
  useImperativeHandle(ref, () => rootRef.current!, [])
  useLayoutEffect(() => {
    const root = rootRef.current
    const header = root?.querySelector<HTMLElement>('[data-explore-header]')
    const aside = root?.querySelector<HTMLElement>('aside')
    if (!root || !header || !aside) return
    // Measure the collapsed header, never the animated description. This
    // preserves canvas dimensions while the expanding aside pushes it down.
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
    aria-label={`${experience.name} exploration`}
    data-part-open={selectedPartId ? 'true' : 'false'}
    data-demo-open={demonstrationOpen ? 'true' : 'false'}
    data-description-open={descriptionOpen ? 'true' : 'false'}
  >
    <aside className="instrument-explore__chrome min-w-0 overflow-y-auto bg-[#25231f] pt-[calc(var(--map-chrome-height)+170px)] px-[clamp(20px,2.35vw,42px)] pb-[var(--map-footer-height)] opacity-0 translate-y-1.5 explore-stacked:pt-[calc(var(--map-chrome-height)+12px)] explore-stacked:px-5 explore-stacked:pb-4" aria-label={`${experience.name} overview`}>
      <AnatomyPanel instrumentName={experience.name} instrumentId={experience.instrumentId}
        descriptionOpen={descriptionOpen} onToggleDescription={() => setDescriptionOpen(open => !open)} />
    </aside>
    <div className="instrument-explore__stage">
      {/* Narrow the landscape canvas as Anatomy opens, alongside the camera
          zoom. Portrait keeps a full-width canvas beneath its detail overlay. */}
      <div className={`absolute inset-y-0 left-0 transition-[right] duration-[0.6s] ease-[var(--demo-panel-ease)] motion-reduce:transition-none ${selectedPartId ? 'right-0 landscape:right-[var(--anatomy-panel-width)]' : 'right-0'}`}>
        <div className="instrument-explore__model">
          {experience.modelUrl && loadModel
            ? <Suspense fallback={<output className="instrument-explore__status">Preparing 3D model</output>}>
                <ViolinModel instrumentId={experience.instrumentId} url={experience.modelUrl} onReady={onModelReady} onError={onModelError} />
              </Suspense>
            : !experience.modelUrl && <p className="instrument-explore__status">3D model coming soon</p>}
        </div>
      </div>
      <AnatomyDetailPanel instrumentId={experience.instrumentId} />
      <DemonstrationStage instrumentId={experience.instrumentId} />
    </div>
  </section>
})
