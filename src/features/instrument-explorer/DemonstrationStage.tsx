import { useAnatomyStore } from '../../store/anatomy-store'
import { demonstrationById, techniqueById } from './technique'
import { DemonstrationMedia } from './DemonstrationMedia'

// Off-canvas panel. It stays mounted once a technique has a demonstration so
// it can slide in from the right (and back out) instead of popping. The
// video itself mounts only while open, so it does not play off-screen.
// Closing it is the header Back button (OrchestraMap.tsx).
export function DemonstrationStage() {
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const selectedTechniqueId = useAnatomyStore(state => state.selectedTechniqueId)
  const technique = selectedTechniqueId ? techniqueById(selectedTechniqueId) : undefined
  if (!technique || technique.demonstrationIds.length === 0) return null

  const demonstrations = technique.demonstrationIds.flatMap(id => {
    const demonstration = demonstrationById(id)
    return demonstration ? [demonstration] : []
  })

  return (
    <div
      className="instrument-demo"
      role="region"
      aria-label={`${technique.title} demonstration`}
      aria-hidden={demonstrationOpen ? undefined : true}
      inert={!demonstrationOpen}
    >
      {demonstrationOpen && demonstrations.map(demonstration => <DemonstrationMedia key={demonstration.id} demonstration={demonstration} />)}
    </div>
  )
}
