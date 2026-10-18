import { forwardRef, lazy, Suspense, useEffect } from 'react'

import type { InstrumentExperience } from './explorable-instruments'
import { useAnatomyStore } from '../../store/anatomy-store'
import { AnatomyPanel } from './AnatomyPanel'
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
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  // Leaving Explore (this component unmounting) always resets anatomy state,
  // so re-entering — this or a different instrument — starts at the general
  // view rather than mid-technique.
  useEffect(() => returnToInstrument, [returnToInstrument])

  return <section ref={ref} className="instrument-explore" aria-label={`${experience.name} exploration`} data-demo-open={demonstrationOpen}>
    <div className="instrument-explore__main">
      <div className="instrument-explore__model">
        {experience.modelUrl && loadModel
          ? <Suspense fallback={<output className="instrument-explore__status">Preparing 3D model</output>}>
              <ViolinModel url={experience.modelUrl} instrumentId={experience.instrumentId} onReady={onModelReady} onError={onModelError} />
            </Suspense>
          : !experience.modelUrl && <p className="instrument-explore__status">3D model coming soon</p>}
      </div>
      <div className="instrument-explore__chrome">
        <AnatomyPanel instrumentName={experience.name} instrumentId={experience.instrumentId} />
      </div>
    </div>
    <DemonstrationStage />
  </section>
})
