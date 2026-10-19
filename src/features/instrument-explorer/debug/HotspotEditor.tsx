import { DebugButton } from './DebugButton'
import { useState } from 'react'

import type { OrchestraInstrument } from '../../orchestra-map/config'
import type { CameraPreset } from '../content/anatomy-camera'
import { hotspotConfigPath, hotspotIdError, serializeHotspots } from '../content/hotspots'
import { useHotspotStore } from '../../../store/hotspot-store'

type Props = {
  instrumentId: OrchestraInstrument
  // Both reach into InstrumentModel.tsx's Three.js scene (live camera, focus
  // tween); placement clicks are handled there too, driven by the store.
  captureView: () => { orientation: 'portrait' | 'landscape'; preset: CameraPreset } | undefined
  preview: (id: string) => void
}

const formatVec3 = (values: readonly number[]) => values.map(n => n.toFixed(4)).join(', ')

// Dev-only section of InstrumentModel.tsx's ?debug=true panel. Edits go to the
// hotspot store (and a localStorage draft); the JSON config file itself is
// only changed by exporting and pasting.
export function HotspotEditor({ instrumentId, captureView, preview }: Props) {
  const hotspots = useHotspotStore(state => state.hotspots)
  const savedHotspots = useHotspotStore(state => state.savedHotspots)
  const editingId = useHotspotStore(state => state.editingId)
  const placement = useHotspotStore(state => state.placement)
  const { update, remove, setEditing, setPlacement, discardDraft } = useHotspotStore.getState()
  const [idDraft, setIdDraft] = useState<{ for: string; value: string } | null>(null)
  const [exportStatus, setExportStatus] = useState('')

  const editing = hotspots.find(hotspot => hotspot.id === editingId)
  const json = serializeHotspots(hotspots)
  const dirty = json !== serializeHotspots(savedHotspots)
  const idValue = idDraft && idDraft.for === editing?.id ? idDraft.value : editing?.id ?? ''
  const idError = editing ? hotspotIdError(idValue, hotspots, editing.id) : undefined

  const commitId = () => {
    if (editing && !idError && idValue !== editing.id) update(editing.id, { id: idValue })
    setIdDraft(null)
  }
  const capture = () => {
    const captured = captureView()
    if (!editing || !captured) return
    const { orientation, preset } = captured
    update(editing.id, { view: { ...editing.view, [orientation]: preset } })
  }
  const copy = () => {
    void navigator.clipboard?.writeText(json).then(() => setExportStatus('Copied'), () => setExportStatus('Copy failed'))
  }
  const download = () => {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${instrumentId}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <section className="hotspot-editor grid gap-[0.35rem] border-t border-ivory/25 pt-[0.4rem]" aria-label="Hotspot editor">
      <h3 className="m-0 text-[length:inherit] tracking-[0.08em] uppercase">Hotspot Editor · {instrumentId}</h3>
      <div className="hotspot-editor__row flex flex-wrap gap-[0.3rem]">
        <DebugButton type="button" aria-pressed={placement === 'add'} onClick={() => setPlacement(placement === 'add' ? 'off' : 'add')}>
          {placement === 'add' ? 'Cancel placing' : 'Add hotspot'}
        </DebugButton>
        <DebugButton type="button" onClick={copy}>Copy JSON</DebugButton>
        <DebugButton type="button" onClick={download}>Download</DebugButton>
        {dirty && <DebugButton type="button" onClick={discardDraft}>Discard draft</DebugButton>}
      </div>
      {placement !== 'off' && <p className="m-0">Click/tap the instrument to {placement === 'add' ? 'place a new hotspot' : `move “${editing?.title || editing?.id}”`}.</p>}
      <p className="hotspot-editor__hint m-0 opacity-70 [overflow-wrap:anywhere]">
        {dirty ? 'Unsaved draft — export and save as ' : 'Matches '}<code>{hotspotConfigPath(instrumentId)}</code>{exportStatus && ` · ${exportStatus}`}
      </p>

      {hotspots.length > 0 && (
        <ul className="hotspot-editor__list m-0 grid list-none gap-[0.2rem] p-0">
          {hotspots.map(hotspot => (
            <li key={hotspot.id}>
              <DebugButton type="button" aria-pressed={hotspot.id === editingId} onClick={() => setEditing(hotspot.id === editingId ? null : hotspot.id)}>
                {hotspot.title || hotspot.id}{!hotspot.view && ' · no view'}
              </DebugButton>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="hotspot-editor__form grid gap-[0.3rem]">
          <label className="grid gap-[0.15rem]">
            ID
            <input className="border border-ivory/40 bg-black/40 px-[0.3rem] py-[0.2rem] text-[max(16px,1em)] text-inherit aria-invalid:border-[#e08a7a]"
              value={idValue}
              aria-invalid={idError ? true : undefined}
              onChange={event => setIdDraft({ for: editing.id, value: event.target.value })}
              onBlur={commitId}
              onKeyDown={event => { if (event.key === 'Enter') commitId() }}
            />
          </label>
          {idError && <p className="m-0 text-[#e08a7a]" role="alert">{idError}</p>}
          <label className="grid gap-[0.15rem]">
            Title
            <input className="border border-ivory/40 bg-black/40 px-[0.3rem] py-[0.2rem] text-[max(16px,1em)] text-inherit aria-invalid:border-[#e08a7a]" value={editing.title} onChange={event => update(editing.id, { title: event.target.value })} />
          </label>
          <label className="grid gap-[0.15rem]">
            Description
            <textarea className="border border-ivory/40 bg-black/40 px-[0.3rem] py-[0.2rem] text-[max(16px,1em)] text-inherit aria-invalid:border-[#e08a7a]" rows={3} value={editing.description} onChange={event => update(editing.id, { description: event.target.value })} />
          </label>
          <pre className="m-0 whitespace-pre">{`position: ${formatVec3(editing.position)}${(['landscape', 'portrait'] as const).map(key => {
            const view = editing.view?.[key]
            return view ? `\n${key}: target ${formatVec3(view.target)}\n${' '.repeat(key.length + 2)}camera ${formatVec3(view.position)}` : ''
          }).join('')}`}</pre>
          <div className="hotspot-editor__row flex flex-wrap gap-[0.3rem]">
            <DebugButton type="button" aria-pressed={placement === 'move'} onClick={() => setPlacement(placement === 'move' ? 'off' : 'move')}>
              {placement === 'move' ? 'Cancel move' : 'Reposition'}
            </DebugButton>
            <DebugButton type="button" onClick={capture}>Capture view</DebugButton>
            <DebugButton type="button" onClick={() => preview(editing.id)}>Preview</DebugButton>
            <DebugButton type="button" onClick={() => remove(editing.id)}>Delete</DebugButton>
          </div>
        </div>
      )}
    </section>
  )
}
