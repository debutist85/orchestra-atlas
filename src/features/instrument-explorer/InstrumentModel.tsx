import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

import { collectAnchors, instantiateInstrumentModel } from './instrument-model-resource'
import { anatomyDescription, anatomyLabel, anatomyPositionCorrection, isAnchorIntentionallyHidden } from './instrument-anatomy'
import { isOccluded, projectToScreen } from './anchor-projection'
import { fitDistance, projectedBounds, sampleModelPoints } from './model-extent'
import type { CameraRig } from './label-travel'
import { anatomySpotlightDefaults, anatomySpotlightOverrides, instrumentExplorerConfig } from './config'
import { descriptionZoomed } from './instrument-description'
import { anatomyNoteLayout } from './anatomy-label-layout'
import { anatomyCameraPreset } from './anatomy-camera'
import { hotspotCameraPreset, roundVec3 } from './hotspots'
import { applyLighting, createStudioEnvironment, instrumentLighting } from './instrument-lighting'
import { createDebugBridge, explorerDebugEnabled } from './debug-bridge'
import { InstrumentDebugPanel } from './InstrumentDebugPanel'
import { useAnatomyStore } from '../../store/anatomy-store'
import { useHotspotStore } from '../../store/hotspot-store'
import type { InstrumentViewSignal } from './instrument-view'

import type { OrchestraInstrument } from '../orchestra-map/config'
import { radialPartActions, partAction, demonstrationsFor } from './technique'
import { radialActionPositions } from './radial-actions-layout'
import { createNodeAudio, type NodeAudioState } from './node-audio'
import { ActionIcon } from './ActionIcon'
import { useExploreLayoutStore } from '../../store/explore-layout-store'

type Props = {
  instrumentId: OrchestraInstrument
  name: string
  url: string
  rotation: readonly [number, number, number]
  view: InstrumentViewSignal
  onReady: () => void
  onError: () => void
}

type AnchorItem = { id: string; label: string; hotspot: boolean }
type Marker = { id: string; label: string; object: THREE.Object3D; hotspot: boolean }

// A pointer gesture that travels further than this is an orbit drag, not a
// tap — so placing a hotspot or tapping out of a focused part never fires at
// the end of a rotation.
const TAP_TOLERANCE_PX = 6

function partNote(partId: string) {
  const hotspot = useHotspotStore.getState().hotspots.find(item => item.id === partId)
  if (hotspot) return { title: hotspot.title || hotspot.id, description: hotspot.description }
  return { title: anatomyLabel(partId) ?? '', description: anatomyDescription(partId) ?? '' }
}

