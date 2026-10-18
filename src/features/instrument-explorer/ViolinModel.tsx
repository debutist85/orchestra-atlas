import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { collectAnchors, instantiateInstrumentModel } from './instrument-model-resource'
import { anatomyLabel, anatomyPositionCorrection, isAnchorIntentionallyHidden } from './instrument-anatomy'
import { isOccluded, projectToScreen } from './anchor-projection'
import { instrumentExplorerConfig } from './config'
import { anatomyCameraPreset, type CameraPreset } from './anatomy-camera'
import { hotspotCameraPreset, roundVec3 } from './hotspots'
import { HotspotEditor } from './HotspotEditor'
import { applyLighting, createStudioEnvironment, instrumentLighting, type LightingSettings } from './instrument-lighting'
import { LightingControls } from './LightingControls'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { useAnatomyStore } from '../../store/anatomy-store'
import { useHotspotStore } from '../../store/hotspot-store'

type Props = {
  url: string
  instrumentId: OrchestraInstrument
  onReady: () => void
  onError: () => void
}

type AnchorLabel = { id: string; label: string; x: number; y: number; hotspot: boolean }
type Marker = { id: string; label: string; object: THREE.Object3D; hotspot: boolean }

// A pointer gesture that travels further than this is an orbit drag, not a
// tap — so placing a hotspot or tapping out of a focused part never fires at
// the end of a rotation.
const TAP_TOLERANCE_PX = 6

