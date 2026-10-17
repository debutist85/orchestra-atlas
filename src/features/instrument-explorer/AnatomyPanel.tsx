import { useAnatomyStore } from '../../store/anatomy-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { anatomyDescription, anatomyLabel } from './instrument-anatomy'
import { demonstrationsFor, partAction, partActions } from './technique'

type Props = { instrumentName: string; instrumentId: OrchestraInstrument }

const mediaLabel = { audio: 'Audio', video: 'Video' } as const

// Shown only while a part is focused; the full-instrument view's titles are
// SpatialTypography. The instrument's own name stays visible here throughout
// the focused view — the part, its actions, and the chosen action's content
// are added below it. Back navigation is the single header Back button
// (OrchestraMap.tsx), which is hierarchy-aware for Explore; this panel has no
// back control of its own. A plain list until the action-node presentation
// is designed.
export function AnatomyPanel({ instrumentName, instrumentId }: Props) {
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const selectedActionId = useAnatomyStore(state => state.selectedActionId)
  const selectAction = useAnatomyStore(state => state.selectAction)
  const openDemonstration = useAnatomyStore(state => state.openDemonstration)
  if (!selectedPartId) return null

  const label = anatomyLabel(selectedPartId)
  const actions = partActions(instrumentId, selectedPartId)
  const action = selectedActionId ? partAction(instrumentId, selectedPartId, selectedActionId) : undefined

  return (
    <div className="instrument-explore__identity instrument-explore__identity--anatomy">
      <h2>{instrumentName}</h2>
      {!action && (
        <div className="instrument-explore__anatomy">
          <h3>{label}</h3>
          <div className="instrument-explore__techniques">
            <ul>
              {actions.map(item => (
                <li key={item.id}>
                  <button type="button" onClick={() => selectAction(item.id, instrumentId)}>
                    {item.title}
                    {item.kind === 'technique' && item.media.length > 0 && (
                      <span className="instrument-explore__action-media"> · {item.media.map(type => mediaLabel[type]).join(', ')}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {action?.kind === 'discover' && (
        <div className="instrument-explore__anatomy">
          <p>Discover</p>
          <h3>{label}</h3>
          <p className="instrument-explore__anatomy-description">{anatomyDescription(selectedPartId) ?? 'Description coming soon.'}</p>
        </div>
      )}
      {action?.kind === 'technique' && (
        <div className="instrument-explore__anatomy">
          <p>Technique</p>
          <h3>{action.title}</h3>
          <p className="instrument-explore__anatomy-description">{action.technique.description}</p>
          {demonstrationsFor(instrumentId, action).length > 0
            ? <button type="button" className="instrument-explore__anatomy-action" onClick={() => openDemonstration(instrumentId)}>Open demonstration</button>
            : <p className="instrument-explore__demo-unavailable">Demonstration not yet available</p>}
        </div>
      )}
    </div>
  )
}