export function InstrumentModel({ instrumentId, name, url, rotation, view, onReady, onError }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const spotlightRef = useRef<HTMLDivElement>(null)
  const anatomyLabelRef = useRef<HTMLDivElement>(null)
  // Retain the last note while CSS reverses its entry on deselection.
  const [notePartId, setNotePartId] = useState<string | null>(null)
  const [noteContent, setNoteContent] = useState({ title: '', description: '' })
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  // The hotspots, listed once when the model loads. Their positions and
  // visibility change every frame of a drag, so the render loop writes those
  // straight to the buttons (anchorElements) instead of through React state.
  const [anchorItems, setAnchorItems] = useState<AnchorItem[]>([])
  const actionElements = useRef(new Map<string, HTMLButtonElement>())
  const anchorElements = useRef(new Map<string, HTMLButtonElement>())
  // Set by the scene effect: asks the render loop for a frame (e.g. once a
  // newly mounted hotspot button needs its first position).
  const requestRenderRef = useRef(() => {})
  // Selection is shared domain state; projection and transient entry motion
  // remain local to this renderer. The original dot fades during focus.
  const selectedPartId = useAnatomyStore(state => state.selectedPartId)
  const selectedActionId = useAnatomyStore(state => state.selectedActionId)
  const selectedMedia = useAnatomyStore(state => state.selectedMedia)
  const activeAudioAction = selectedPartId && selectedActionId && selectedMedia === 'audio'
    ? partAction(instrumentId, selectedPartId, selectedActionId) : undefined
  const activeAudio = demonstrationsFor(instrumentId, activeAudioAction).find(demo => demo.type === 'audio')
  const [audioState, setAudioState] = useState<NodeAudioState>({ id: null, playing: false, error: null })
  const nodeAudioRef = useRef<ReturnType<typeof createNodeAudio> | null>(null)
  useEffect(() => {
    const player = createNodeAudio({
      onState: setAudioState,
      onProgress: (id, progress) => {
        const element = actionElements.current.get(id)
        const ring = element?.querySelector<SVGSVGElement>('.instrument-action__progress')
        const circle = ring?.querySelector('circle')
        // Write directly to the SVG: visibility and stroke length update
        // together rather than depending on inherited custom properties.
        if (ring) ring.style.opacity = progress > 0 ? '1' : '0'
        if (circle) circle.style.strokeDashoffset = String(2 * Math.PI * 23 * (1 - progress))
        element?.setAttribute('aria-description', `Playback ${Math.round(progress * 100)}%`)
      },
    })
    nodeAudioRef.current = player
    const unsubscribe = useAnatomyStore.subscribe((state, previous) => {
      if (state.selectedPartId !== previous.selectedPartId || state.selectedActionId !== previous.selectedActionId || state.selectedMedia !== previous.selectedMedia) player.stop()
    })
    return () => { unsubscribe(); player.stop(); nodeAudioRef.current = null }
  }, [instrumentId])
  const actions = notePartId ? radialPartActions(instrumentId, notePartId) : []
  const selectAnatomyPart = useAnatomyStore(state => state.selectAnatomyPart)
  const [debug] = useState(explorerDebugEnabled)
  const [debugBridge] = useState(createDebugBridge)
  const editingHotspotId = useHotspotStore(state => state.editingId)
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
    const rig: CameraRig = { camera, target: controls.target }
    view.setCameraRig(rig)
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
    const hotspotObjects = new Map<string, THREE.Object3D>()
    let hotspotMarkers: Marker[] = []
    const markers = () => [...anchors, ...hotspotMarkers]
    // Set by the anatomy-focus logic below; resize() reads it to know
    // whether the general framing owns the camera right now or a focused
    // part does (and should be left alone across a resize).
    let focusedPartId: string | null = null
    // The note projects through the destination pose, not the travelling
    // camera, so its own entry is independent of the zoom's screen motion.
    let noteCamera: THREE.PerspectiveCamera | undefined
    // Retain the last anchor during the return tween so the light follows it
    // all the way out, independent of marker occlusion and React mounting.
    let spotlightPartId: string | null = null
    const spotlight = spotlightRef.current
    const spotlightState = { opacity: 0 }
    const writeSpotlight = () => {
      if (!spotlight || !spotlightPartId) return
      const anchor = markers().find(candidate => candidate.id === spotlightPartId)
      if (!anchor) return
      const width = host.clientWidth, height = host.clientHeight
      const size = Math.min(width, height)
      if (!size) return
      const config = { ...anatomySpotlightDefaults, ...anatomySpotlightOverrides[spotlightPartId] }
      anchor.object.getWorldPosition(worldPosition)
      const { x, y } = projectToScreen(worldPosition, camera, { width, height })
      const radius = Math.max(1, config.radius * size)
      const clear = (1 - THREE.MathUtils.clamp(config.softness, 0, 1)) * 100
      const darkness = THREE.MathUtils.clamp(config.darkness, 0, 1)
      spotlight.style.background = `radial-gradient(circle ${radius}px at ${x + config.offset[0] * size}px ${y + config.offset[1] * size}px, transparent ${clear}%, rgb(0 0 0 / ${darkness * 0.12}) ${clear + (100 - clear) * 0.35}%, rgb(0 0 0 / ${darkness * 0.5}) ${clear + (100 - clear) * 0.68}%, rgb(0 0 0 / ${darkness}) 100%)`
      spotlight.style.opacity = String(spotlightState.opacity)
    }
    // An anchor sits essentially ON the surface it marks, so a full-length ray
    // to it would almost always report an "intersection" with that same
    // adjacent surface. Stopping the ray just short excludes that
    // self-intersection and only catches genuinely closer, occluding geometry
    // (e.g. the body blocking an anchor rotated to the back). Scaled to the
    // model's own size once it loads, below.
    let occlusionEpsilon = 0.01
    const raycaster = new THREE.Raycaster()
    const worldPosition = new THREE.Vector3()

    // Whether each hotspot is in view. The occlusion raycast against the
    // whole mesh is by far the costliest per-frame work, so while the camera
    // moves it is spread round-robin over frames (a few hotspots per frame)
    // instead of all of them every frame; once the camera settles, one full
    // pass makes every hotspot exact. Positions are projected every frame.
    const anchorVisible = new Map<string, boolean>()
    let occlusionCursor = 0
    let occlusionStale = true
    const refreshOcclusion = (count: number) => {
      const list = markers()
      if (!model || list.length === 0) return
      for (let i = 0; i < Math.min(count, list.length); i++) {
        const { id, object } = list[occlusionCursor % list.length]
        occlusionCursor++
        object.getWorldPosition(worldPosition)
        // The camera is never parented, so its own position is already world-space.
        anchorVisible.set(id, !isOccluded(camera.position, worldPosition, model, occlusionEpsilon, raycaster))
      }
    }
    const writeAnchors = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      const label = anatomyLabelRef.current
      let noteBounds: { left: number; top: number; width: number; height: number } | undefined
      // Establish the hidden entry pose before the first selection, rather
      // than changing its axis in the same frame that reveals the note.
      if (label) label.dataset.orientation = width < height ? 'portrait' : 'landscape'
      const selected = markers().find(anchor => anchor.id === focusedPartId)
      if (label && selected && noteCamera) {
        noteCamera.aspect = width / height
        noteCamera.clearViewOffset()
        noteCamera.updateProjectionMatrix()
        selected.object.getWorldPosition(worldPosition)
        const projected = projectToScreen(worldPosition, noteCamera, { width, height })
        const style = getComputedStyle(host)
        const top = Math.max(16, Number.parseFloat(style.getPropertyValue('--map-chrome-height')) + 16 || 0)
        const bottom = Math.max(16, Number.parseFloat(style.getPropertyValue('--map-footer-height')) + 16 || 0)
        const text = label.querySelector<HTMLElement>('.instrument-anatomy-label__text')
        if (text) {
          // Measure against the available stage width before positioning the
          // band, so a rotation or font change cannot leave stale wrapping.
          text.style.width = `${Math.min(260, Math.max(0, width - 48))}px`
          const position = anatomyNoteLayout(projected,
            { width: text.offsetWidth, height: text.offsetHeight }, { width, height }, { top, bottom })
          label.style.transform = `translate3d(${position.x.toFixed(1)}px, ${position.y.toFixed(1)}px, 0)`
          label.style.width = `${position.width}px`
          label.style.height = `${position.height}px`
          text.style.top = `${position.textTop}px`
          noteBounds = { left: position.x, top: position.y, width: position.width, height: position.height }
        }
      }
      if (selected && noteCamera) {
        selected.object.getWorldPosition(worldPosition)
        // Match the note's destination projection: the arc remains still
        // during zoom and only its entry animation travels outward.
        const center = projectToScreen(worldPosition, noteCamera, { width, height })
        const style = getComputedStyle(host)
        const top = Math.max(16, (Number.parseFloat(style.getPropertyValue('--map-chrome-height')) || 0) + 16)
        const bottom = Math.max(16, (Number.parseFloat(style.getPropertyValue('--map-footer-height')) || 0) + 16)
        const obstacles = []
        if (noteBounds) obstacles.push(noteBounds)
        const map = useExploreLayoutStore.getState().contextualMap
        if (map) {
          const box = host.getBoundingClientRect()
          obstacles.push({ ...map, left: map.left - box.left, top: map.top - box.top })
        }
        const actionLayer = host.querySelector<HTMLElement>('.instrument-actions')
        if (actionLayer) actionLayer.dataset.orientation = width < height ? 'portrait' : 'landscape'
        const insets = actionLayer ? getComputedStyle(actionLayer) : undefined
        const left = Math.max(16, Number.parseFloat(insets?.paddingLeft ?? '') || 0)
        const right = Math.max(16, Number.parseFloat(insets?.paddingRight ?? '') || 0)
        const safeTop = Math.max(top, Number.parseFloat(insets?.paddingTop ?? '') || 0)
        const safeBottom = Math.max(bottom, Number.parseFloat(insets?.paddingBottom ?? '') || 0)
        const available = radialPartActions(instrumentId, selected.id)
        const points = radialActionPositions(center, available.length,
          { left, top: safeTop, width: width - left - right, height: Math.max(0, height - safeTop - safeBottom) }, width < height, obstacles)
        for (const [index, action] of available.entries()) {
          const element = actionElements.current.get(action.id)
          if (!element) continue
          const point = points[index]
          element.style.visibility = point ? 'visible' : 'hidden'
          element.dataset.positioned = String(Boolean(point))
          if (!point) continue
          element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`
        }
      }
      for (const { id, object } of markers()) {
        const element = anchorElements.current.get(id)
        if (!element) continue
        // visibility (not unmounting) keeps the button out of the tab order
        // and accessibility tree while hidden behind the instrument.
        if (!anchorVisible.get(id)) { element.style.visibility = 'hidden'; continue }
        object.getWorldPosition(worldPosition)
        const { x, y } = projectToScreen(worldPosition, camera, { width, height })
        element.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) translate(-50%, -50%)`
        element.style.visibility = 'visible'
      }
    }

    // The loop sleeps while nothing changes and is woken by input
    // (OrbitControls start/change), camera tweens, re-frames, and resizes.
    // Damped OrbitControls keep reporting a change for a few frames after a
    // drag ends (the coast-to-stop); the loop runs until that settles and
    // the settled hotspot pass is done.
    let frame = 0
    let looping = false
    let forceRender = true
    const tick = () => {
      const moved = controls.update()
      if (moved || forceRender) {
        forceRender = false
        renderer.render(scene, camera)
        refreshOcclusion(instrumentExplorerConfig.anchors.occlusionChecksPerFrame)
        occlusionStale = true
        writeAnchors()
        writeSpotlight()
        if (framedDistance > 0) {
          view.setZoomed(descriptionZoomed(view.getZoomed(), camera.position.distanceTo(controls.target) / framedDistance))
        }
        view.set(controls.getAzimuthalAngle(), controls.getPolarAngle())
        if (debug) {
          debugBridge.publishCamera({
            target: controls.target.toArray(),
            position: camera.position.toArray(),
            azimuth: controls.getAzimuthalAngle(),
            polar: controls.getPolarAngle(),
            distance: controls.getDistance(),
            orientation: host.clientWidth < host.clientHeight ? 'portrait' : 'landscape',
          })
        }
      } else if (occlusionStale) {
        refreshOcclusion(markers().length)
        occlusionStale = false
        writeAnchors()
        writeSpotlight()
      } else {
        looping = false
        return
      }
      frame = requestAnimationFrame(tick)
    }
    const requestRender = () => {
      forceRender = true
      if (looping) return
      looping = true
      frame = requestAnimationFrame(tick)
    }
    const wake = () => {
      if (looping) return
      looping = true
      frame = requestAnimationFrame(tick)
    }
    controls.addEventListener('start', wake)
    controls.addEventListener('change', wake)
    requestRenderRef.current = requestRender
    requestRender()

    // Sampled geometry (model-extent.ts), set once the model is placed.
    let modelPoints: Float32Array | undefined
    // Camera distance of the current framing (frameModel), and a scratch
    // camera to measure from the front pose at that distance.
    let framedDistance = 0
    const frontCamera = camera.clone()
    // The model's footprint on screen at the general framing, for layout
    // anchored to the model (spatial typography). Measured from the front
    // pose whatever the visitor's current rotation, so the labels stay put.
    const publishModelBounds = () => {
      if (!modelPoints || !framedDistance || cameraOwnedByFocus()) return
      frontCamera.copy(camera)
      frontCamera.position.set(0, 0, framedDistance)
      frontCamera.lookAt(0, 0, 0)
      view.setModelBounds(projectedBounds(modelPoints, frontCamera, { width: host.clientWidth, height: host.clientHeight }))
    }
    // A re-frame requested while a part owns the camera, or while the camera
    // is still travelling back from one, waits until it has landed — moving
    // the camera then would fight the tween or leave the close-up.
    let reframePending = false
    let focusTimeline: gsap.core.Timeline | undefined
    const cameraOwnedByFocus = () => focusedPartId !== null || (focusTimeline?.isActive() ?? false)
    // Projection shift (px): where the camera's look-at point lands relative
    // to the canvas center. Showing the whole instrument, that is the center
    // of the composed model frame; while a part is focused it eases to zero,
    // so the part sits in the center of the stage. Kept as a value (not only
    // on the camera) so it can be tweened and re-applied at a new canvas size.
    const viewShift = { x: 0, y: 0 }
    const applyViewShift = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      camera.setViewOffset(width, height, viewShift.x, viewShift.y, width, height)
    }
    const frameShift = () => {
      const width = host.clientWidth
      const height = host.clientHeight
      const frame = view.getModelFrame() ?? { left: 0, top: 0, width, height }
      return { x: width / 2 - (frame.left + frame.width / 2), y: height / 2 - (frame.top + frame.height / 2) }
    }
    const stageCenter = { x: 0, y: 0 }

    // The model is fit, on both axes, into the frame the spatial typography
    // composes (the stage minus the labels' side, already matched to the
    // model's aspect), and the projection is shifted so it lands there — the
    // camera still orbits the model's own center. Until that frame has been
    // published, the whole canvas stands in for it; publishing re-frames.
    const frameModel = () => {
      if (!modelPoints) return
      const width = host.clientWidth
      const height = host.clientHeight
      if (!width || !height) return
      if (cameraOwnedByFocus()) {
        reframePending = true
        applyViewShift()
        return
      }
      const target = view.getModelFrame() ?? { left: 0, top: 0, width, height }
      const { frameFill } = instrumentExplorerConfig.framing
      // The frame's half-extents as view-angle tangents: the canvas spans
      // tan(fov/2) either side of center vertically (times aspect
      // horizontally), and the model gets the frame's share of that.
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5))
      const halfY = tangent * target.height * frameFill / height
      const halfX = tangent * camera.aspect * target.width * frameFill / width
      const distance = Math.max(fitDistance(modelPoints, halfX, halfY), 0.25)
      framedDistance = distance
      Object.assign(viewShift, frameShift())
      applyViewShift()
      // Keep the visitor's orbit: only the distance (and the shift) follow
      // the frame. The fit is for the front view, which the frame is
      // composed for; before any orbit the camera starts there.
      const direction = camera.position.clone().sub(controls.target)
      if (direction.lengthSq() < 1e-12) direction.set(0, 0, 1)
      camera.position.copy(direction.normalize().multiplyScalar(distance))
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
      // the model cropped or oddly small instead of re-fit to its frame. Only while
      // nothing is focused — a focused part owns the camera until deselected.
      // While a part is focused this only keeps it centered at the new
      // size, and defers the re-frame until the camera returns.
      frameModel()
      publishModelBounds()
      requestRender()
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
    let generalCameraState: { position: THREE.Vector3; target: THREE.Vector3 } | undefined

    const tweenCamera = (
      position: THREE.Vector3,
      target: THREE.Vector3,
      shift: { x: number; y: number },
      instant: boolean,
      duration: number = instrumentExplorerConfig.focus.duration,
      onComplete?: () => void,
    ) => {
      focusTimeline?.kill()
      if (instant || reducedMotion) {
        camera.position.copy(position)
        controls.target.copy(target)
        Object.assign(viewShift, shift)
        applyViewShift()
        controls.update()
        spotlightState.opacity = focusedPartId ? 1 : 0
        writeSpotlight()
        requestRender()
        onComplete?.()
        return
      }
      const timeline = gsap.timeline({
        onUpdate: () => {
          applyViewShift()
          controls.update()
          requestRender()
        },
        onComplete,
      })
      timeline.to(camera.position, { x: position.x, y: position.y, z: position.z, duration, ease: 'power2.inOut' }, 0)
      timeline.to(controls.target, { x: target.x, y: target.y, z: target.z, duration, ease: 'power2.inOut' }, 0)
      // The framing glides between the composed frame and the stage center
      // on the same curve, so the part arrives centered.
      timeline.to(spotlightState, { opacity: focusedPartId ? 1 : 0, duration, ease: 'power2.inOut' }, 0)
      timeline.to(viewShift, { x: shift.x, y: shift.y, duration, ease: 'power2.inOut' }, 0)
      focusTimeline = timeline
    }

    // No authored preset for a part (every part, until one is captured via
    // the dev tool below) falls back to an automatic close-up: keep the
    // direction the visitor is already viewing from, just move closer and
    // re-center on the part. Either way the camera looks at the part and the
    // projection shift eases to zero, so it ends in the center of the stage. Works for every anchor without a hand-tuned
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
        const landed = () => {
          // The return tween is over; drop it so the deferred re-frame below
          // isn't deferred again.
          focusTimeline = undefined
          controls.enabled = true
          spotlightState.opacity = 0
          writeSpotlight()
          spotlightPartId = null
          if (!reframePending) return
          reframePending = false
          frameModel()
          publishModelBounds()
          requestRender()
        }
        if (previous) tweenCamera(previous.position, previous.target, frameShift(), instant, undefined, landed)
        else landed()
        return
      }
      // Disabled from the moment the zoom-in starts (not just once framed) —
      // the curated composition isn't meant to be nudged mid-flight either.
      // Debug mode keeps orbit/zoom live so a previewed hotspot view can be
      // fine-tuned and re-captured in place.
      controls.enabled = debug
      const anchor = markers().find(candidate => candidate.id === partId)
      if (!anchor) return
      setNotePartId(partId)
      setNoteContent(partNote(partId))
      spotlightPartId = partId
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
      // The titles travel with the zoom around this point (label-travel.ts);
      // it is kept through the zoom back out.
      rig.focus = target.clone()
      noteCamera = camera.clone()
      noteCamera.position.copy(position)
      noteCamera.lookAt(target)
      noteCamera.updateMatrixWorld()
      writeAnchors()
      tweenCamera(position, target, stageCenter, instant, override?.duration)
    }
    const unsubscribeAnatomy = useAnatomyStore.subscribe((state, previous) => {
      if (state.selectedPartId !== previous.selectedPartId) applyFocus(state.selectedPartId, false)
      if (!state.selectedPartId) return // Keep note text through its exit.
      if (state.selectedActionId === previous.selectedActionId && state.selectedMedia === previous.selectedMedia) return
      const action = state.selectedActionId && state.selectedMedia === 'audio'
        ? partAction(instrumentId, state.selectedPartId, state.selectedActionId) : undefined
      setNoteContent(action
        ? { title: action.title, description: action.technique.description }
        : partNote(state.selectedPartId))
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
        return { id: hotspot.id, label: hotspot.title || hotspot.id, object, hotspot: true as const }
      })
      if (focusedPartId && !markers().some(marker => marker.id === focusedPartId)) useAnatomyStore.getState().returnToInstrument()
      setAnchorItems(markers().map(({ id, label, hotspot }) => ({ id, label, hotspot })))
      requestRender()
    }
    const unsubscribeHotspots = useHotspotStore.subscribe((state, previous) => {
      if (state.hotspots !== previous.hotspots) syncHotspots()
    })
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
    // out, same as Back. Unambiguous only because OrbitControls is disabled
    // while focused (see applyFocus) — no competing drag-to-rotate gesture
    // to confuse a click with.
    const handleCanvasClick = () => {
      if (gestureIsDrag || lastTapPlacedHotspot) return
      if (focusedPartId !== null) useAnatomyStore.getState().returnToInstrument()
    }
    renderer.domElement.addEventListener('click', handleCanvasClick)

    const detachDebug = debugBridge.attach({
      applyLighting: settings => {
        applyLighting(renderer, scene, settings)
        requestRender()
      },
      // Re-applies focus even when this part is already selected (the store
      // wouldn't change, so its subscription wouldn't fire) — e.g. to check
      // a hotspot view that was just re-captured.
      previewPart: id => {
        const anatomy = useAnatomyStore.getState()
        if (anatomy.selectedPartId === id) applyFocus(id, false)
        else anatomy.selectAnatomyPart(id)
      },
    })

    // Re-frame when the typography recomposes the stage (label size,
    // orientation, model aspect) — unless a focused part owns the camera.
    let appliedFrame = view.getModelFrame()
    const unsubscribeView = view.subscribe(() => {
      const next = view.getModelFrame()
      if (next === appliedFrame) return
      appliedFrame = next
      frameModel()
      publishModelBounds()
      requestRender()
    })

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    const labelObserver = new ResizeObserver(requestRender)
    const noteText = anatomyLabelRef.current?.querySelector('.instrument-anatomy-label__text')
    if (noteText) labelObserver.observe(noteText)
    void instantiateInstrumentModel(url).then(loadedModel => {
      if (disposed) return
      model = loadedModel
      model.rotation.set(...rotation)
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      model.position.sub(center)
      scene.add(model)
      view.setModelAspect(size.x / size.y)
      // The model never moves (the camera orbits it), so its geometry is
      // sampled once, in its placed pose.
      modelPoints = sampleModelPoints(model)
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
      looping = false
      requestRenderRef.current = () => {}
      controls.removeEventListener('start', wake)
      controls.removeEventListener('change', wake)
      observer.disconnect()
      labelObserver.disconnect()
      unsubscribeAnatomy()
      unsubscribeHotspots()
      unsubscribeView()
      detachDebug()
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
  }, [debug, debugBridge, instrumentId, onError, onReady, rotation, url, view])

  return <div ref={hostRef} className="instrument-explore__model-canvas">
    {status === 'loading' && <output className="instrument-explore__status">Loading {name} model</output>}
    {status === 'error' && <p className="instrument-explore__status" role="alert">{name} model unavailable</p>}
    <div ref={spotlightRef} className="instrument-explore__spotlight" aria-hidden="true" />
    {anchorItems.length > 0 && (
      <div inert={selectedPartId !== null} className={[
        'instrument-anchors',
        selectedPartId && 'instrument-anchors--focused',
      ].filter(Boolean).join(' ')}
      >
        {anchorItems.map(anchor => (
          <button
            key={anchor.id}
            ref={element => {
              if (!element) return
              anchorElements.current.set(anchor.id, element)
              requestRenderRef.current()
              return () => { anchorElements.current.delete(anchor.id) }
            }}
            type="button"
            className={[
              'instrument-anchor',
              anchor.id === selectedPartId && 'instrument-anchor--selected',
              debug && anchor.hotspot && anchor.id === editingHotspotId && 'instrument-anchor--editing',
            ].filter(Boolean).join(' ')}
            aria-label={anchor.label}
            onClick={() => {
              if (debug && anchor.hotspot) useHotspotStore.getState().setEditing(anchor.id)
              selectAnatomyPart(anchor.id)
            }}
          >
            <span className="instrument-anchor__dot" aria-hidden="true" />
          </button>
        ))}
      </div>
    )}
    <div ref={anatomyLabelRef} className="instrument-anatomy-label"
      data-visible={selectedPartId !== null}
      aria-hidden={selectedPartId === null}
      inert={selectedPartId === null}
    >
      <div className="instrument-anatomy-label__content">
        <div className="instrument-anatomy-label__text">
          <div role="status"><h3>{noteContent.title}</h3><p>{noteContent.description}</p></div>
          {activeAudio && audioState.error && <p role="alert">{audioState.error}</p>}
        </div>
      </div>
    </div>
    {notePartId && actions.length > 0 && <div className="instrument-actions" role="group"
      data-visible={selectedPartId !== null}
      inert={selectedPartId === null}
      aria-hidden={selectedPartId === null}
      aria-label={`${anatomyLabel(notePartId)} actions`}
    >
      {actions.map((action, index) => <button
        key={`${notePartId}:${action.id}`}
        type="button"
        className="instrument-action"
        ref={element => {
          if (!element) return
          actionElements.current.set(action.id, element)
          element.style.setProperty('--action-delay', `${400 + index * 55}ms`)
          requestRenderRef.current()
          return () => { actionElements.current.delete(action.id) }
        }}
        aria-label={action.media === 'discover' ? 'Discover anatomy' : `${action.media === 'audio' ? (audioState.id === action.id && audioState.playing ? 'Pause' : 'Play') : 'Watch'} ${action.title}`}
        title={action.media === 'discover' ? 'Discover' : `${action.title} · ${action.media}`}
        aria-pressed={action.media === 'discover' ? selectedActionId === null : selectedActionId === action.actionId && selectedMedia === action.media}
        onClick={() => {
          const store = useAnatomyStore.getState()
          if (action.media === 'discover') {
            store.clearAction()
            return
          }
          if (!action.actionId) return
          store.selectAction(action.actionId, instrumentId, action.media)
          if (action.media === 'video') store.openDemonstration(instrumentId)
          else {
            const audio = demonstrationsFor(instrumentId, partAction(instrumentId, notePartId, action.actionId)).find(demo => demo.type === 'audio')
            if (audio) nodeAudioRef.current?.toggle(action.id, audio.src)
          }
        }}
      ><span className="instrument-action__surface">
        {action.media === 'audio' && <svg className="instrument-action__progress" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" /></svg>}
        <ActionIcon media={action.media === 'audio' && audioState.id === action.id && audioState.playing ? 'pause' : action.media} />
      </span></button>)}
    </div>}
    {debug && <InstrumentDebugPanel instrumentId={instrumentId} bridge={debugBridge} />}
  </div>
}
