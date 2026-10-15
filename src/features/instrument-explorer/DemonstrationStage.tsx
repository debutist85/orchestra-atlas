import { PanelBoundary } from './PanelBoundary'
import { useState } from 'react'

import { useAnatomyStore } from '../../store/anatomy-store'
import { demonstrationById, techniqueById, techniqueHasVideo } from './technique'
import { DemonstrationMedia } from './DemonstrationMedia'

// The trailing child of .instrument-explore__rail. It does not slide on
// its own: the rail carries it in beside Anatomy (below it on phone
// portrait). The shell stays mounted for the life of Explore, so
// the rail's size does not change between parts and the first Performance
// click has a painted start. The parent timeline keeps media mounted during the closing
// slide (contentVisible) so the panel does not travel empty.
export function DemonstrationStage({ contentVisible }: { contentVisible: boolean }) {
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const selectedTechniqueId = useAnatomyStore(state => state.selectedTechniqueId)
  const closeDemonstration = useAnatomyStore(state => state.closeDemonstration)
  const [shownTechniqueId, setShownTechniqueId] = useState<string | null>(null)
  if (selectedTechniqueId && selectedTechniqueId !== shownTechniqueId) setShownTechniqueId(selectedTechniqueId)
  const technique = shownTechniqueId ? techniqueById(shownTechniqueId) : undefined
  const demonstrations = technique && techniqueHasVideo(technique) ? technique.demonstrationIds.flatMap(id => {
    const demonstration = demonstrationById(id)
    return demonstration ? [demonstration] : []
  }) : []

  return (
    <div
      className="instrument-explore__demonstration relative bg-[var(--stage-background)]"
      role="region"
      aria-label={technique ? `${technique.title} demonstration` : 'Demonstration'}
      aria-hidden={demonstrationOpen ? undefined : true}
      inert={!demonstrationOpen}
    >
      {contentVisible && <PanelBoundary label="Close performance panel" onClose={closeDemonstration} />}
      {contentVisible && demonstrations.some(item => item.id === 'prototype-violin-video') && <p className="pointer-events-none absolute inset-x-6 top-[var(--map-chrome-height)] z-[2] bg-black/80 p-3 text-sm text-ivory">Violin test footage — not a demonstration of this instrument or technique.</p>}
      {contentVisible && demonstrations.map(demonstration => <DemonstrationMedia key={demonstration.id} demonstration={demonstration} />)}
    </div>
  )
}
