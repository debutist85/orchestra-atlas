import { useAnatomyStore } from '../../store/anatomy-store'
import { demonstrationById, techniqueById } from './technique'
import { DemonstrationMedia } from './DemonstrationMedia'

// Replaces the 3D stage rather than opening a modal: a mobile slide (3D out,
// media in) and a desktop split composition, both in CSS (.instrument-demo*
// in global.css) rather than a GSAP timeline — there is no real asset yet to
// animate onto, so the choreography itself is unverified; the coordination
// and layout are real and ready for when one exists. Closing it (and the
// playback-coordination resume that goes with that) is the single header
// Back button (OrchestraMap.tsx), not a control of its own.
export function DemonstrationStage() {
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const selectedTechniqueId = useAnatomyStore(state => state.selectedTechniqueId)
  const technique = selectedTechniqueId ? techniqueById(selectedTechniqueId) : undefined
  if (!demonstrationOpen || !technique) return null

  const demonstrations = technique.demonstrationIds.flatMap(id => {
    const demonstration = demonstrationById(id)
    return demonstration ? [demonstration] : []
  })

  return (
    <div className="instrument-demo" role="region" aria-label={`${technique.title} demonstration`}>
      <div className="instrument-demo__content">
        <p>Demonstration</p>
        <h2>{technique.title}</h2>
        <p className="instrument-explore__anatomy-description">{technique.description}</p>
        {demonstrations.map(demonstration => <DemonstrationMedia key={demonstration.id} demonstration={demonstration} />)}
      </div>
    </div>
  )
}
