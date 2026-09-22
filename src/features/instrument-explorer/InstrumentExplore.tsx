import { forwardRef, type Ref } from 'react'

import type { InstrumentExperience } from './explorable-instruments'
import { ViolinModel } from './ViolinModel'

type Props = {
  experience: InstrumentExperience
  loadModel: boolean
  onBack: () => void
  returnRef: Ref<HTMLButtonElement>
}

export const InstrumentExplore = forwardRef<HTMLElement, Props>(function InstrumentExplore(
  { experience, loadModel, onBack, returnRef }, ref,
) {
  return <section ref={ref} className="instrument-explore" aria-label={`${experience.name} exploration`}>
    <div className="instrument-explore__model">
      {experience.modelUrl && loadModel
        ? <ViolinModel url={experience.modelUrl} />
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
