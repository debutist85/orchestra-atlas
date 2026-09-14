import type { NavigationState } from '../orchestra-installation/navigation'
import { familyName } from '../orchestra-installation/navigation'
import { defaultSeatingPreset, orchestraScenePresets } from '../orchestra-installation/config'
import { familySelection, instrumentCatalog } from '../../store/catalog'
import { effectiveListeningMode, useListeningStore } from '../../store/listening-store'

export function AddListeningSelection({ navigation }: { navigation: NavigationState }) {
  const listening = useListeningStore()
  if (navigation.level === 'orchestra') return null
  const family = navigation.level === 'family'
  const selection = family ? familySelection(navigation.familyId, listening.selectedInstrumentIds)
    : listening.selectedInstrumentIds.includes(navigation.instrumentId) ? 'all' : 'none'
  const name = family ? familyName(orchestraScenePresets[defaultSeatingPreset], navigation.familyId)
    : instrumentCatalog.find(group => group.instrument === navigation.instrumentId)?.name
  return <button type="button" aria-pressed={selection === 'partial' ? 'mixed' : selection === 'all'}
    data-listening-selection={selection}
    onClick={() => {
      if (navigation.level === 'instrument') listening.toggleInstrument(navigation.instrumentId)
      else if (selection === 'all') listening.deselectFamily(navigation.familyId)
      else listening.selectFamily(navigation.familyId)
    }}>
    {selection === 'all' ? 'Remove' : 'Add'} {name}{selection === 'partial' ? ' (some added)' : ''}
  </button>
}

export function ListeningControls() {
  const listening = useListeningStore()
  const mode = effectiveListeningMode(listening)
  const names = instrumentCatalog.filter(group => listening.selectedInstrumentIds.includes(group.instrument)).map(group => group.name)
  return <div className="listening-controls">
    <p className="map-note" role="status">{names.length ? `Listening selection: ${names.join(', ')}` : 'Listening selection: full orchestra'}</p>
    {names.length > 0 && <div role="group" aria-label="Listening mode">
      {(['normal', 'highlight', 'isolate'] as const).map(value => <button type="button" key={value}
        aria-pressed={mode === value} onClick={() => listening.setListeningMode(value)}>
        {value[0].toUpperCase() + value.slice(1)}
      </button>)}
      <button type="button" onClick={listening.clearSelection}>Clear selection</button>
    </div>}
  </div>
}
