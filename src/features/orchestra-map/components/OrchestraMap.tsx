import {
  useEffect, useLayoutEffect, useRef, useState,
  type AnimationEvent, type CSSProperties, type PointerEvent, type TransitionEvent,
} from 'react'

import {
  defaultSeatingPreset,
  isSeatingPresetName,
  orchestraScenePresets,
  seatingPresetNames,
  type SeatingPresetName,
  type OrchestraInstrument,
  type OrchestraSectionId,
} from '../config'
import { navigateTo, useNavigationStore } from '../../../store/navigation-store'
import { useListeningLoadStore } from '../../../store/listening-load-store'
import { PlaybackControls } from '../../listening/PlaybackControls'
import { FullOrchestraLock } from '../../listening/FullOrchestraLock'
import { ListeningDiagnostics } from '../../listening/ListeningDiagnostics'
import { listeningEngine } from '../../listening/listening-engine'
import { OrchestraScene } from '../three/OrchestraScene'
import { familyName, familyInstruments, mapLabels, sameNavigation, travelingTargetId } from '../utils/navigation'
import { labelCornerFor } from '../utils/entity-layout'

// Shortest time the launch count may take to reach 100, so it reads as a
// count rather than a flash when everything is already cached.
const LAUNCH_COUNT_MS = 1000

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

