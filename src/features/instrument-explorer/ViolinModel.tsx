import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { collectAnchors, instantiateInstrumentModel } from './instrument-model-resource'
import { anatomyLabel, anatomyPositionCorrection, isAnchorIntentionallyHidden } from './instrument-anatomy'
import { isOccluded, projectToScreen } from './anchor-projection'
import { instrumentExplorerConfig } from './config'
import { anatomyCameraPreset } from './anatomy-camera'
import { createInstrumentGround } from './instrument-ground'
import { createDrawingBufferSizer } from './drawing-buffer'
import { createExplorationDiagnostics } from './exploration-diagnostics'
import { useMediaQuery } from '../../lib/use-media-query'
import { useAnatomyStore } from '../../store/anatomy-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { anatomyPartHasMedia } from './technique'

type Props = {
  instrumentId: OrchestraInstrument
  url: string
  onReady: () => void
  onError: () => void
}

type AnchorLabel = { id: string; label: string; x: number; y: number }

export function ViolinModel({ instrumentId, url, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [anchorLabels, setAnchorLabels] = useState<AnchorLabel[]>([])
  const anchorElements = useRef(new Map<string, HTMLButtonElement>())
  const anchorPositions = useRef(new Map<string, AnchorLabel>())
  const performanceRef = useRef<HTMLOutputElement>(null)
  const [measurePerformance] = useState(() => new URLSearchParams(window.location.search).get('explorePerf') === 'true')
  // All anchors ripple together until the visitor clicks any one of them —
  // then none do, permanently (no per-anchor cycling to track).
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [ripplesDismissed, setRipplesDismissed] = useState(false)
  const ripplesActive = !prefersReducedMotion && !ripplesDismissed
  // Clicking an anchor selects it (bright + label stays visible, and now
  // also focuses the camera / reveals anatomy content below) until a
  // different one is clicked — hover/focus give the same bright+label
  // treatment but only while the pointer/focus stays there. Selection lives
  // in the anatomy store (not local state) since AnatomyPanel, a sibling
  // component, needs to read the same selection.
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const demonstrationOpen = useAnatomyStore(state => state.demonstrationOpen)
  const selectAnatomyPart = useAnatomyStore(state => state.selectAnatomyPart)
  const debugRef = useRef<HTMLPreElement>(null)
  const copyPresetRef = useRef(() => {})
  const [debug] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'true')

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    const diagnostics = measurePerformance ? createExplorationDiagnostics() : undefined
    let lastDiagnostics = 0
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(instrumentExplorerConfig.camera.fov, 1, 0.01, 100)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    const resizeBuffer = createDrawingBufferSizer(renderer)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.domElement.setAttribute('aria-hidden', 'true')
    // OrbitControls owns drag/pinch gestures on this element; without this the
    // browser's own touch scroll/zoom competes with it on touch devices.
    renderer.domElement.style.touchAction = 'none'
    host.append(renderer.domElement)
    scene.add(new THREE.HemisphereLight(0xf1eadb, 0x171b22, 2.2))
    const key = new THREE.DirectionalLight(0xffe3bd, 3.5)
    key.position.set(4, 6, 5)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x8ea9d8, 2.2)
    rim.position.set(-4, 1, -3)
    scene.add(rim)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = instrumentExplorerConfig.controls.dampingFactor
    controls.enablePan = false
    controls.enableZoom = instrumentExplorerConfig.controls.enableZoom
    controls.minPolarAngle = THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.minPolarAngleDeg)
    controls.maxPolarAngle = THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.maxPolarAngleDeg)

    let model: THREE.Object3D | undefined
    let ground: ReturnType<typeof createInstrumentGround> | undefined
    let ready = false
    let anchors: { id: string; label: string; object: THREE.Object3D }[] = []
    // Set by the anatomy-focus logic below; resize() reads it to know
    // whether the general framing owns the camera right now or a focused
    // part does (and should be left alone across a resize).
    let focusedPartId: string | null = null
    // An anchor sits essentially ON the surface it marks, so a full-length ray
    // to it would almost always report an "intersection" with that same
    // adjacent surface. Stopping the ray just short excludes that
    // self-intersection and only catches genuinely closer, occluding geometry
    // (e.g. the body blocking an anchor rotated to the back). Scaled to the
    // model's own size once it loads, below.
    let occlusionEpsilon = 0.01
    const raycaster = new THREE.Raycaster()
    const worldPosition = new THREE.Vector3()
    let visibleAnchorIds = ''

    const updateAnchors = () => {
      if (!model || !anchors.length) return
      const anatomy = useAnatomyStore.getState()
      if (anatomy.demonstrationOpen) return
      if (diagnostics) diagnostics.counters.anchorPasses++
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      const obstacle = model
      // The camera is never parented, so its own position is already world-space.
      const next = anchors.flatMap(({ id, label, object }) => {
        if (anatomy.selectedPartId && id !== anatomy.selectedPartId) return []
        object.getWorldPosition(worldPosition)
        if (diagnostics) diagnostics.counters.raycasts++
        if (isOccluded(camera.position, worldPosition, obstacle, occlusionEpsilon, raycaster)) return []
        return [{ id, label, ...projectToScreen(worldPosition, camera, { width, height }) }]
      })
      anchorPositions.current = new Map(next.map(anchor => [anchor.id, anchor]))
      for (const anchor of next) {
        const element = anchorElements.current.get(anchor.id)
        if (element) element.style.transform = `translate3d(${anchor.x}px, ${anchor.y}px, 0) translate(-50%, -50%)`
      }
      // React owns semantic membership; coordinates change outside React at
      // camera/resize frequency. Ref callbacks position newly visible buttons.
      const ids = next.map(anchor => anchor.id).join('|')
      if (ids !== visibleAnchorIds) {
        visibleAnchorIds = ids
        if (diagnostics) diagnostics.counters.anchorPublications++
        setAnchorLabels(next)
      }
    }

    const render = () => {
      const started = diagnostics ? performance.now() : 0
      if (ground) {
        // OrbitControls moves the camera, not the instrument. Counter that
        // rotation so the presentation floor stays level in the viewport.
        ground.group.quaternion.copy(camera.quaternion)
        ground.group.position.copy(controls.target)
      }
      renderer.render(scene, camera)
      if (diagnostics) {
        diagnostics.counters.renders++
        diagnostics.counters.cpuRenderMs += performance.now() - started
        diagnostics.counters.lastDrawCalls = renderer.info.render.calls
        diagnostics.counters.lastTriangles = renderer.info.render.triangles
        diagnostics.counters.geometries = renderer.info.memory.geometries
        diagnostics.counters.textures = renderer.info.memory.textures
      }
    }
    let frame = 0
    // Damped OrbitControls keep reporting a change for a few frames after a
    // drag ends (the coast-to-stop), then settle back to false — the loop
    // itself is cheap to leave running, but a render/reprojection only
    // happens on a frame that actually changed something.
    let forceRender = true
    let resizedSinceTick = false
    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      const moved = controls.update()
      if (diagnostics) {
        diagnostics.frame(now, moved || forceRender || resizedSinceTick)
        if (performanceRef.current && now - lastDiagnostics >= 500) {
          performanceRef.current.textContent = JSON.stringify(diagnostics.snapshot())
          lastDiagnostics = now
        }
      }
      resizedSinceTick = false
      if (!moved && !forceRender) return
      forceRender = false
      render()
      updateAnchors()
      if (debugRef.current) {
        const t = controls.target, p = camera.position
        debugRef.current.textContent = `target:   ${t.x.toFixed(4)}, ${t.y.toFixed(4)}, ${t.z.toFixed(4)}\nposition: ${p.x.toFixed(4)}, ${p.y.toFixed(4)}, ${p.z.toFixed(4)}`
      }
    }
    frame = requestAnimationFrame(tick)

    // Always sized relative to viewport HEIGHT alone, regardless of aspect
    // ratio — a width-based fallback was tried (to avoid ever cropping a
    // very narrow/portrait viewport) and reverted twice: comparing against
    // the model's own width made the result depend on how wide the
    // violin+bow pair happens to be relative to the viewport, which swung
    // from "too small on a wide desktop window" to "cropped top and bottom"
    // to "too small on a narrow phone" depending on which axis won. Pure
    // height-based sizing is simple and predictable, at the accepted cost of
    // letting the sides extend past the frame on an unusually narrow
    // viewport. Centering is automatic: the camera always looks straight at
    // the model's own (already re-centered) origin. Which fraction applies
    // (instrumentExplorerConfig.framing) depends on orientation, re-read on
    // every resize so rotating a device switches it immediately.
    let modelSize: THREE.Vector3 | undefined
    const frameModel = () => {
      if (!modelSize) return
      const { targetHeightFractionPortrait, targetHeightFractionLandscape } = instrumentExplorerConfig.framing
      const fraction = host.clientWidth < host.clientHeight ? targetHeightFractionPortrait : targetHeightFractionLandscape
      const verticalFov = THREE.MathUtils.degToRad(camera.fov * 0.5)
      const distance = Math.max(modelSize.y / (2 * fraction * Math.tan(verticalFov)), 0.5)
      camera.position.set(0, 0, distance)
      camera.lookAt(0, 0, 0)
      controls.target.set(0, 0, 0)
      controls.update()
    }

    const resize = () => {
      if (diagnostics) diagnostics.counters.resizeCallbacks++
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      const changed = resizeBuffer(width, height, window.devicePixelRatio)
      if (!changed && ready) return
      resizedSinceTick ||= changed
      if (changed && diagnostics) diagnostics.counters.bufferResizes++
      const aspect = width / height
      if (camera.aspect !== aspect) {
        camera.aspect = aspect
        camera.updateProjectionMatrix()
      }
      // Aspect just changed above, so re-frame against it every time, not
      // only once at load — otherwise a resize that changes the aspect a lot
      // (e.g. a phone rotating between portrait and landscape) could leave
      // the model cropped or oddly small instead of re-fit to 70%. Only while
      // nothing is focused — a focused part owns the camera until deselected.
      if (!focusedPartId && !focusTimeline?.isActive()) frameModel()
      // ResizeObserver runs after animation-frame callbacks. Resizing clears
      // the WebGL buffer, so waiting for the next tick shows an empty canvas
      // on every frame of the anatomy panel's width transition.
      render()
      updateAnchors()
      forceRender = false
      if (model && !ready) {
        ready = true
        onReady()
      }
    }
    // Camera focus follows the anatomy store's selection — a sibling
    // mechanism to experience-motion.ts's map<->explore DOM choreography,
    // not an extension of it (that class only knows the two top-level stage
    // modes; this is a Three.js camera transition entirely local to this
    // component). Killing any in-flight tween before starting a new one
    // handles rapid re-selection and Back-during-transition without stacked
    // timelines or inconsistent state.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let focusTimeline: gsap.core.Timeline | undefined
    let generalCameraState: { position: THREE.Vector3; target: THREE.Vector3 } | undefined

    const tweenCamera = (position: THREE.Vector3, target: THREE.Vector3, instant: boolean, duration = 0.85, onComplete?: () => void) => {
      focusTimeline?.kill()
      if (instant || reducedMotion) {
        camera.position.copy(position)
        controls.target.copy(target)
        controls.update()
        forceRender = true
        onComplete?.()
        return
      }
      const timeline = gsap.timeline({ onUpdate: () => { controls.update(); forceRender = true }, onComplete })
      timeline.to(camera.position, { x: position.x, y: position.y, z: position.z, duration, ease: 'power2.inOut' }, 0)
      timeline.to(controls.target, { x: target.x, y: target.y, z: target.z, duration, ease: 'power2.inOut' }, 0)
      focusTimeline = timeline
    }

    // No authored preset for a part (every part, until one is captured via
    // the dev tool below) falls back to an automatic close-up: keep the
    // direction the visitor is already viewing from, just move closer and
    // re-center on the part. Works for every anchor without a hand-tuned
    // vector per part; a preset in anatomy-camera.ts overrides it for a part
    // that needs a specifically composed angle instead.
    const FOCUS_DISTANCE_FRACTION = 0.22
    const applyFocus = (partId: string | null, instant: boolean) => {
      focusedPartId = partId
      if (partId === null) {
        const previous = generalCameraState
        generalCameraState = undefined
        // Re-enable orbiting only once the zoom-out has actually finished —
        // not the instant Back is pressed — so the visitor can't start
        // dragging mid-animation.
        if (previous) tweenCamera(previous.position, previous.target, instant, undefined, () => { controls.enabled = true })
        else controls.enabled = true
        return
      }
      // Disabled from the moment the zoom-in starts (not just once framed) —
      // the curated composition isn't meant to be nudged mid-flight either.
      controls.enabled = false
      const anchor = anchors.find(candidate => candidate.id === partId)
      if (!anchor) return
      if (!generalCameraState) generalCameraState = { position: camera.position.clone(), target: controls.target.clone() }
      const orientation = host.clientWidth < host.clientHeight ? 'portrait' : 'landscape'
      const override = anatomyCameraPreset(partId, orientation)
      anchor.object.getWorldPosition(worldPosition)
      const target = override ? new THREE.Vector3(...override.target) : worldPosition.clone()
      const position = override
        ? new THREE.Vector3(...override.position)
        : target.clone().add(
          camera.position.clone().sub(controls.target).normalize()
            .multiplyScalar(camera.position.distanceTo(controls.target) * FOCUS_DISTANCE_FRACTION),
        )
      tweenCamera(position, target, instant, override?.duration)
    }
    const unsubscribeAnatomy = useAnatomyStore.subscribe((state, previous) => {
      if (state.selectedPartId !== previous.selectedPartId) applyFocus(state.selectedPartId, false)
      if (state.demonstrationOpen !== previous.demonstrationOpen) forceRender = true
    })
    // Clicking the bare canvas (not a dot — those are separate overlay
    // buttons the click never reaches) while a part is focused zooms back
    // out, same as Back. Unambiguous only because OrbitControls is disabled
    // while focused (see applyFocus) — no competing drag-to-rotate gesture
    // to confuse a click with.
    const handleCanvasClick = () => {
      if (focusedPartId !== null) useAnatomyStore.getState().returnToInstrument()
    }
    renderer.domElement.addEventListener('click', handleCanvasClick)

    // Dev-only: while focused on a part with ?debug=true, lets a developer
    // read the live camera position/target and copy a ready-to-paste
    // CameraPreset — this is how a part gets a specifically composed angle
    // in anatomy-camera.ts instead of the automatic close-up above.
    copyPresetRef.current = () => {
      const preset = `{ target: [${controls.target.toArray().map(n => n.toFixed(4)).join(', ')}], position: [${camera.position.toArray().map(n => n.toFixed(4)).join(', ')}] }`
      void navigator.clipboard?.writeText(preset)
    }

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    void instantiateInstrumentModel(url).then(loadedModel => {
      if (disposed) return
      model = loadedModel
      // The asset lies on its side in its authored pose. Rotate its front plane
      // square to the camera without adding a perspective turn around Y or Z.
      model.rotation.set(Math.PI / 2, 0, 0)
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      model.position.sub(center)
      scene.add(model)
      ground = createInstrumentGround(size)
      scene.add(ground.group)
      modelSize = size
      occlusionEpsilon = Math.max(Math.max(size.x, size.y, size.z) * 0.02, 0.001)
      anchors = collectAnchors(model).flatMap(object => {
        const label = anatomyLabel(object.name)
        if (!label) {
          if (import.meta.env.DEV && !isAnchorIntentionallyHidden(object.name)) console.warn(`Unlabeled instrument anchor: ${object.name}`)
          return []
        }
        const correction = anatomyPositionCorrection(object.name)
        if (correction) object.position.add(new THREE.Vector3(...correction))
        return [{ id: object.name, label, object }]
      })
      setStatus('ready')
      resize()
    }).catch(() => {
      if (!disposed) {
        setStatus('error')
        onError()
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(frame)
      observer.disconnect()
      unsubscribeAnatomy()
      renderer.domElement.removeEventListener('click', handleCanvasClick)
      focusTimeline?.kill()
      controls.dispose()
      model?.removeFromParent()
      ground?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      anchorPositions.current.clear()
    }
  }, [onError, onReady, url, measurePerformance])

  return <div
    ref={hostRef}
    // Dimmed (CSS opacity on this container, not a per-mesh material swap)
    // while a demonstration is open, so the performance reads as the primary
    // subject — fully reversible and free the moment the demonstration closes.
    className={`instrument-explore__model-canvas${demonstrationOpen ? ' instrument-explore__model-canvas--dimmed' : ''}`}
  >
    {status === 'loading' && <output className="instrument-explore__status">Loading violin model</output>}
    {status === 'error' && <p className="instrument-explore__status" role="alert">Violin model unavailable</p>}
    {anchorLabels.length > 0 && (
      <div
        className={[
          'instrument-anchors',
          ripplesActive && 'instrument-anchors--rippling',
          selectedPartId && 'instrument-anchors--focused',
        ].filter(Boolean).join(' ')}
        // A demonstration hides every hotspot, including the selected one —
        // Anatomy state keeps that one marker visible (above), but Performance
        // is meant to read with no markers at all. inert also takes every
        // anchor out of the tab order and away from assistive tech, instead
        // of hiding each one's tabIndex individually.
        inert={demonstrationOpen}
      >
        {anchorLabels.map(anchor => (
          <button
            key={anchor.id}
            type="button"
            className={`instrument-anchor${anchor.id === selectedPartId ? ' instrument-anchor--selected' : ''}${anatomyPartHasMedia(anchor.id, instrumentId) ? ' instrument-anchor--media' : ''}`}
            aria-label={anatomyPartHasMedia(anchor.id, instrumentId) ? `${anchor.label}, audio or video available` : anchor.label}
            aria-pressed={anchor.id === selectedPartId}
            ref={element => {
              if (!element) { anchorElements.current.delete(anchor.id); return }
              anchorElements.current.set(anchor.id, element)
              const position = anchorPositions.current.get(anchor.id)
              if (position) element.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`
            }}
            // Hidden (via CSS, instrument-anchors--focused) rather than
            // merely dimmed while a different part is focused — keep it out
            // of the tab order to match what's actually visible.
            tabIndex={selectedPartId && anchor.id !== selectedPartId ? -1 : undefined}
            onClick={() => {
              setRipplesDismissed(true)
              selectAnatomyPart(anchor.id)
            }}
          >
            <span className="instrument-anchor__dot" aria-hidden="true" />
            <span className="instrument-anchor__label">{anchor.label}</span>
          </button>
        ))}
      </div>
    )}
    {debug && (
      <div className="instrument-explore__debug">
        <pre ref={debugRef} />
        <button type="button" onClick={() => copyPresetRef.current()}>Copy camera preset</button>
      </div>
    )}
    {measurePerformance && <output ref={performanceRef} data-explore-performance hidden aria-hidden="true" />}
  </div>
}
