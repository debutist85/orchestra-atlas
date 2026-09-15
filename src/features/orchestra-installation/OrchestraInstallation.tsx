import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

import {
  defaultSeatingPreset,
  isSeatingPresetName,
  orchestraScenePresets,
  seatingPresetNames,
  type SeatingPresetName,
  type OrchestraInstrument,
  type OrchestraSectionId,
} from './config'
import { navigateTo, useNavigationStore } from '../../store/navigation-store'
import { useListeningStore } from '../../store/listening-store'
import { familySelection } from '../../store/catalog'
import { AddListeningSelection, ListeningControls } from '../listening/ListeningControls'
import { OrchestraScene } from './OrchestraScene'
import { familyName, familyInstruments, navigationTargets, sameNavigation, travelingTargetId } from './navigation'
import { labelCornerFor } from './entity-layout'

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
  const [hoveredInstrument, setHoveredInstrument] = useState<OrchestraInstrument | undefined>()
  const canonicalNavigation = useNavigationStore(state => state.navigation)
  const [navigation, setDisplayedNavigation] = useState(canonicalNavigation)
  const departingLabelId = travelingTargetId(navigation, canonicalNavigation)
  const actionsRef = useRef<HTMLDivElement>(null)
  const identityRef = useRef<HTMLDivElement>(null)
  const goBack = useNavigationStore(state => state.goBack)
  const selectedInstrumentIds = useListeningStore(state => state.selectedInstrumentIds)
  const contextRef = useRef<HTMLHeadingElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const [sceneError, setSceneError] = useState(false)
  const [previewSection, setPreviewSection] = useState<OrchestraSectionId>('strings')
  const [previewEmphasis, setPreviewEmphasis] = useState(0)
  const [previewOpacity, setPreviewOpacity] = useState(1)
  const [previewActivity, setPreviewActivity] = useState(1)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    let scene: OrchestraScene
    try { scene = new OrchestraScene(
      container,
      orchestraScenePresets[defaultSeatingPreset],
      false,
      (sections, instrument) => {
        setHoveredSections(sections)
        setHoveredInstrument(instrument)
      },
      navigateTo,
      (id, x, y) => {
        const element = labelsRef.current?.querySelector<HTMLElement>(`[data-target="${id}"]`)
        if (element) { element.style.left = `${x}px`; element.style.top = `${y}px` }
      },
    )
    } catch { queueMicrotask(() => setSceneError(true)); return }
    scene.bindMotionUI({
      labels: labelsRef.current!, identity: identityRef.current!, actions: actionsRef.current!,
      resolve: state => { setDisplayedNavigation(state) },
      settled: () => contextRef.current?.focus({ preventScroll: true }),
    })
    scene.update(orchestraScenePresets[preset], debug)
    scene.setNavigation(useNavigationStore.getState().navigation)
    scene.setListeningSelection(useListeningStore.getState().selectedInstrumentIds)
    sceneRef.current = scene
    return () => {
      scene.dispose()
      sceneRef.current = null
    }
  }, [OrchestraScene]) // Recreate on HMR so caption layout is not stuck on a stale instance.

  useLayoutEffect(() => {
    const config = orchestraScenePresets[preset]
    sceneRef.current?.update(config, debug)
  }, [debug, preset])

  useLayoutEffect(() => {
    if (sceneRef.current) sceneRef.current.setNavigation(canonicalNavigation)
    else setDisplayedNavigation(canonicalNavigation)
  }, [canonicalNavigation, preset, debug])

  useEffect(() => {
    sceneRef.current?.setListeningSelection(selectedInstrumentIds)
  }, [selectedInstrumentIds, preset, debug])

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
      <div ref={identityRef} className="map-context">
        <h1 ref={contextRef} tabIndex={-1}>{navigation.level === 'orchestra' ? 'Orchestra' : navigation.level === 'family'
          ? familyName(orchestraScenePresets[preset], navigation.familyId)
          : familyInstruments(orchestraScenePresets[preset], navigation.familyId).find(group => group.instrument === navigation.instrumentId)?.name}</h1>
      </div>
      <div ref={containerRef} className="orchestra-prototype__canvas" />
      <div ref={labelsRef} className={`map-labels${sceneError ? ' map-labels--fallback' : ''}`} aria-label="Map targets">
        {([
          ...navigationTargets(orchestraScenePresets[preset], navigation).map(target => ({ target, incoming: false })),
          ...(sameNavigation(navigation, canonicalNavigation) ? [] : navigationTargets(orchestraScenePresets[preset], canonicalNavigation)
            .map(target => ({ target, incoming: true }))),
        ]).map(({ target, incoming }, index) => (
          <button key={target.id} data-target={target.id} type="button"
            data-incoming={incoming ? '' : undefined}
            data-label-corner={labelCornerFor(target.id)}
            data-navigation-level={target.state.level}
            data-listening-selection={target.state.level === 'family' ? familySelection(target.state.familyId, selectedInstrumentIds)
              : target.state.level === 'instrument' && selectedInstrumentIds.includes(target.state.instrumentId) ? 'all' : 'none'}
            style={{ '--section-color': target.color, '--gleam-delay': `${index * 0.7}s` } as CSSProperties}
            className={[
              target.state.level === 'instrument'
                ? hoveredInstrument === target.state.instrumentId ? 'is-highlighted' : undefined
                : target.sectionIds.some(id => hoveredSections.includes(id)) ? 'is-highlighted' : undefined,
              !incoming && departingLabelId && target.id !== departingLabelId ? 'is-dismissed' : undefined,
            ].filter(Boolean).join(' ') || undefined}
            onPointerEnter={() => sceneRef.current?.setHoveredTarget(target.state)}
            onPointerLeave={event => {
              if (document.activeElement !== event.currentTarget) sceneRef.current?.setHoveredTarget(null)
            }}
            onFocus={() => sceneRef.current?.setHoveredTarget(target.state)}
            onBlur={() => sceneRef.current?.setHoveredTarget(null)}
            onClick={() => navigateTo(target.state)}>{target.name}
              {target.state.level === 'family' && familySelection(target.state.familyId, selectedInstrumentIds) !== 'none'
                ? <span className="selection-indicator"> · {familySelection(target.state.familyId, selectedInstrumentIds) === 'all' ? 'Added' : 'Some added'}</span>
                : target.state.level === 'instrument' && selectedInstrumentIds.includes(target.state.instrumentId)
                  ? <span className="selection-indicator"> · Added</span> : null}
            </button>
        ))}
      </div>
      <div className="map-actions">
        <ListeningControls />
        <div ref={actionsRef}>
        {navigation.level !== 'orchestra' && <>
        <div className="map-actions__buttons">
          <button type="button" onClick={goBack}>
            ← {navigation.level === 'instrument' ? familyName(orchestraScenePresets[preset], navigation.familyId) : 'Orchestra'}
          </button>
          <AddListeningSelection navigation={navigation} />
          {navigation.level === 'instrument' && <button type="button" disabled={!onExplore} onClick={() => onExplore?.(navigation.instrumentId)}>
            Explore {familyInstruments(orchestraScenePresets[preset], navigation.familyId).find(group => group.instrument === navigation.instrumentId)?.name} →
          </button>}
        </div>
        {navigation.level === 'instrument' && !onExplore && <p className="map-note">Instrument exploration coming soon</p>}
        </>}
        </div>
      </div>
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
