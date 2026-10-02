import {
  useEffect, useLayoutEffect, useRef, useState,
  type AnimationEvent, type CSSProperties, type PointerEvent, type TransitionEvent,
} from 'react'
import gsap from 'gsap'
import { identityFigures, identityLayoutVariables } from '../identity-layout'

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
import { usePlaybackStore } from '../../../store/playback-store'
import { useListeningLoadStore } from '../../../store/listening-load-store'
import { PlaybackControls } from '../../listening/PlaybackControls'
import { FullOrchestraLock } from '../../listening/FullOrchestraLock'
import { ListeningDiagnostics } from '../../listening/ListeningDiagnostics'
import { listeningEngine } from '../../listening/listening-engine'
import { OrchestraScene } from '../three/OrchestraScene'
import { familyIds, familyName, familyInstruments, mapLabels, sameNavigation, travelingTargetId, type NavigationState } from '../utils/navigation'
import { labelCornerFor } from '../utils/entity-layout'

// Shortest time the launch count may take to reach 100, so it reads as a
// count rather than a flash when everything is already cached.
const LAUNCH_COUNT_MS = 1000
const INVITATION_COPY = {
  primary: 'Play the orchestra',
  secondary: 'or select a group to explore',
}
const INVITATION_TIMING = { initialDelay: 3, hold: 1, gap: 3, resumeDelay: 0.7 }
const INVITATION_STRENGTH = 1