export function OrchestraMap() {
  const [initialSettings] = useState(readInitialSettings)
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OrchestraScene>(null)
  const [preset, setPreset] = useState<SeatingPresetName>(initialSettings.preset)
  const [debug, setDebug] = useState(initialSettings.debug)
  const [hoveredSections, setHoveredSections] = useState<OrchestraSectionId[]>([])
  const [hoveredInstrument, setHoveredInstrument] = useState<OrchestraInstrument | undefined>()
  const canonicalNavigation = useNavigationStore(state => state.navigation)
  const [navigation, setDisplayedNavigation] = useState(canonicalNavigation)
  const contextName = navigation.level === 'orchestra' ? 'Orchestra' : navigation.level === 'family'
    ? familyName(orchestraScenePresets[preset], navigation.familyId)
    : familyInstruments(orchestraScenePresets[preset], navigation.familyId).find(group => group.instrument === navigation.instrumentId)?.name
  const departingLabelId = travelingTargetId(navigation, canonicalNavigation)
  const actionsRef = useRef<HTMLDivElement>(null)
  const identityRef = useRef<HTMLDivElement>(null)
  const goBack = useNavigationStore(state => state.goBack)
  const loadStatus = useListeningLoadStore(state => state.status)
  const contextRef = useRef<HTMLHeadingElement>(null)
  const labelsRef = useRef<HTMLDivElement>(null)
  const [sceneError, setSceneError] = useState(false)
  // The scene builds and renders its first frame synchronously in its
  // constructor (no async asset loading), so this simply tracks whether that
  // mount attempt has resolved, success or failure, rather than a real load
  // progress signal. Set on both paths so a WebGL failure still lets the app
  // launch into its fallback UI instead of leaving the loader on-screen forever.
  const [sceneMounted, setSceneMounted] = useState(false)
  const launched = sceneMounted && loadStatus !== 'loading'
  const [labelsRevealed, setLabelsRevealed] = useState(false)
  const [prefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  // Real progress is too coarse (a couple of discrete steps, not a byte
  // count) for a smooth "counting up" readout, so this is paced by elapsed
  // time and held below 100 until the assets are genuinely ready.
  const [launchPercent, setLaunchPercent] = useState(0)
  const [launchOverlayFadedOut, setLaunchOverlayFadedOut] = useState(false)
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
    } catch { queueMicrotask(() => { setSceneError(true); setSceneMounted(true) }); return }
    scene.bindMotionUI({
      labels: labelsRef.current!, identity: identityRef.current!, actions: actionsRef.current!,
      resolve: state => { setDisplayedNavigation(state) },
      settled: () => contextRef.current?.focus({ preventScroll: true }),
    })
    scene.update(orchestraScenePresets[preset], debug)
    scene.setNavigation(useNavigationStore.getState().navigation)
    sceneRef.current = scene
    setSceneMounted(true)
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
    let frame = requestAnimationFrame(function draw() {
      frame = requestAnimationFrame(draw)
      const intensity = new Map<OrchestraInstrument, number>()
      for (const [instrument, activity] of listeningEngine.instrumentActivity()) intensity.set(instrument, activity.intensity)
      sceneRef.current?.setAudibleActivity(intensity)
    })
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV || !debug) return
    for (const id of Object.keys(orchestraScenePresets[preset].sections) as OrchestraSectionId[]) {
      sceneRef.current?.setSectionVisualState(id, id === previewSection
        ? { emphasis: previewEmphasis, opacity: previewOpacity, activity: previewActivity }
        : { emphasis: 0, opacity: 1, activity: 1 })
    }
  }, [debug, preset, previewSection, previewEmphasis, previewOpacity, previewActivity])

  // Read inside the rAF loop below so a mid-count change doesn't restart the
  // effect — restarting would reset the elapsed clock and stall the count.
  const launchedRef = useRef(launched)
  useEffect(() => { launchedRef.current = launched }, [launched])

  useEffect(() => {
    if (prefersReducedMotion) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      // Reaching 100 always takes at least LAUNCH_COUNT_MS, so the count is
      // actually readable instead of jumping straight to 100 on a warm cache;
      // it can't pass 99 until the assets are genuinely ready, so a slower
      // load just holds it there rather than claiming to be done.
      const allowance = ((now - start) / LAUNCH_COUNT_MS) * 100
      const next = Math.min(allowance, launchedRef.current ? 100 : 99)
      setLaunchPercent(current => (next > current ? next : current))
      if (next < 100) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [prefersReducedMotion])

  const displayedPercent = Math.floor(launchPercent)
  // Padded to a fixed 3 digits with an invisible prefix (tabular-nums makes
  // every digit the same width) so 9%→10%→99%→100% never nudges the box
  // width — relying on a guessed min-width in em wasn't exact enough.
  const displayedPercentStr = String(displayedPercent)
  const displayedPercentPad = '0'.repeat(3 - displayedPercentStr.length)
  // The map waits for the count to finish, not just for the assets — reduced
  // motion skips the wait entirely rather than sitting through a count it
  // did not ask for.
  const revealed = launched && (prefersReducedMotion || launchPercent >= 100)
  // animationend/transitionend never fire when reduced motion turns the
  // transition off (see the stylesheet override), so this is also derived
  // rather than waiting on an event that would never come.
  const showLaunchOverlay = !launchOverlayFadedOut && !(revealed && prefersReducedMotion)

  const handleLaunchOverlayTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return
    setLaunchOverlayFadedOut(true)
  }

  const handleRevealAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    // The reveal wrapper isn't the only animated element in this tree
    // (label hover/gleam transitions, the loader), and animationend bubbles.
    if (event.target !== event.currentTarget) return
    setLabelsRevealed(true)
  }
  // Reduced motion skips the reveal keyframes entirely (see the stylesheet
  // override), so animationend never fires — reveal labels as soon as
  // launched instead of leaving them permanently hidden.
  const labelsVisible = labelsRevealed || (revealed && prefersReducedMotion)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea, [contenteditable]')) return
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.key === 'Escape' && useNavigationStore.getState().navigation.level !== 'orchestra') {
        event.preventDefault()
        goBack()
        return
      }
      if (!import.meta.env.DEV) return
      if (event.key === '1') setPreset('compact')
      if (event.key === '2') setPreset('classical-wide')
      if (event.key === '3') setPreset('installation-spread')
      if (event.key.toLowerCase() === 'd') setDebug((current) => !current)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goBack])

  return (
    <main className="orchestra-prototype">
      {/* inert (not conditional rendering) — identityRef must stay mounted for
          scene.bindMotionUI, called once on scene mount, well before revealed. */}
      <header className="map-chrome map-chrome--top" inert={!revealed}>
        <div ref={identityRef} className="map-context">
          <h1 ref={contextRef} tabIndex={-1}>{contextName}</h1>
        </div>
        <PlaybackControls />
        <div className="map-chrome__end">
          <FullOrchestraLock />
        </div>
      </header>
      <div className="orchestra-prototype__stage">
        {showLaunchOverlay && (
          <div
            className={`orchestra-launch${revealed ? ' orchestra-launch--complete' : ''}`}
            onTransitionEnd={handleLaunchOverlayTransitionEnd}
          >
            <p className="orchestra-launch__status" role="status" aria-label="Loading the orchestra">
              Loading
              {/* The count is paced by rAF, which reduced motion skips — showing
                  a frozen 0% would read as broken, so omit it in that case. The
                  space is explicit because JSX strips whitespace across lines. */}
              {!prefersReducedMotion && (
                <>{' '}<span className="orchestra-launch__percent" aria-hidden="true">
                  <span className="orchestra-launch__percent-pad">{displayedPercentPad}</span>{displayedPercentStr}%
                </span></>
              )}
            </p>
          </div>
        )}
        <div
          className={`orchestra-prototype__reveal ${revealed ? 'orchestra-prototype__reveal--launched' : 'orchestra-prototype__reveal--launching'}`}
          onAnimationEnd={handleRevealAnimationEnd}
        >
        <div ref={containerRef} className="orchestra-prototype__canvas" />
        <div
          ref={labelsRef}
          className={`map-labels${sceneError ? ' map-labels--fallback' : ''}${labelsVisible ? ' map-labels--revealed' : ''}`}
          aria-label="Map targets"
          inert={!labelsVisible}
        >
        {navigation.level === 'family' && (
          <button type="button" className="map-chip map-withdraw" aria-keyshortcuts="Escape"
            onPointerDown={event => event.stopPropagation()}
            onClick={event => { event.stopPropagation(); goBack() }}>← Back</button>
        )}
        {([
          ...mapLabels(orchestraScenePresets[preset], navigation).map(target => ({ target, incoming: false })),
          ...(sameNavigation(navigation, canonicalNavigation) ? [] : mapLabels(orchestraScenePresets[preset], canonicalNavigation)
            .map(target => ({ target, incoming: true }))),
        ]).map(({ target, incoming }, index) => {
          const highlighted = target.state.level === 'instrument'
            ? hoveredInstrument === target.state.instrumentId
            : target.sectionIds.some(id => hoveredSections.includes(id))
          const dismissed = !incoming && departingLabelId && target.id !== departingLabelId
          const hoverProps = {
            onPointerEnter: () => sceneRef.current?.setHoveredTarget(target.state),
            onPointerLeave: (event: PointerEvent<HTMLElement>) => {
              if (document.activeElement !== event.currentTarget) sceneRef.current?.setHoveredTarget(null)
            },
            onFocus: () => sceneRef.current?.setHoveredTarget(target.state),
            onBlur: () => sceneRef.current?.setHoveredTarget(null),
          }
          if (target.kind === 'explore') {
            return (
              <div key={target.id} data-target={target.id}
                data-incoming={incoming ? '' : undefined}
                data-label-corner={labelCornerFor(target.placementId)}
                data-navigation-level="explore"
                style={{ '--section-color': target.color, '--gleam-delay': `${index * 0.7}s` } as CSSProperties}
                className={['map-explore-cluster', highlighted ? 'is-highlighted' : undefined, dismissed ? 'is-dismissed' : undefined].filter(Boolean).join(' ')}
                onPointerEnter={hoverProps.onPointerEnter}
                onPointerLeave={hoverProps.onPointerLeave}>
                <button type="button" className="map-chip" onFocus={hoverProps.onFocus} onBlur={hoverProps.onBlur}
                  onPointerDown={event => event.stopPropagation()}
                  onClick={event => { event.stopPropagation(); goBack() }}>← Back</button>
                <button type="button" className="map-chip" onFocus={hoverProps.onFocus} onBlur={hoverProps.onBlur}
                  onPointerDown={event => event.stopPropagation()}
                  onClick={event => event.stopPropagation()}>{target.name}</button>
              </div>
            )
          }
          return (
          <button key={target.id} data-target={target.id} type="button"
            data-incoming={incoming ? '' : undefined}
            data-label-corner={labelCornerFor(target.placementId)}
            data-navigation-level={target.state.level}
            style={{ '--section-color': target.color, '--gleam-delay': `${index * 0.7}s` } as CSSProperties}
            className={[
              'map-chip',
              highlighted ? 'is-highlighted' : undefined,
              dismissed ? 'is-dismissed' : undefined,
            ].filter(Boolean).join(' ')}
            {...hoverProps}
            onClick={() => navigateTo(target.state)}>{target.name}</button>
          )
        })}
        </div>
        {sceneError && <p className="map-error" role="status">The illuminated map is unavailable. Use the labels to explore.</p>}
        </div>
      </div>
      <footer className="map-chrome map-chrome--bottom">
        <output className="map-note">{navigation.level === 'orchestra'
          ? 'Hearing the full orchestra'
          : `${contextName} more present in the mix`}</output>
        <div ref={actionsRef} className="map-actions">
          {navigation.level === 'family' && <div className="map-actions__buttons">
            <button type="button" onClick={goBack}>← Back</button>
          </div>}
        </div>
      </footer>

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
          <ListeningDiagnostics />
        </aside>
      )}
    </main>
  )
}
