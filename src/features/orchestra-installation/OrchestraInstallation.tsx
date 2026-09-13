import { useEffect, useRef, useState } from 'react'

import {
  defaultSeatingPreset,
  isSeatingPresetName,
  orchestraScenePresets,
  seatingPresetNames,
  type SeatingPresetName,
  type OrchestraSectionId,
} from './config'
import { OrchestraScene } from './OrchestraScene'

function readInitialSettings() {
  const search = new URLSearchParams(window.location.search)
  const requestedPreset = search.get('preset')
  return {
    preset: isSeatingPresetName(requestedPreset)
      ? requestedPreset
      : defaultSeatingPreset,
    debug: import.meta.env.DEV && search.get('debug') === 'true',
  }
}

export function OrchestraInstallation() {
  const [initialSettings] = useState(readInitialSettings)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OrchestraScene>(null)
  const [preset, setPreset] = useState<SeatingPresetName>(initialSettings.preset)
  const [debug, setDebug] = useState(initialSettings.debug)
  const [previewSection, setPreviewSection] = useState<OrchestraSectionId>('strings')
  const [previewEmphasis, setPreviewEmphasis] = useState(0)
  const [previewOpacity, setPreviewOpacity] = useState(1)
  const [previewActivity, setPreviewActivity] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new OrchestraScene(
      container,
      orchestraScenePresets[defaultSeatingPreset],
      false,
    )
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    sceneRef.current?.update(orchestraScenePresets[preset], debug)
  }, [debug, preset])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    for (const id of Object.keys(orchestraScenePresets[preset].sections) as OrchestraSectionId[]) {
      sceneRef.current?.setSectionVisualState(id, id === previewSection
        ? { emphasis: previewEmphasis, opacity: previewOpacity, activity: previewActivity }
        : { emphasis: 0, opacity: 1, activity: 0 })
    }
  }, [preset, previewSection, previewEmphasis, previewOpacity, previewActivity])

  useEffect(() => {
    if (!import.meta.env.DEV) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable]')) return
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === '1') setPreset('compact')
      if (event.key === '2') setPreset('classical-wide')
      if (event.key === '3') setPreset('installation-spread')
      if (event.key.toLowerCase() === 'd') setDebug((current) => !current)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <main className="orchestra-prototype">
      <h1 className="sr-only">Orchestra Atlas — geometry and camera prototype</h1>
      <div ref={containerRef} className="orchestra-prototype__canvas" />

      {import.meta.env.DEV && (
        <aside className="prototype-tools" aria-label="Prototype development tools">
          <label>
            Seating preset
            <select
              value={preset}
              onChange={(event) => setPreset(event.target.value as SeatingPresetName)}
            >
              {seatingPresetNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="prototype-tools__check">
            <input
              type="checkbox"
              checked={debug}
              onChange={(event) => setDebug(event.target.checked)}
            />
            Debug geometry
          </label>
          <p>1–3 presets · D debug</p>
          <label>
            Preview section
            <select value={previewSection} onChange={event => setPreviewSection(event.target.value as OrchestraSectionId)}>
              {Object.entries(orchestraScenePresets[preset].sections).map(([id, section]) => (
                <option key={id} value={id}>{section.name}</option>
              ))}
            </select>
          </label>
          <label>
            Appearance
            <select value={previewEmphasis} onChange={event => setPreviewEmphasis(Number(event.target.value))}>
              <option value={0}>Neutral</option>
              <option value={1}>Highlighted</option>
              <option value={-1}>Dimmed</option>
            </select>
          </label>
          <label>
            Opacity
            <input type="range" min="0" max="1" step="0.05" value={previewOpacity}
              onChange={event => setPreviewOpacity(Number(event.target.value))} />
          </label>
          <label>
            Activity
            <input type="range" min="0" max="1" step="0.05" value={previewActivity}
              onChange={event => setPreviewActivity(Number(event.target.value))} />
          </label>
          <button type="button" onClick={() => {
            setPreviewEmphasis(0)
            setPreviewOpacity(1)
            setPreviewActivity(0)
          }}>Reset appearance</button>
        </aside>
      )}
    </main>
  )
}
