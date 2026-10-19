import { Component, type ReactNode, forwardRef, lazy, Suspense, useEffect, useState } from 'react'

import type { InstrumentExperience } from './content/explorable-instruments'
import { useAnatomyStore } from '../../store/anatomy-store'
import { DemonstrationStage } from './demonstration/DemonstrationStage'
import { createInstrumentViewSignal } from './instrument-view'
import { SpatialTypography } from './typography/SpatialTypography'
import { ModelCredits } from './viewer/ModelCredits'

class ModelBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { this.props.onError() }
  render() { return this.state.failed ? null : this.props.children }
}

type Props = {
  experience: InstrumentExperience
  loadModel: boolean
  onModelError: () => void
  onModelReady: () => void
}

export const InstrumentExplore = forwardRef<HTMLElement, Props>(function InstrumentExplore(
  { experience, loadModel, onModelError, onModelReady }, ref,
) {
  const [InstrumentModel] = useState(() => lazy(() => import('./viewer/InstrumentModel').then(module => ({ default: module.InstrumentModel }))))
  const returnToInstrument = useAnatomyStore(state => state.returnToInstrument)
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  // Camera angle shared by the model (writer) and the typography (reader).
  const [view] = useState(createInstrumentViewSignal)
  // Leaving Explore (this component unmounting) always resets anatomy state,
  // so re-entering — this or a different instrument — starts at the general
  // view rather than mid-technique.
  useEffect(() => returnToInstrument, [returnToInstrument])

  return <section ref={ref} className="instrument-explore" aria-label={`${experience.name} exploration`} data-demo-open={demonstrationOpen}>
    <div className="instrument-explore__main">
      <div className="instrument-explore__model">
        {experience.modelUrl && loadModel
          ? <ModelBoundary onError={onModelError}><Suspense fallback={null}>
              <InstrumentModel
                instrumentId={experience.instrumentId}
                name={experience.name}
                url={experience.modelUrl}
                rotation={experience.modelRotation}
                initialCamera={experience.initialCamera}
                view={view}
                onReady={onModelReady}
                onError={onModelError}
              />
            </Suspense></ModelBoundary>
          : !experience.modelUrl && <p className="instrument-explore__status">3D model coming soon</p>}
      </div>
      <div className="instrument-explore__chrome">
        <SpatialTypography
          instrumentId={experience.instrumentId}
          familyName={experience.familyName}
          instrumentName={experience.name}
          description={experience.description}
          view={view}
        />
        {experience.modelAttribution && <ModelCredits key={experience.instrumentId} attribution={experience.modelAttribution} />}
      </div>
    </div>
    <DemonstrationStage instrumentId={experience.instrumentId} />
  </section>
})
