import { forwardRef, lazy, Suspense, useEffect } from 'react'

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
  const returnToInstrument = useAnatomyStore(state => state.returnToInstrument)
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  // Leaving Explore (this component unmounting) always resets anatomy state,
  // so re-entering — this or a different instrument — starts at the general
  // view rather than mid-technique.
  useEffect(() => returnToInstrument, [returnToInstrument])

  return <section
    ref={ref}
    className="instrument-explore group"
    aria-label={`${experience.name} exploration`}
    data-part-open={selectedPartId ? 'true' : 'false'}
    data-demo-open={demonstrationOpen ? 'true' : 'false'}
  >
    <div className={`absolute inset-0 transition-transform duration-[0.6s] ease-[var(--demo-panel-ease)] motion-reduce:transition-none ${demonstrationOpen ? '-translate-x-[calc(var(--demo-panel-width)*2)]' : selectedPartId ? '-translate-x-[var(--demo-panel-width)]' : ''}`}>
      <div className="instrument-explore__model">
        {experience.modelUrl && loadModel
          ? <Suspense fallback={<output className="instrument-explore__status">Preparing 3D model</output>}>
              <ViolinModel url={experience.modelUrl} onReady={onModelReady} onError={onModelError} />
            </Suspense>
          : !experience.modelUrl && <p className="instrument-explore__status">3D model coming soon</p>}
      </div>
      <div className="instrument-explore__chrome pointer-events-none absolute inset-0 z-[2] translate-y-1.5 opacity-0">
        <AnatomyPanel instrumentName={experience.name} instrumentId={experience.instrumentId} />
      </div>
    </div>
    <AnatomyDetailPanel instrumentId={experience.instrumentId} />
    <DemonstrationStage instrumentId={experience.instrumentId} />
  </section>
})
