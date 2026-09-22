import { forwardRef, lazy, Suspense, type Ref } from 'react'

import type { InstrumentExperience } from './explorable-instruments'

const ViolinModel = lazy(() => import('./ViolinModel').then(module => ({ default: module.ViolinModel })))

type Props = {
  experience: InstrumentExperience
  loadModel: boolean
  onModelError: () => void
  onModelReady: () => void
  onBack: () => void
  returnRef: Ref<HTMLButtonElement>
}

export const InstrumentExplore = forwardRef<HTMLElement, Props>(function InstrumentExplore(
  { experience, loadModel, onModelError, onModelReady, onBack, returnRef }, ref,
) {
  return <section ref={ref} className="instrument-explore" aria-label={`${experience.name} exploration`}>
    <div className="instrument-explore__model">
      {experience.modelUrl && loadModel
        ? <Suspense fallback={<output className="instrument-explore__status">Preparing 3D model</output>}>
            <ViolinModel url={experience.modelUrl} onReady={onModelReady} onError={onModelError} />
          </Suspense>
        : !experience.modelUrl && <p className="instrument-explore__status">3D model coming soon</p>}
    </div>
    <div className="instrument-explore__chrome">
      <div className="instrument-explore__identity">
        <p>Instrument exploration</p>
        <h2>{experience.name}</h2>
      </div>
      <div className="instrument-explore__actions">
        <button ref={returnRef} type="button" onClick={onBack}>← Back to orchestra</button>
      </div>
    </div>
  </section>
})
