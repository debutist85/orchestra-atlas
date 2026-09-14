import { useEffect, useRef, useState, type CSSProperties } from 'react'

import {
  defaultSeatingPreset,
  isSeatingPresetName,
  orchestraScenePresets,
  seatingPresetNames,
  type SeatingPresetName,
  type OrchestraSectionId,
} from './config'
import { OrchestraScene } from './OrchestraScene'
import { back, familyName, familyInstruments, navigationTargets, type NavigationState } from './navigation'

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

// TODO: Connect onExplore when the instrument explorer route is available.
export function OrchestraInstallation({ onExplore }: { onExplore?: (instrument: string) => void }) {
  const [initialSettings] = useState(readInitialSettings)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OrchestraScene>(null)
  const [preset, setPreset] = useState<SeatingPresetName>(initialSettings.preset)
  const [debug, setDebug] = useState(initialSettings.debug)
  const [hoveredSections, setHoveredSections] = useState<OrchestraSectionId[]>([])
  const [navigation, setNavigation] = useState<NavigationState>({ level: 'orchestra' })
  const contextRef = useRef<HTMLHeadingElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const [sceneError, setSceneError] = useState(false)
  const [previewSection, setPreviewSection] = useState<OrchestraSectionId>('strings')
  const [previewEmphasis, setPreviewEmphasis] = useState(0)
  const [previewOpacity, setPreviewOpacity] = useState(1)
  const [previewActivity, setPreviewActivity] = useState(1)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let scene: OrchestraScene
    try { scene = new OrchestraScene(
      container,
      orchestraScenePresets[defaultSeatingPreset],
      false,
      setHoveredSections,
      setNavigation,
      (id, x, y) => {
        const element = labelsRef.current?.querySelector<HTMLElement>(`[data-target="${id}"]`)
        if (element) { element.style.left = `${x}px`; element.style.top = `${y}px` }
      },
    )
    } catch { queueMicrotask(() => setSceneError(true)); return }
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [])

  useEffect(() => {
    const config = orchestraScenePresets[preset]
    sceneRef.current?.update(config, debug)
  }, [debug, preset])

  useEffect(() => {
    sceneRef.current?.setNavigation(navigation)
    contextRef.current?.focus({ preventScroll: true })
  }, [navigation, preset])

  useEffect(() => {
    if (!import.meta.env.DEV || !debug) return
    for (const id of Object.keys(orchestraScenePresets[preset].sections) as OrchestraSectionId[]) {
      sceneRef.current?.setSectionVisualState(id, id === previewSection
        ? { emphasis: previewEmphasis, opacity: previewOpacity, activity: previewActivity }
        : { emphasis: 0, opacity: 1, activity: 1 })
    }
  }, [debug, preset, previewSection, previewEmphasis, previewOpacity, previewActivity])

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
      <div className="map-context">
        <h1 ref={contextRef} tabIndex={-1}>{navigation.level === 'orchestra' ? 'Orchestra' : navigation.level === 'family'
          ? familyName(orchestraScenePresets[preset], navigation.familyId)
          : familyInstruments(orchestraScenePresets[preset], navigation.familyId).find(group => group.instrument === navigation.instrumentId)?.name}</h1>
      </div>
      <div ref={containerRef} className="orchestra-prototype__canvas" />
      <div ref={labelsRef} className={`map-labels${sceneError ? ' map-labels--fallback' : ''}`} aria-label="Map targets">
        {navigationTargets(orchestraScenePresets[preset], navigation).map(target => (
          <button key={target.id} data-target={target.id} type="button"
            style={{ '--section-color': target.color } as CSSProperties}
            className={navigation.level === 'orchestra' && target.sectionIds.some(id => hoveredSections.includes(id)) ? 'is-highlighted' : undefined}
            onPointerEnter={() => sceneRef.current?.setHoveredTarget(target.state)}
            onPointerLeave={event => {
              if (document.activeElement !== event.currentTarget) sceneRef.current?.setHoveredTarget(null)
            }}
            onFocus={() => sceneRef.current?.setHoveredTarget(target.state)}
            onBlur={() => sceneRef.current?.setHoveredTarget(null)}
            onClick={() => setNavigation(target.state)}>{target.name}</button>
        ))}
      </div>
      {navigation.level !== 'orchestra' && <div className="map-actions">
        <div className="map-actions__buttons">
          <button type="button" onClick={() => setNavigation(back(navigation))}>
            ← {navigation.level === 'instrument' ? familyName(orchestraScenePresets[preset], navigation.familyId) : 'Orchestra'}
          </button>
          {navigation.level === 'instrument' && <button type="button" disabled={!onExplore} onClick={() => onExplore?.(navigation.instrumentId)}>
            Explore {familyInstruments(orchestraScenePresets[preset], navigation.familyId).find(group => group.instrument === navigation.instrumentId)?.name} →
          </button>}
        </div>
        {navigation.level === 'instrument' && !onExplore && <p className="map-note">Instrument exploration coming soon</p>}
      </div>}
      {sceneError && <p className="map-error" role="status">The illuminated map is unavailable. Use the labels to explore.</p>}

      {import.meta.env.DEV && debug && (
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
            setPreviewActivity(1)
          }}>Reset appearance</button>
        </aside>
      )}
    </main>
  )
}