export function ViolinModel({ url, instrumentId, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [anchorLabels, setAnchorLabels] = useState<AnchorLabel[]>([])
  // All anchors ripple together until the visitor clicks any one of them —
  // then none do, permanently (no per-anchor cycling to track).
  const [ripplesActive, setRipplesActive] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  // Clicking an anchor selects it (bright + label stays visible, and now
  // also focuses the camera / reveals anatomy content below) until a
  // different one is clicked — hover/focus give the same bright+label
  // treatment but only while the pointer/focus stays there. Selection lives
  // in the anatomy store (not local state) since AnatomyPanel, a sibling
  // component, needs to read the same selection.
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const selectAnatomyPart = useAnatomyStore(state => state.selectAnatomyPart)
  const debugRef = useRef<HTMLPreElement>(null)
  const copyPresetRef = useRef(() => {})
  const captureViewRef = useRef<(() => { orientation: 'portrait' | 'landscape'; preset: CameraPreset }) | null>(null)
  const previewHotspotRef = useRef<(id: string) => void>(() => {})
  const applyLightingRef = useRef<(settings: LightingSettings) => void>(() => {})
  const [debug] = useState(() => import.meta.env.DEV && new URLSearchParams(window.location.search).get('debug') === 'true')
  const editingHotspotId = useHotspotStore(state => state.editingId)

  // Hotspots are per instrument (hotspots/<instrumentId>.json), loaded
  // whenever the explorer shows one; in debug mode an unsaved editor draft
  // for that instrument takes precedence over the file.
  useEffect(() => {
    useHotspotStore.getState().load(instrumentId, { persistDraft: debug })
  }, [debug, instrumentId])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let disposed = false
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(instrumentExplorerConfig.camera.fov, 1, 0.01, 100)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    const environment = createStudioEnvironment(renderer)
    scene.environment = environment.texture
    applyLighting(renderer, scene, instrumentLighting(instrumentId))
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
    // Debug mode also allows dolly-zoom, so a captured hotspot view can be
    // composed closer or further than the general framing.
    controls.enableZoom = instrumentExplorerConfig.controls.enableZoom || debug
    controls.minPolarAngle = THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.minPolarAngleDeg)
    controls.maxPolarAngle = THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.maxPolarAngleDeg)

    let model: THREE.Object3D | undefined
    let ready = false
    let anchors: Marker[] = []
    // JSON-defined hotspots get an empty Object3D parented to the model at
    // their model-local position, so from here on they're projected,
    // occlusion-tested and focused exactly like the GLB's own anchors.
    const hotspotObjects = new Map<string, THREE.Object3D>()
    let hotspotMarkers: Marker[] = []
    const markers = () => [...anchors, ...hotspotMarkers]
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

    const updateAnchors = () => {
      if (!model) return
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      const obstacle = model
      // The camera is never parented, so its own position is already world-space.
      const next = markers().flatMap(({ id, label, object, hotspot }) => {
        object.getWorldPosition(worldPosition)
        if (isOccluded(camera.position, worldPosition, obstacle, occlusionEpsilon, raycaster)) return []
        return [{ id, label, hotspot, ...projectToScreen(worldPosition, camera, { width, height }) }]
      })
      setAnchorLabels(next)
    }

    const render = () => renderer.render(scene, camera)
    let frame = 0
    // Damped OrbitControls keep reporting a change for a few frames after a
    // drag ends (the coast-to-stop), then settle back to false — the loop
    // itself is cheap to leave running, but a render/reprojection only
    // happens on a frame that actually changed something.
    let forceRender = true
    const tick = () => {
      frame = requestAnimationFrame(tick)
      const moved = controls.update()
      if (!moved && !forceRender) return
      forceRender = false
      render()
      updateAnchors()
      if (debugRef.current) {
        const t = controls.target, p = camera.position
        const degrees = (radians: number) => THREE.MathUtils.radToDeg(radians).toFixed(1)
        debugRef.current.textContent = `target:   ${t.x.toFixed(4)}, ${t.y.toFixed(4)}, ${t.z.toFixed(4)}\nposition: ${p.x.toFixed(4)}, ${p.y.toFixed(4)}, ${p.z.toFixed(4)}\nazimuth ${degrees(controls.getAzimuthalAngle())}°  polar ${degrees(controls.getPolarAngle())}°  distance ${controls.getDistance().toFixed(4)}`
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
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      // Aspect just changed above, so re-frame against it every time, not
      // only once at load — otherwise a resize that changes the aspect a lot
      // (e.g. a phone rotating between portrait and landscape) could leave
      // the model cropped or oddly small instead of re-fit to 70%. Only while
      // nothing is focused — a focused part owns the camera until deselected.
      if (!focusedPartId) frameModel()
      forceRender = true
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
      // Debug mode keeps orbit/zoom live so a previewed hotspot view can be
      // fine-tuned and re-captured in place.
      controls.enabled = debug
      const anchor = markers().find(candidate => candidate.id === partId)
      if (!anchor) return
      if (!generalCameraState) generalCameraState = { position: camera.position.clone(), target: controls.target.clone() }
      const orientation = host.clientWidth < host.clientHeight ? 'portrait' : 'landscape'
      const hotspot = anchor.hotspot ? useHotspotStore.getState().hotspots.find(candidate => candidate.id === partId) : undefined
      const override = hotspot ? hotspotCameraPreset(hotspot, orientation) : anatomyCameraPreset(partId, orientation)
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
      if (state.selectedPartId === previous.selectedPartId) return
      applyFocus(state.selectedPartId, false)
    })

    const syncHotspots = () => {
      const root = model
      if (!root) return
      const { hotspots } = useHotspotStore.getState()
      const ids = new Set(hotspots.map(hotspot => hotspot.id))
      for (const [id, object] of hotspotObjects) {
        if (ids.has(id)) continue
        object.removeFromParent()
        hotspotObjects.delete(id)
      }
      hotspotMarkers = hotspots.map(hotspot => {
        let object = hotspotObjects.get(hotspot.id)
        if (!object) {
          object = new THREE.Object3D()
          object.name = `Hotspot_${hotspot.id}`
          root.add(object)
          hotspotObjects.set(hotspot.id, object)
        }
        object.position.set(...hotspot.position)
        return { id: hotspot.id, label: hotspot.title || hotspot.id, object, hotspot: true }
      })
      // A focused hotspot that was deleted (or renamed) in the editor has
      // nothing left to focus on.
      if (focusedPartId && !markers().some(marker => marker.id === focusedPartId)) useAnatomyStore.getState().returnToInstrument()
      forceRender = true
    }
    const unsubscribeHotspots = useHotspotStore.subscribe((state, previous) => {
      if (state.hotspots !== previous.hotspots) syncHotspots()
    })

    // Tap detection shared by hotspot placement and tap-to-return below.
    // Listening alongside OrbitControls (not instead of it) leaves rotation
    // untouched; any multi-touch gesture (pinch) never counts as a tap.
    const activePointers = new Set<number>()
    let gestureStart = { x: 0, y: 0 }
    let gestureIsDrag = false
    let lastTapPlacedHotspot = false
    const pickRaycaster = new THREE.Raycaster()
    const pickPointer = new THREE.Vector2()
    const placeHotspot = (event: PointerEvent) => {
      const { placement, editingId, add, update, setPlacement } = useHotspotStore.getState()
      if (!debug || placement === 'off' || !model) return false
      const rect = renderer.domElement.getBoundingClientRect()
      pickPointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
      pickRaycaster.setFromCamera(pickPointer, camera)
      const hit = pickRaycaster.intersectObject(model, true)[0]
      if (!hit) return false
      // Stored relative to the model root, so the runtime rotation and
      // re-centering applied at load don't leak into the saved data.
      const position = roundVec3(model.worldToLocal(hit.point.clone()).toArray())
      if (placement === 'add') add(position)
      else if (editingId) {
        update(editingId, { position })
        setPlacement('off')
      }
      return true
    }
    const handlePointerDown = (event: PointerEvent) => {
      activePointers.add(event.pointerId)
      if (activePointers.size > 1) gestureIsDrag = true
      else {
        gestureStart = { x: event.clientX, y: event.clientY }
        gestureIsDrag = false
      }
    }
    const handlePointerUp = (event: PointerEvent) => {
      if (!activePointers.delete(event.pointerId) || activePointers.size > 0) return
      gestureIsDrag ||= Math.hypot(event.clientX - gestureStart.x, event.clientY - gestureStart.y) > TAP_TOLERANCE_PX
      lastTapPlacedHotspot = !gestureIsDrag && placeHotspot(event)
    }
    const handlePointerCancel = (event: PointerEvent) => {
      activePointers.delete(event.pointerId)
      gestureIsDrag = true
    }
    renderer.domElement.addEventListener('pointerdown', handlePointerDown)
    renderer.domElement.addEventListener('pointerup', handlePointerUp)
    renderer.domElement.addEventListener('pointercancel', handlePointerCancel)

    // Clicking the bare canvas (not a dot — those are separate overlay
    // buttons the click never reaches) while a part is focused zooms back
    // out, same as Back. Outside debug mode OrbitControls is disabled while
    // focused (see applyFocus), so there's no competing drag-to-rotate
    // gesture; in debug mode the tap check above tells them apart.
    const handleCanvasClick = () => {
      if (gestureIsDrag || lastTapPlacedHotspot) return
      if (focusedPartId !== null) useAnatomyStore.getState().returnToInstrument()
    }
    renderer.domElement.addEventListener('click', handleCanvasClick)

    // Dev-only: while focused on a part with ?debug=true, lets a developer
    // read the live camera position/target and copy a ready-to-paste
    // CameraPreset — this is how a part gets a specifically composed angle
    // in anatomy-camera.ts instead of the automatic close-up above.
    applyLightingRef.current = settings => {
      applyLighting(renderer, scene, settings)
      forceRender = true
    }
    copyPresetRef.current = () => {
      const preset = `{ target: [${controls.target.toArray().map(n => n.toFixed(4)).join(', ')}], position: [${camera.position.toArray().map(n => n.toFixed(4)).join(', ')}] }`
      void navigator.clipboard?.writeText(preset)
    }
    captureViewRef.current = () => ({
      orientation: host.clientWidth < host.clientHeight ? 'portrait' : 'landscape',
      preset: { target: roundVec3(controls.target.toArray()), position: roundVec3(camera.position.toArray()) },
    })
    // Re-applies focus even when this hotspot is already selected (the store
    // wouldn't change, so its subscription wouldn't fire) — e.g. to check a
    // view that was just re-captured.
    previewHotspotRef.current = id => {
      const anatomy = useAnatomyStore.getState()
      if (anatomy.selectedPartId === id) applyFocus(id, false)
      else anatomy.selectAnatomyPart(id)
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
        return [{ id: object.name, label, object, hotspot: false }]
      })
      syncHotspots()
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
      unsubscribeHotspots()
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown)
      renderer.domElement.removeEventListener('pointerup', handlePointerUp)
      renderer.domElement.removeEventListener('pointercancel', handlePointerCancel)
      renderer.domElement.removeEventListener('click', handleCanvasClick)
      focusTimeline?.kill()
      controls.dispose()
      model?.removeFromParent()
      environment.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [debug, instrumentId, onError, onReady, url])

  return <div ref={hostRef} className="instrument-explore__model-canvas">
    {status === 'loading' && <output className="instrument-explore__status">Loading violin model</output>}
    {status === 'error' && <p className="instrument-explore__status" role="alert">Violin model unavailable</p>}
    {anchorLabels.length > 0 && (
      <div className={[
        'instrument-anchors',
        ripplesActive && 'instrument-anchors--rippling',
        selectedPartId && 'instrument-anchors--focused',
      ].filter(Boolean).join(' ')}
      >
        {anchorLabels.map(anchor => (
          <button
            key={anchor.id}
            type="button"
            className={[
              'instrument-anchor',
              anchor.id === selectedPartId && 'instrument-anchor--selected',
              debug && anchor.hotspot && anchor.id === editingHotspotId && 'instrument-anchor--editing',
            ].filter(Boolean).join(' ')}
            style={{ transform: `translate3d(${anchor.x}px, ${anchor.y}px, 0) translate(-50%, -50%)` }}
            // Hidden (via CSS, instrument-anchors--focused) rather than
            // merely dimmed while a different part is focused — keep it out
            // of the tab order to match what's actually visible.
            tabIndex={selectedPartId && anchor.id !== selectedPartId ? -1 : undefined}
            onClick={() => {
              setRipplesActive(false)
              if (debug && anchor.hotspot) useHotspotStore.getState().setEditing(anchor.id)
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
        <LightingControls key={instrumentId} instrumentId={instrumentId} onChange={settings => applyLightingRef.current(settings)} />
        <HotspotEditor
          instrumentId={instrumentId}
          captureView={() => captureViewRef.current?.()}
          preview={id => previewHotspotRef.current(id)}
        />
      </div>
    )}
  </div>
}