function IdentityFigure({ state }: Readonly<{ state: NavigationState }>) {
  const { landscape, portrait } = identityFigures(state)
  if (!landscape && !portrait) return null
  const orientation = landscape && portrait ? undefined : landscape ? 'landscape' : 'portrait'
  const image = (
    <img
      className={orientation ? `map-identity-figure map-identity-figure--${orientation}` : 'map-identity-figure'}
      src={(landscape ?? portrait)!.src}
      alt=""
      aria-hidden="true"
    />
  )
  // One element only. Orientation changes the CSS variables, and a portrait
  // source swaps the file when the two orientations use different assets.
  if (!landscape || !portrait || landscape.src === portrait.src) return image
  return (
    <picture>
      <source media="(orientation: portrait)" srcSet={portrait.src} />
      {image}
    </picture>
  )
}

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
  const conductorInvitationRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OrchestraScene>(null)
  const [preset, setPreset] = useState<SeatingPresetName>(initialSettings.preset)
  const [debug, setDebug] = useState(initialSettings.debug)
  const [hoveredSections, setHoveredSections] = useState<OrchestraSectionId[]>([])
  const canonicalNavigation = useNavigationStore(state => state.navigation)
  const [navigation, setDisplayedNavigation] = useState(canonicalNavigation)
  const [backReady, setBackReady] = useState(canonicalNavigation.level !== 'orchestra')
  const contextNameFor = (state: typeof canonicalNavigation) => state.level === 'orchestra' ? 'Orchestra Atlas' : state.level === 'family'
    ? familyName(orchestraScenePresets[preset], state.familyId)
    : familyInstruments(orchestraScenePresets[preset], state.familyId).find(group => group.instrument === state.instrumentId)?.name
  const identityCaptionFor = (state: typeof canonicalNavigation) => state.level === 'orchestra'
    ? <><span className="map-identity-orchestra">Orchestra</span>{' '}<span className="map-identity-atlas">Atlas</span></>
    : contextNameFor(state)
  const contextName = contextNameFor(canonicalNavigation)
  const identityTransitioning = !sameNavigation(navigation, canonicalNavigation)
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
  const [constellationSettled, setConstellationSettled] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const uiReady = launched && (constellationSettled || prefersReducedMotion)
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => {
      setPrefersReducedMotion(preference.matches)
      // A preference change during entrance must not leave the UI waiting for
      // an animationend event that the reduced-motion stylesheet cancels.
      if (preference.matches) setConstellationSettled(true)
    }
    preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  const hasStarted = usePlaybackStore(state => state.hasStarted)
  const play = usePlaybackStore(state => state.play)
  const [hasZoomedIn, setHasZoomedIn] = useState(() => canonicalNavigation.level !== 'orchestra')
  const [conductorExiting, setConductorExiting] = useState(false)
  const invitationTimeline = useRef<gsap.core.Timeline | null>(null)
  const invitationResume = useRef<gsap.core.Tween | null>(null)
  const invitationEligible = uiReady && loadStatus === 'ready'
    && canonicalNavigation.level === 'orchestra' && navigation.level === 'orchestra'
    && !hasStarted && !hasZoomedIn
  useEffect(() => useNavigationStore.subscribe(state => {
    if (state.navigation.level !== 'orchestra') setHasZoomedIn(true)
  }), [])
  useEffect(() => {
    if (!conductorExiting) return
    const timeout = window.setTimeout(() => setConductorExiting(false), prefersReducedMotion ? 0 : 420)
    return () => window.clearTimeout(timeout)
  }, [conductorExiting, prefersReducedMotion])

  useEffect(() => {
    if (!invitationEligible || prefersReducedMotion || sceneError) {
      sceneRef.current?.setInvitation(null)
      return
    }
    const timeline = gsap.timeline({ delay: INVITATION_TIMING.initialDelay, repeat: -1 })
    for (const family of familyIds) {
      timeline.call(() => sceneRef.current?.setInvitation(family, INVITATION_STRENGTH))
      timeline.to({}, { duration: INVITATION_TIMING.hold })
      timeline.call(() => sceneRef.current?.setInvitation(null))
      timeline.to({}, { duration: INVITATION_TIMING.gap })
    }
    invitationTimeline.current = timeline
    return () => {
      invitationResume.current?.kill()
      invitationResume.current = null
      timeline.kill()
      invitationTimeline.current = null
      sceneRef.current?.setInvitation(null)
    }
  }, [invitationEligible, prefersReducedMotion, sceneError])

  useEffect(() => {
    const timeline = invitationTimeline.current
    if (!timeline) return
    invitationResume.current?.kill()
    if (hoveredSections.length) {
      timeline.pause()
      sceneRef.current?.setInvitation(null)
    } else if (timeline.paused()) {
      invitationResume.current = gsap.delayedCall(INVITATION_TIMING.resumeDelay, () => timeline.resume())
    }
  }, [hoveredSections])
  // Real progress is too coarse (a couple of discrete steps, not a byte
  // count) for a smooth "counting up" readout, so this is paced by elapsed
  // time and held below 100 until the assets are genuinely ready.
  const [launchPercent, setLaunchPercent] = useState(0)
  const [launchOverlayFadedOut, setLaunchOverlayFadedOut] = useState(false)
  useEffect(() => {
    if (!launched || !prefersReducedMotion) return
    // Persist the skipped entrance so disabling reduced motion later cannot
    // replay loading or hide an already usable interface.
    const frame = requestAnimationFrame(() => {
      setConstellationSettled(true)
      setLaunchOverlayFadedOut(true)
      setLaunchPercent(100)
    })
    return () => cancelAnimationFrame(frame)
  }, [launched, prefersReducedMotion])
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
      sections => {
        setHoveredSections(sections)
      },
      state => {
        navigateTo(state)
      },
      (id, x, y) => {
        const element = labelsRef.current?.querySelector<HTMLElement>(`[data-target="${id}"]`)
        if (element) { element.style.left = `${x}px`; element.style.top = `${y}px` }
      },
      (x, y, diameter) => {
        const element = conductorInvitationRef.current
        if (!element) return
        element.style.left = `${x}px`
        element.style.top = `${y}px`
        element.style.setProperty('--conductor-radius', `${diameter / 2}px`)
      },
    )
    } catch { queueMicrotask(() => { setSceneError(true); setSceneMounted(true) }); return }
    scene.bindMotionUI({
      labels: labelsRef.current!, identity: identityRef.current!, actions: actionsRef.current!,
      resolve: state => { setDisplayedNavigation(state) },
      settled: () => {
        setBackReady(useNavigationStore.getState().navigation.level !== 'orchestra')
        contextRef.current?.focus({ preventScroll: true })
      },
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
    if (canonicalNavigation.level === 'orchestra') setBackReady(false)
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
  const constellationEntering = revealed && (launchOverlayFadedOut || prefersReducedMotion)
  const showConductorInvitation = uiReady && loadStatus === 'ready' && !sceneError
    && canonicalNavigation.level === 'orchestra' && navigation.level === 'orchestra'
    && (!hasStarted || conductorExiting)
  // animationend/transitionend never fire when reduced motion turns the
  // transition off (see the stylesheet override), so this is also derived
  // rather than waiting on an event that would never come.
  const showLaunchOverlay = !launchOverlayFadedOut && !(revealed && prefersReducedMotion)

  const handleLaunchOverlayTransitionEnd = (event: TransitionEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== 'opacity') return
    setLaunchOverlayFadedOut(true)
  }

  const handleRevealAnimationEnd = (event: AnimationEvent<HTMLElement>) => {
    // The reveal wrapper isn't the only animated element in this tree
    // (label hover/gleam transitions, the loader), and animationend bubbles.
    if (event.target !== event.currentTarget || event.animationName !== 'orchestra-reveal') return
    setConstellationSettled(true)
  }
  // Reduced motion skips the reveal keyframes entirely (see the stylesheet
  // override), so animationend never fires — reveal labels as soon as
  // launched instead of leaving them permanently hidden.
  const labelsVisible = uiReady

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
    <main className="orchestra-prototype" data-ui-ready={uiReady} data-scene-error={sceneError}>
      <header className="map-chrome map-chrome--top" inert={!uiReady}>
        <div className="map-chrome__start">
          {canonicalNavigation.level !== 'orchestra' && backReady && (
            <button type="button" className="map-header-back" aria-keyshortcuts="Escape" onClick={goBack}>← Back</button>
          )}
        </div>
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
          className={`orchestra-prototype__reveal ${constellationSettled ? 'orchestra-prototype__reveal--settled' : constellationEntering ? 'orchestra-prototype__reveal--launched' : 'orchestra-prototype__reveal--launching'}`}
          onAnimationEnd={handleRevealAnimationEnd}
          inert={!uiReady}
        >
        {/* Keep the heading mounted for the scene's motion binding and bounds projection. */}
        <div ref={identityRef} className={`map-context${identityTransitioning ? ' map-context--incoming' : ''}`} inert={!uiReady}
          style={identityLayoutVariables(canonicalNavigation) as CSSProperties}>
          <div className="map-identity-content">
            <h1 ref={contextRef} tabIndex={-1}>{identityCaptionFor(canonicalNavigation)}</h1>
            <IdentityFigure state={canonicalNavigation} />
            {canonicalNavigation.level === 'instrument' && (
              <button type="button" className="map-identity-explore"
                onPointerEnter={() => sceneRef.current?.setHoveredTarget(canonicalNavigation)}
                onPointerLeave={() => sceneRef.current?.setHoveredTarget(null)}
                onFocus={() => sceneRef.current?.setHoveredTarget(canonicalNavigation)}
                onBlur={() => sceneRef.current?.setHoveredTarget(null)}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => event.stopPropagation()}>
                Explore {contextName} →
              </button>
            )}
          </div>
          {canonicalNavigation.level === 'family' && (
            <nav className="map-identity-targets" aria-label={`${familyName(orchestraScenePresets[preset], canonicalNavigation.familyId)} instruments`}
              inert={!sameNavigation(navigation, canonicalNavigation)}>
              {familyInstruments(orchestraScenePresets[preset], canonicalNavigation.familyId).map(group => (
                <button key={group.instrument} type="button"
                  onFocus={() => sceneRef.current?.setHoveredTarget({ level: 'instrument', familyId: canonicalNavigation.familyId, instrumentId: group.instrument })}
                  onBlur={() => sceneRef.current?.setHoveredTarget(null)}
                  onClick={() => navigateTo({ level: 'instrument', familyId: canonicalNavigation.familyId, instrumentId: group.instrument })}>
                  {group.name}
                </button>
              ))}
            </nav>
          )}
        </div>
        {identityTransitioning && (
          <div className="map-context map-context--outgoing" aria-hidden="true"
            style={identityLayoutVariables(navigation) as CSSProperties}>
            <div className="map-identity-content">
              <div className="map-identity-departing">{identityCaptionFor(navigation)}</div>
              <IdentityFigure state={navigation} />
            </div>
          </div>
        )}
        <div ref={containerRef} className="orchestra-prototype__canvas" />
        <div ref={conductorInvitationRef}
          className={`orchestra-invitation${showConductorInvitation ? ' orchestra-invitation--visible' : ''}${conductorExiting ? ' orchestra-invitation--departing' : ''}`}
          inert={!showConductorInvitation || conductorExiting}>
          <button type="button" className="orchestra-invitation__play"
            onClick={event => {
              const keyboardFocus = event.currentTarget.matches(':focus-visible')
              setConductorExiting(true)
              play()
              if (keyboardFocus) window.setTimeout(() => {
                document.querySelector<HTMLButtonElement>('.playback__toggle')?.focus({ preventScroll: true })
              }, prefersReducedMotion ? 0 : 420)
            }} aria-label="Play orchestra">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16l13-8z" /></svg>
          </button>
            <div className="orchestra-invitation__copy-block">
              <p className="orchestra-invitation__copy">{INVITATION_COPY.primary}</p>
              <p className="orchestra-invitation__hint">{INVITATION_COPY.secondary}</p>
            </div>
          </div>
        <div
          ref={labelsRef}
          className={`map-labels${navigation.level === 'orchestra' ? ' map-labels--orchestra' : ''}${sceneError ? ' map-labels--fallback' : ''}${labelsVisible ? ' map-labels--revealed' : ''}`}
          aria-label="Map targets"
          inert={!labelsVisible}
        >
        {([
          ...mapLabels(orchestraScenePresets[preset], navigation).map(target => ({ target, incoming: false })),
          ...(sameNavigation(navigation, canonicalNavigation) ? [] : mapLabels(orchestraScenePresets[preset], canonicalNavigation)
            .map(target => ({ target, incoming: true }))),
        ]).filter(({ target }) => target.state.level !== 'instrument').map(({ target, incoming }, index) => {
          const highlighted = target.sectionIds.some(id => hoveredSections.includes(id))
          const dismissed = !incoming && departingLabelId && target.id !== departingLabelId
          const hoverProps = {
            onPointerEnter: () => sceneRef.current?.setHoveredTarget(target.state),
            onPointerLeave: (event: PointerEvent<HTMLElement>) => {
              if (document.activeElement !== event.currentTarget) sceneRef.current?.setHoveredTarget(null)
            },
            onFocus: () => sceneRef.current?.setHoveredTarget(target.state),
            onBlur: () => sceneRef.current?.setHoveredTarget(null),
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
            onClick={() => {
              navigateTo(target.state)
            }}>{target.name}</button>
          )
        })}
        </div>
        {sceneError && uiReady && <p className="map-error" role="status">The illuminated map is unavailable. Use the labels to explore.</p>}
        </div>
      </div>
      <footer className="map-chrome map-chrome--bottom" inert={!uiReady}>
        {(hasStarted || loadStatus === 'error') && <PlaybackControls />}
        {/* NavigationMotion still requires this element. It stays hidden while
            its parent remains the footer for scene label layout exclusions. */}
        <div ref={actionsRef} hidden />
      </footer>

      {import.meta.env.DEV && debug && uiReady && (
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
