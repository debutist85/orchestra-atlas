import { useAnatomyStore } from '../../store/anatomy-store'
import { useHotspotStore } from '../../store/hotspot-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { anatomyDescription, anatomyLabel } from './instrument-anatomy'
import { techniqueById, techniquesForAnatomyPart } from './technique'

type Props = { instrumentName: string; instrumentId: OrchestraInstrument }

// The instrument's own name stays visible here throughout — selecting a part
// or technique adds editorial content below it, it never replaces it. Back
// navigation is the single header Back button (OrchestraMap.tsx), which is
// hierarchy-aware for Explore; this panel has no back control of its own.
export function AnatomyPanel({ instrumentName, instrumentId }: Props) {
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const selectedTechniqueId = useAnatomyStore(state => state.selectedTechniqueId)
  const selectTechnique = useAnatomyStore(state => state.selectTechnique)
  const openDemonstration = useAnatomyStore(state => state.openDemonstration)

  // A selected part is either a GLB anchor (content in instrument-anatomy.ts)
  // or a JSON-defined hotspot carrying its own title/description.
  const hotspot = useHotspotStore(state => state.hotspots.find(item => item.id === selectedPartId))
  const label = hotspot ? hotspot.title || hotspot.id : selectedPartId ? anatomyLabel(selectedPartId) : undefined
  const description = hotspot ? hotspot.description || undefined : selectedPartId ? anatomyDescription(selectedPartId) : undefined
  const techniques = selectedPartId ? techniquesForAnatomyPart(selectedPartId, instrumentId) : []
  const technique = selectedTechniqueId ? techniqueById(selectedTechniqueId) : undefined

  return (
    <div className={`instrument-explore__identity${selectedPartId ? ' instrument-explore__identity--anatomy' : ''}`}>
      <h2>{instrumentName}</h2>
      {selectedPartId && !technique && (
        <div className="instrument-explore__anatomy">
          <h3>{label}</h3>
          {description && <p className="instrument-explore__anatomy-description">{description}</p>}
          {techniques.length > 0 && (
            <div className="instrument-explore__techniques">
              <p>Explore techniques</p>
              <ul>
                {techniques.map(item => (
                  <li key={item.id}>
                    <button type="button" onClick={() => selectTechnique(item.id, instrumentId)}>{item.title}</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {technique && (
        <div className="instrument-explore__anatomy">
          <p>Technique</p>
          <h3>{technique.title}</h3>
          <p className="instrument-explore__anatomy-description">{technique.description}</p>
          {technique.demonstrationIds.length > 0
            ? <button type="button" className="instrument-explore__anatomy-action" onClick={openDemonstration}>Open demonstration</button>
            : <p className="instrument-explore__demo-unavailable">Demonstration not yet available</p>}
        </div>
      )}
    </div>
  )
}
