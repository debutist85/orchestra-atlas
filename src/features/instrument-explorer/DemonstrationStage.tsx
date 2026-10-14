import { useAnatomyStore } from '../../store/anatomy-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { demonstrationById, techniqueById, techniqueHasVideo, techniquesForAnatomyPart } from './technique'
import { DemonstrationMedia } from './DemonstrationMedia'

type Props = { instrumentId: OrchestraInstrument }

// Off-canvas panel. It mounts as soon as the selected part has a video, while
// it is still closed, so the first Performance click has a painted starting
// position to slide in from. Mounting it in the same update that opens it
// skips that transition. The video itself mounts only while open. Closing it
// is the header Back button (OrchestraMap.tsx).
export function DemonstrationStage({ instrumentId }: Props) {
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const selectedTechniqueId = useAnatomyStore(state => state.selectedTechniqueId)
  const technique = selectedTechniqueId ? techniqueById(selectedTechniqueId) : undefined
  const partHasVideo = selectedPartId
    ? techniquesForAnatomyPart(selectedPartId, instrumentId).some(techniqueHasVideo)
    : false
  if (!partHasVideo) return null

  const demonstrations = technique ? technique.demonstrationIds.flatMap(id => {
    const demonstration = demonstrationById(id)
    return demonstration ? [demonstration] : []
  }) : []

  return (
    <div
      className="absolute top-0 right-0 z-[4] h-full w-[var(--demo-panel-width)] translate-x-full overflow-hidden bg-[var(--stage-background)] transition-transform duration-[0.6s] ease-[var(--demo-panel-ease)] group-data-[demo-open=true]:translate-x-0 motion-reduce:transition-none"
      role="region"
      aria-label={technique ? `${technique.title} demonstration` : 'Demonstration'}
      aria-hidden={demonstrationOpen ? undefined : true}
      inert={!demonstrationOpen}
    >
      {demonstrationOpen && demonstrations.map(demonstration => <DemonstrationMedia key={demonstration.id} demonstration={demonstration} />)}
    </div>
  )
}
