import { Component, type ReactNode, forwardRef, lazy, Suspense, useEffect, useState } from 'react'

import type { InstrumentExperience } from './content/explorable-instruments'
import { useAnatomyStore } from '../../store/anatomy-store'
import { DemonstrationStage } from './demonstration/DemonstrationStage'
import { PerformanceStage } from './demonstration/PerformanceStage'
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
  const panelOpen = useAnatomyStore(state => state.demonstrationOpen || state.performanceOpen)
  // Camera angle shared by the model (writer) and the typography (reader).
  const [view] = useState(createInstrumentViewSignal)
  // Leaving Explore (this component unmounting) always resets anatomy state,
  // so re-entering — this or a different instrument — starts at the general
  // view rather than mid-technique.
  useEffect(() => returnToInstrument, [returnToInstrument])

  return <section ref={ref} className="instrument-explore pointer-events-none invisible absolute inset-0 col-start-1 row-[1/4] z-[1] overflow-hidden bg-(--stage-background) opacity-0" aria-label={`${experience.name} exploration`} data-demo-open={panelOpen}>
    <div className="instrument-explore__main absolute inset-0">
      <div className="instrument-explore__model absolute inset-0 origin-center opacity-0 will-change-[transform,opacity]">
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
          : !experience.modelUrl && <p className="instrument-explore__status absolute top-1/2 left-1/2 m-0 text-[#aaa9a3] text-[0.72rem] tracking-[0.08em] uppercase [transform:translate(-50%,-50%)]">3D model coming soon</p>}
      </div>
      <div className="instrument-explore__chrome pointer-events-none absolute inset-0 z-[2] opacity-0">
        <SpatialTypography
          instrumentId={experience.instrumentId}
          familyName={experience.familyName}
          instrumentName={experience.name}
          description={experience.description}
          hasPerformance={!!experience.performance}
          view={view}
        />
        {experience.modelAttribution && <ModelCredits key={experience.instrumentId} attribution={experience.modelAttribution} />}
      </div>
    </div>
    <DemonstrationStage instrumentId={experience.instrumentId} />
    {experience.performance && <PerformanceStage performance={experience.performance} instrumentName={experience.name} />}
  </section>
})
