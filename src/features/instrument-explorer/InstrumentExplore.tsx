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
    {/* The 3D stage only ever shifts for the Anatomy column — opening
        Performance does not push it any further, capped at --stage-shift-cap
        regardless (see global.css). */}
    <div className={`absolute inset-0 transition-transform duration-[0.6s] ease-[var(--demo-panel-ease)] motion-reduce:transition-none ${selectedPartId ? '-translate-x-[min(var(--anatomy-panel-width),var(--stage-shift-cap))]' : ''}`}>
      <div className="instrument-explore__model">
        {experience.modelUrl && loadModel
          ? <Suspense fallback={<output className="instrument-explore__status">Preparing 3D model</output>}>
              <ViolinModel url={experience.modelUrl} onReady={onModelReady} onError={onModelError} />
            </Suspense>
          : !experience.modelUrl && <p className="instrument-explore__status">3D model coming soon</p>}
      </div>
    </div>
    {/* The instrument-description column is a sibling of AnatomyDetailPanel,
        not sharing the stage's wrapper above — it keeps receding alongside
        the anatomy details when Performance opens, even though the stage
        itself has already stopped. Unlike the stage, this is never clamped
        to --stage-shift-cap: the stage is decorative background the
        composition is allowed to crop/overlap, but this is readable text
        that needs to actually clear the Anatomy/Performance columns, not
        settle for however much of that distance the cap allows. On a
        narrower window, where the panel widths sit at their small-screen
        default and two open columns add up to more than the stage is
        willing to vacate for them, this is what's meant to be pushed fully
        off-screen instead — not left overlapping AnatomyDetailPanel.
        The two widths are summed rather than doubling one of them, since
        --anatomy-panel-width and --demonstration-panel-width can now be
        configured independently (global.css) and so may differ. */}
    <div className={`pointer-events-none absolute inset-0 transition-transform duration-[0.6s] ease-[var(--demo-panel-ease)] motion-reduce:transition-none ${demonstrationOpen ? '-translate-x-[calc(var(--anatomy-panel-width)+var(--demonstration-panel-width))]' : selectedPartId ? '-translate-x-[var(--anatomy-panel-width)]' : ''}`}>
      <div className="instrument-explore__chrome pointer-events-none absolute inset-0 z-[2] translate-y-1.5 opacity-0">
        <AnatomyPanel instrumentName={experience.name} instrumentId={experience.instrumentId} />
      </div>
    </div>
    <AnatomyDetailPanel instrumentId={experience.instrumentId} />
    <DemonstrationStage instrumentId={experience.instrumentId} />
  </section>
})
