import { useEffect, useState } from 'react'

import { useAnatomyStore } from '../../store/anatomy-store'
import { anatomyLabel } from './instrument-anatomy'
import { demonstrationById, techniqueById, techniqueHasVideo } from './technique'
import { DemonstrationMedia } from './DemonstrationMedia'

// The trailing child of .instrument-explore__rail. It does not slide on
// its own: the rail carries it in beside Anatomy (below it on phone
// portrait). The shell stays mounted for the life of Explore, so
// the rail's size does not change between parts and the first Performance
// click has a painted start. Closing keeps the media mounted for the 0.6s
// slide (contentVisible) so the panel does not travel empty.
export function DemonstrationStage() {
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const selectedTechniqueId = useAnatomyStore(state => state.selectedTechniqueId)
  const closeDemonstration = useAnatomyStore(state => state.closeDemonstration)
  const [shownPartId, setShownPartId] = useState<string | null>(null)
  const [shownTechniqueId, setShownTechniqueId] = useState<string | null>(null)
  if (selectedPartId && selectedPartId !== shownPartId) setShownPartId(selectedPartId)
  if (selectedTechniqueId && selectedTechniqueId !== shownTechniqueId) setShownTechniqueId(selectedTechniqueId)
  const [contentVisible, setContentVisible] = useState(demonstrationOpen)
  useEffect(() => {
    if (demonstrationOpen) { setContentVisible(true); return }
    // Matches the rail's slide duration (.instrument-explore__rail).
    const timeout = setTimeout(() => setContentVisible(false), 600)
    return () => clearTimeout(timeout)
  }, [demonstrationOpen])
  const technique = shownTechniqueId ? techniqueById(shownTechniqueId) : undefined
  const demonstrations = technique && techniqueHasVideo(technique) ? technique.demonstrationIds.flatMap(id => {
    const demonstration = demonstrationById(id)
    return demonstration ? [demonstration] : []
  }) : []
  const partLabel = shownPartId ? anatomyLabel(shownPartId) : undefined

  return (
    <div
      className="instrument-explore__demonstration relative overflow-hidden bg-[var(--stage-background)]"
      role="region"
      aria-label={technique ? `${technique.title} demonstration` : 'Demonstration'}
      aria-hidden={demonstrationOpen ? undefined : true}
      inert={!demonstrationOpen}
    >
      {contentVisible && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex h-[var(--map-chrome-height)] items-center pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] max-[719px]:px-4">
          {partLabel && (
            <button
              type="button"
              className="pointer-events-auto shrink-0 cursor-pointer border-0 bg-transparent p-0 text-[clamp(0.75rem,1vw,0.9rem)] tracking-[0.08em] text-dust uppercase hover:text-ivory"
              aria-label={`Close this demonstration and return to ${partLabel}`}
              onClick={closeDemonstration}
            >
              <span aria-hidden="true">✕</span> Close
            </button>
          )}
        </div>
      )}
      {contentVisible && demonstrations.map(demonstration => <DemonstrationMedia key={demonstration.id} demonstration={demonstration} />)}
    </div>
  )
}
