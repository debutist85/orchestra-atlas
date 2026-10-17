import { useAnatomyStore } from '../../store/anatomy-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { demonstrationsFor, partAction } from './technique'
import { DemonstrationMedia } from './DemonstrationMedia'

// Off-canvas panel. It stays mounted once a technique action has a
// demonstration so it can slide in from the right (and back out) instead of
// popping. The media itself mounts only while open, so it does not play
// off-screen. Closing it is the header Back button (OrchestraMap.tsx).
export function DemonstrationStage({ instrumentId }: { instrumentId: OrchestraInstrument }) {
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const selectedActionId = useAnatomyStore(state => state.selectedActionId)
  const selectedMedia = useAnatomyStore(state => state.selectedMedia)
  const action = selectedPartId && selectedActionId ? partAction(instrumentId, selectedPartId, selectedActionId) : undefined
  const demonstrations = demonstrationsFor(instrumentId, action).filter(demo => demo.type === 'video' && (!selectedMedia || demo.type === selectedMedia))
  if (!action || demonstrations.length === 0) return null

  return (
    <div
      className="instrument-demo"
      role="region"
      aria-label={`${action.title} demonstration`}
      aria-hidden={demonstrationOpen ? undefined : true}
      inert={!demonstrationOpen}
    >
      {demonstrationOpen && demonstrations.map(demonstration => <DemonstrationMedia key={demonstration.id} demonstration={demonstration} />)}
    </div>
  )
}
