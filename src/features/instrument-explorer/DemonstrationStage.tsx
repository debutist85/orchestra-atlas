import { useAnatomyStore } from '../../store/anatomy-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { anatomyLabel } from './instrument-anatomy'
import { demonstrationById, techniqueById, techniqueHasVideo, techniquesForAnatomyPart } from './technique'
import { DemonstrationMedia } from './DemonstrationMedia'

type Props = { instrumentId: OrchestraInstrument }

// Off-canvas panel. It mounts as soon as the selected part has a video, while
// it is still closed, so the first Performance click has a painted starting
// position to slide in from. Mounting it in the same update that opens it
// skips that transition. The video itself mounts only while open. Closing it
// is the header Back button (OrchestraMap.tsx) or the local Back below —
// both call closeDemonstration() directly, so neither also closes the
// anatomy part the demonstration was opened from.
export function DemonstrationStage({ instrumentId }: Props) {
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const selectedTechniqueId = useAnatomyStore(state => state.selectedTechniqueId)
  const closeDemonstration = useAnatomyStore(state => state.closeDemonstration)
  const technique = selectedTechniqueId ? techniqueById(selectedTechniqueId) : undefined
  const partHasVideo = selectedPartId
    ? techniquesForAnatomyPart(selectedPartId, instrumentId).some(techniqueHasVideo)
    : false
  if (!partHasVideo) return null

  const demonstrations = technique ? technique.demonstrationIds.flatMap(id => {
    const demonstration = demonstrationById(id)
    return demonstration ? [demonstration] : []
  }) : []
  const partLabel = selectedPartId ? anatomyLabel(selectedPartId) : undefined

  return (
    <div
      className="absolute top-0 right-0 z-[4] h-full w-[var(--demo-panel-width)] translate-x-full overflow-hidden bg-[var(--stage-background)] transition-transform duration-[0.6s] ease-[var(--demo-panel-ease)] group-data-[demo-open=true]:translate-x-0 motion-reduce:transition-none"
      role="region"
      aria-label={technique ? `${technique.title} demonstration` : 'Demonstration'}
      aria-hidden={demonstrationOpen ? undefined : true}
      inert={!demonstrationOpen}
    >
      {demonstrationOpen && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] flex items-start pt-[calc(var(--map-chrome-height)+env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pl-[max(1.25rem,env(safe-area-inset-left))] max-[719px]:px-4">
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
      {demonstrationOpen && demonstrations.map(demonstration => <DemonstrationMedia key={demonstration.id} demonstration={demonstration} />)}
    </div>
  )
}
