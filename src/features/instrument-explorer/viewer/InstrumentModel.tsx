import { createObjectBounds } from '../../../lib/spatial-layout'
import { createOrbitEnvelope } from '../../../lib/spatial-layout/orbit-envelope'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import { anatomyCameraPreset, type CameraPreset } from '../content/anatomy-camera'
import { hotspotCameraPreset, roundVec3 } from '../content/hotspots'
import { anatomyDescription, anatomyLabel } from '../content/instrument-anatomy'
import { demonstrationsFor, hasPartAudio, partAction, radialPartActions } from '../content/technique'
import type { OrchestraInstrument } from '../../orchestra-map/config'
import { instrumentExplorerConfig, explorerLayout } from '../config'
import { createDebugBridge, explorerDebugEnabled } from '../debug/debug-bridge'
import { InstrumentDebugPanel } from '../debug/InstrumentDebugPanel'
import type { InstrumentViewSignal } from '../instrument-view'
import { createCanvasGestures, pickModelPoint } from '../scene/canvas-gestures'
import { createInstrumentStage } from '../scene/instrument-stage'
import { instrumentLighting } from '../scene/instrument-lighting'
import { createMarkers } from '../scene/markers'
import { sampleModelPoints } from '../scene/model-extent'
import { createModelFraming } from '../scene/model-framing'
import { createIdleOrbit, markRotationDiscovered, rotationDiscovered } from '../scene/idle-orbit'
import { ROTATE_RING_DEPTH, ROTATE_RING_PATHS, ROTATE_RING_VIEWBOX } from '../scene/rotate-ring'
import { useExperienceStore } from '../../../store/experience-store'
import { createPartFocus } from '../scene/part-focus'
import { descriptionZoomed } from '../typography/instrument-description'
import type { CameraRig } from '../typography/label-travel'
import { useAnatomyStore } from '../../../store/anatomy-store'
import { useExploreLayoutStore } from '../../../store/explore-layout-store'
import { useHotspotStore } from '../../../store/hotspot-store'
import { ActionIcon } from './ActionIcon'
import { createOverlayMeasurements, writeFocusOverlay } from './focus-overlay'
import { createNodeAudio, type NodeAudioState } from './node-audio'

type Props = {
  instrumentId: OrchestraInstrument
  name: string
  url: string
  rotation: readonly [number, number, number]
  initialCamera?: CameraPreset
  view: InstrumentViewSignal
  onReady: () => void
  onError: () => void
}

type AnchorItem = { id: string; label: string; hotspot: boolean }

function partNote(partId: string) {
  const hotspot = useHotspotStore.getState().hotspots.find(item => item.id === partId)
  if (hotspot) return { title: hotspot.title || hotspot.id, description: hotspot.description }
  return { title: anatomyLabel(partId) ?? '', description: anatomyDescription(partId) ?? '' }
}

// The explorer's 3D viewer for any instrument with a model. The scene
// itself lives in scene/ (stage, framing, markers, focus, gestures); this
// component connects it to the stores and owns the DOM overlays on top.
// A press counts as a drag (hiding the rotate hint) once it has turned the
// camera this far; less is a click that merely paused the sway.
const DRAG_START_RADIANS = 0.002

// How long the rotate hint stays hidden after a resize when the explorer
// text does not report settling (nothing moved).
const ROTATE_RING_RELAYOUT_MS = 700

// The rotate hint's ring (placeRotateHint): as wide as the instrument's
// on-screen bounding box, at most maxWidth px and at least minWidth (so a
// very slim instrument still gets a visible ring), gap px under the
// instrument. Where the space below is short it rises over the instrument's
// base, like a turntable. Drawn at its viewBox's aspect, so it scales
// without distortion.
const ROTATE_RING = { minWidth: 64, maxWidth: 420, gap: 10, aspect: ROTATE_RING_VIEWBOX.height / ROTATE_RING_VIEWBOX.width }
// Explorer text the ring keeps above where it overlaps it horizontally (the
// portrait description sits right under the model, the Watch node above it).
const ROTATE_RING_AVOID = '.instrument-explore__description, .instrument-explore__watch'

// One arrow of the rotate ring, in the ring's viewBox, faded from the
// ring's back edge to its front (scene/rotate-ring.ts).
function RotateRingArrow({ path, gradient }: { path: string; gradient: string }) {
  return (
    <svg className="instrument-rotate-hint__ring absolute inset-0 block size-full overflow-visible"
      viewBox={`${ROTATE_RING_VIEWBOX.x} ${ROTATE_RING_VIEWBOX.y} ${ROTATE_RING_VIEWBOX.width} ${ROTATE_RING_VIEWBOX.height}`}>
      <defs>
        <linearGradient id={gradient} gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={ROTATE_RING_DEPTH.back} y2={ROTATE_RING_DEPTH.front}>
          <stop offset="0" stopColor="#fff" stopOpacity="0.12" />
          <stop offset="1" stopColor="#fff" stopOpacity="0.38" />
        </linearGradient>
      </defs>
      <path d={path} fill={`url(#${gradient})`} />
    </svg>
  )
}

export function InstrumentModel({ instrumentId, name, url, rotation, initialCamera, view, onReady, onError }: Props) {
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
  // The "Drag to rotate" hint: shown while the rotation affordance is active
  // (scene/idle-orbit.ts); positioned per rendered frame, under the model.
  const [rotateHint, setRotateHint] = useState(false)
  const rotateHintRef = useRef<HTMLDivElement>(null)
  // The ring's far arrow, under the WebGL canvas so the instrument hides it
  // where it passes behind; placed, shown and hidden with the rest.
  const rotateHintBackRef = useRef<HTMLDivElement>(null)
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
  // An enlarged copy of the selected radial node's icon heads the note:
  // Discover (the part's own description) or the selected technique's
  // medium. Its media icon, not the node's transient Pause.
  const noteIcon = actions.length ? (selectedActionId && selectedMedia ? selectedMedia : 'discover') : undefined
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
    let model: THREE.Object3D | undefined
    let objectBounds: ReturnType<typeof createObjectBounds> | undefined
    // The model's full-orbit envelope from its sampled vertices, shared by
    // the caption layout and the framing so both use the same extent.
    let orbitEnvelope: ReturnType<typeof createOrbitEnvelope> | undefined
    const stage = createInstrumentStage(host, {
      lighting: instrumentLighting(instrumentId),
      // Debug mode also allows dolly-zoom, so a captured hotspot view can
      // be composed closer or further than the general framing.
      enableZoom: instrumentExplorerConfig.controls.enableZoom || debug,
    })
    const { camera, controls, renderer } = stage
    // The opening angle. Framing then fits the distance to the stage and
    // keeps this direction, instead of starting every instrument head-on.
    if (initialCamera) {
      camera.position.set(...initialCamera.position)
      controls.target.set(...initialCamera.target)
    }
    const rig: CameraRig = { camera, target: controls.target }
    view.setCameraRig(rig)
    const markers = createMarkers(camera)
    const framing = createModelFraming(stage, view, () => focus.ownsCamera(), explorerLayout(instrumentId).scale)
    const focusPoint = new THREE.Vector3()
    // Resize-stable layout reads for the per-frame overlay writers; dropped on
    // resize (see resize below).
    let overlayMeasurements = createOverlayMeasurements()
    const writeOverlays = () => {
      const viewport = stage.size()
      if (!viewport.width || !viewport.height) return
      const focused = markers.find(focus.focusedPartId())
      focused?.object.getWorldPosition(focusPoint)
      writeFocusOverlay({
        host,
        viewport,
        measurements: overlayMeasurements,
        label: anatomyLabelRef.current,
        actionLayer: host.querySelector<HTMLElement>('.instrument-actions'),
        actionElements: actionElements.current,
        actionIds: focused ? radialPartActions(instrumentId, focused.id).map(action => action.id) : [],
        focusPoint: focused && focusPoint,
        noteCamera: focus.noteCamera(),
        contextualMap: useExploreLayoutStore.getState().contextualMap ?? undefined,
      })
      markers.write(anchorElements.current, viewport)
    }
    const focus = createPartFocus({
      stage,
      framing,
      markers,
      rig,
      spotlight: spotlightRef.current,
      orbitWhileFocused: debug,
      cameraPreset: (marker, orientation) => {
        if (!marker.hotspot) return anatomyCameraPreset(marker.id, orientation)
        const hotspot = useHotspotStore.getState().hotspots.find(candidate => candidate.id === marker.id)
        return hotspot && hotspotCameraPreset(hotspot, orientation)
      },
      onFocusStart: partId => {
        setNotePartId(partId)
        setNoteContent(partNote(partId))
      },
      onDestinationChange: writeOverlays,
    })

    let visibilityFrame = 0
    const refreshVisibility = () => {
      visibilityFrame = 0
      if (disposed) return
      // The idle sway re-renders every frame for many seconds; its ±4° never
      // carries a hotspot into or out of view, so the raycasts (the costliest
      // per-frame work) pause and the visibility from the resting pose holds.
      // A drag or focus stops the sway, and the checks resume with it.
      const pending = idleOrbit.running() ? false
        : markers.refreshOcclusion(instrumentExplorerConfig.anchors.occlusionChecksPerFrame)
      writeOverlays()
      if (pending) visibilityFrame = requestAnimationFrame(refreshVisibility)
    }
    const unsubscribeRender = stage.onRender(() => {
      // Stable orbit envelope by default; live edges are an explicit opt-in.
      // Focus travel retains ownership of its animated labels.
      if (!focus.ownsCamera() && objectBounds && orbitEnvelope) {
        const measured = explorerLayout(instrumentId).labelBounds === 'live'
          ? objectBounds.measure(camera, stage.size())
          : orbitEnvelope(camera, stage.size(), {
              target: controls.target,
              distance: camera.position.distanceTo(controls.target),
              minPolarAngle: controls.minPolarAngle,
              maxPolarAngle: controls.maxPolarAngle,
            })
        if (measured) view.setModelBounds({ ...measured.screen, depth: measured.depth })
      }
      placeRotateHint()
      // One CPU visibility task per animation frame, regardless of how many
      // render/overlay invalidations arrive. It can finish after drawing sleeps.
      if (!visibilityFrame) visibilityFrame = requestAnimationFrame(refreshVisibility)
      writeOverlays()
      focus.writeSpotlight()
      const framedDistance = framing.framedDistance()
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
          orientation: stage.orientation(),
        })
      }
    })
    // Occlusion completes incrementally through requestRender above,
    // including after orbit damping stops; never do an expensive full pass.
    const unsubscribeSettle = stage.onSettle(() => {
      writeOverlays()
      focus.writeSpotlight()
    })
    requestRenderRef.current = stage.requestRender

    // Turns the model to its initial pose (radians, Euler XYZ), centers it on
    // the origin, and re-measures everything derived from its placed
    // geometry. The model never moves after this (the camera orbits it), so
    // its geometry is sampled once per pose. Hotspot and anchor objects are
    // its children, so they turn with it.
    const placeModel = (pose: readonly [number, number, number]) => {
      if (!model) return
      model.position.set(0, 0, 0)
      model.rotation.set(...pose)
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      const size = bounds.getSize(new THREE.Vector3())
      model.position.sub(bounds.getCenter(new THREE.Vector3()))
      const points = sampleModelPoints(model)
      framing.setModelPoints(points)
      // Sampled vertices, not mesh bounding boxes: a box corner can sit far
      // outside the geometry, and swept through the orbit that overstated
      // the envelope enough to leave the model needlessly small.
      orbitEnvelope = createOrbitEnvelope(points, camera.up)
      framing.setEnvelopeMeasure(explorerLayout(instrumentId).labelBounds === 'envelope' ? orbitEnvelope : undefined)
      // The stage is composed for the full-orbit envelope's aspect (captions
      // keep clear of it); the box's front-view aspect without an envelope.
      view.setModelAspect(framing.envelopeAspect() ?? size.x / size.y)
      markers.setModelSize(size)
    }

    // Rotation affordance. The sway and hint run only while nothing else has
    // the visitor's attention: the entrance has settled, no part is focused
    // or travelling, no panel is open, and they are not dragging. Once they
    // have actually rotated this instrument it is discovered for the session.
    const idleOrbit = createIdleOrbit(stage)
    const idleSettings = instrumentExplorerConfig.idleOrbit
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let modelReady = false
    // A press pauses the sway but leaves the hint up; only once the press
    // actually moves the camera is it a drag, which hides the hint.
    let pressing = false
    let dragging = false
    let affordanceActive = false
    let hintShown = false
    let startTimer = 0
    let footerInset = 0
    const dragStart = { azimuth: 0, polar: 0 }
    const showHint = (visible: boolean) => {
      if (hintShown === visible) return
      hintShown = visible
      // Placed afresh whenever it shows.
      if (visible) hintPlacement = ''
      setRotateHint(visible)
      if (visible) stage.requestRender()
    }
    const affordanceAllowed = () => {
      const anatomy = useAnatomyStore.getState()
      return !disposed && modelReady && !debug && !rotationDiscovered(instrumentId) && !dragging
        && useExperienceStore.getState().exploreSettled
        && anatomy.selectedPartId === null && !anatomy.demonstrationOpen && !anatomy.performanceOpen
        && !focus.ownsCamera()
    }
    const updateAffordance = () => {
      if (!affordanceAllowed()) {
        window.clearTimeout(startTimer)
        startTimer = 0
        affordanceActive = false
        // Holds the current pose: a drag takes over from what is on screen.
        idleOrbit.stop()
        showHint(false)
        return
      }
      // Paused while pressed: it resumes (sway first) on release.
      if (affordanceActive || pressing) return
      affordanceActive = true
      // The hint shows as soon as the instrument stands settled; the sway
      // follows after a pause. Reduced motion: no sway, the hint alone.
      showHint(true)
      startTimer = window.setTimeout(() => {
        startTimer = 0
        if (affordanceAllowed() && !reducedMotion.matches) idleOrbit.start()
      }, idleSettings.startDelayMs)
    }
    // A press (or a tap) pauses the sway, holding the pose so a drag takes
    // over from what is on screen, but keeps the hint: a click that turns
    // nothing should not blink it out. Moving hides it; only an actual turn
    // counts as discovery.
    const onControlsStart = () => {
      pressing = true
      dragging = false
      dragStart.azimuth = controls.getAzimuthalAngle()
      dragStart.polar = controls.getPolarAngle()
      window.clearTimeout(startTimer)
      startTimer = 0
      affordanceActive = false
      idleOrbit.stop()
    }
    const onControlsChange = () => {
      if (!pressing || rotationDiscovered(instrumentId)) return
      const moved = Math.max(Math.abs(controls.getAzimuthalAngle() - dragStart.azimuth), Math.abs(controls.getPolarAngle() - dragStart.polar))
      if (!dragging && moved > DRAG_START_RADIANS) {
        dragging = true
        updateAffordance()
      }
      if (Math.abs(controls.getAzimuthalAngle() - dragStart.azimuth) > idleSettings.discoveredRadians
        || Math.abs(controls.getPolarAngle() - dragStart.polar) > idleSettings.discoveredRadians) {
        markRotationDiscovered(instrumentId)
        updateAffordance()
      }
    }
    const onControlsEnd = () => {
      pressing = false
      dragging = false
      updateAffordance()
    }
    controls.addEventListener('start', onControlsStart)
    controls.addEventListener('change', onControlsChange)
    controls.addEventListener('end', onControlsEnd)
    const unsubscribeAffordanceSettle = stage.onSettle(updateAffordance)
    const unsubscribeExperience = useExperienceStore.subscribe(updateAffordance)
    const onMotionPreference = () => {
      affordanceActive = false
      idleOrbit.stop()
      updateAffordance()
    }
    reducedMotion.addEventListener('change', onMotionPreference)
    // Under the instrument as it stands when the hint appears, centered on
    // it, kept above the footer, the explorer text and inside the stage.
    // Static: placed again only when what it depends on changes (the key:
    // stage size and framing, not the sway's turn), and only while shown.
    let hintPlacement = ''
    const placeRotateHint = () => {
      const hint = rotateHintRef.current
      if (!hint || !hintShown || !objectBounds || hint.dataset.relayout) return
      const viewport = stage.size()
      // What the measurement is actually made with: the camera's projection
      // (aspect, field of view and offset, as last applied: a relayout can
      // change those a frame before the matrix follows) and its distance,
      // but not its angles: the sway turns those, and a drag, which also
      // hides the ring, must not move it as it fades.
      const projection = camera.projectionMatrix.elements
      const key = [viewport.width, viewport.height, projection[0].toFixed(5), projection[5].toFixed(5),
        projection[8].toFixed(5), projection[9].toFixed(5), camera.position.distanceTo(controls.target).toFixed(4)].join()
      if (key === hintPlacement) return
      const extent = objectBounds.measure(camera, viewport)?.screen
      if (!extent) return
      hintPlacement = key
      const width = Math.min(viewport.width - 16, ROTATE_RING.maxWidth, Math.max(ROTATE_RING.minWidth, extent.width))
      // Its lowest allowed edge: above the footer, and above any explorer
      // text it would otherwise run into (read once per placement).
      const origin = host.getBoundingClientRect()
      let limit = viewport.height - footerInset - 8
      for (const element of host.ownerDocument.querySelectorAll<HTMLElement>(ROTATE_RING_AVOID)) {
        if (!(element.checkVisibility?.({ visibilityProperty: true }) ?? true)) continue
        const rect = element.getBoundingClientRect()
        const left = rect.left - origin.left, top = rect.top - origin.top
        // Only text starting low on the instrument (its lower quarter: the
        // bounding box runs a little past the visible bottom) and under the
        // ring's middle counts: text beside the instrument (the landscape
        // Watch node, level with its middle) is not in the ring's way, and
        // the ring's tapered tips pass above text at its sides.
        const center = extent.left + extent.width / 2
        const inner = { left: center - width * 0.4, right: center + width * 0.4 }
        const below = top >= extent.top + extent.height * 0.75
        if (rect.width && below && left < inner.right && left + rect.width > inner.left) limit = Math.min(limit, top - 8)
      }
      const height = width * ROTATE_RING.aspect
      const x = Math.max(8, Math.min(viewport.width - width - 8, extent.left + extent.width / 2 - width / 2))
      const y = Math.min(limit - height, extent.top + extent.height + ROTATE_RING.gap)
      for (const layer of [hint, rotateHintBackRef.current]) {
        if (!layer) continue
        layer.style.width = `${width.toFixed(1)}px`
        layer.style.height = `${height.toFixed(1)}px`
        layer.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      }
    }

    // The explorer text the ring keeps above lays itself out after the stage
    // (SpatialTypography's description:layout) and then glides there
    // (description:settled), so a placement made during a relayout, such as
    // a phone turning, can see it half-moved; when it has actually moved,
    // the ring is placed again.
    let textLayout = ''
    // While the stage relays out (a resize, a phone turning), the ring hides
    // instead of hopping through the text's in-between positions; it is
    // placed again once the description has settled, or after a moment if
    // nothing moved.
    let relayoutTimer = 0
    const finishRelayout = () => {
      window.clearTimeout(relayoutTimer)
      relayoutTimer = 0
      const hint = rotateHintRef.current
      if (!hint?.dataset.relayout) return
      delete hint.dataset.relayout
      if (rotateHintBackRef.current) delete rotateHintBackRef.current.dataset.relayout
      hintPlacement = ''
      if (hintShown) stage.requestRender()
    }
    const startRelayout = () => {
      for (const layer of [rotateHintRef.current, rotateHintBackRef.current]) if (layer) layer.dataset.relayout = 'true'
      window.clearTimeout(relayoutTimer)
      relayoutTimer = window.setTimeout(finishRelayout, ROTATE_RING_RELAYOUT_MS)
    }
    const onTextSettled = () => {
      onTextLayout()
      finishRelayout()
    }
    const onTextLayout = () => {
      const next = [...host.ownerDocument.querySelectorAll<HTMLElement>(ROTATE_RING_AVOID)].map(element => {
        const rect = element.getBoundingClientRect()
        return `${Math.round(rect.left)},${Math.round(rect.top)},${Math.round(rect.width)},${Math.round(rect.height)}`
      }).join('|')
      if (next === textLayout) return
      textLayout = next
      hintPlacement = ''
      if (hintShown) stage.requestRender()
    }
    host.ownerDocument.addEventListener('description:layout', onTextLayout)
    host.ownerDocument.addEventListener('description:settled', onTextSettled)

    const resize = () => {
      if (!stage.resize()) return
      footerInset = Number.parseFloat(getComputedStyle(host).getPropertyValue('--map-footer-height')) || 0
      overlayMeasurements = createOverlayMeasurements()
      hintPlacement = ''
      startRelayout()
      // Aspect just changed, so re-frame against it every time, not only
      // once at load — otherwise a resize that changes the aspect a lot
      // (e.g. a phone rotating between portrait and landscape) could leave
      // the model cropped or oddly small instead of re-fit to its frame.
      framing.reframe()

    }

    // Camera focus follows the anatomy store's selection.
    const unsubscribeAnatomy = useAnatomyStore.subscribe((state, previous) => {
      // Before any focus travel starts, so the sway never fights it.
      updateAffordance()
      if (state.selectedPartId !== previous.selectedPartId) focus.apply(state.selectedPartId, false)
      if (!state.selectedPartId) return // Keep note text through its exit.
      if (state.selectedActionId === previous.selectedActionId && state.selectedMedia === previous.selectedMedia) return
      const action = state.selectedActionId && state.selectedMedia === 'audio'
        ? partAction(instrumentId, state.selectedPartId, state.selectedActionId) : undefined
      setNoteContent(action
        ? { title: action.title, description: action.technique.description }
        : partNote(state.selectedPartId))
    })
    const syncHotspots = () => {
      if (!model) return
      markers.syncHotspots(useHotspotStore.getState().hotspots)
      // A focused hotspot that was deleted (or renamed) in the editor has
      // nothing left to focus on.
      const focusedPartId = focus.focusedPartId()
      if (focusedPartId && !markers.find(focusedPartId)) useAnatomyStore.getState().returnToInstrument()
      // Only parts with a technique to listen to get a hotspot; the debug
      // hotspot editor keeps them all so any can be placed and edited.
      setAnchorItems(markers.all()
        .filter(({ id }) => debug || hasPartAudio(instrumentId, id))
        .map(({ id, label, hotspot }) => ({ id, label, hotspot })))
      stage.requestRender()
    }
    const unsubscribeHotspots = useHotspotStore.subscribe((state, previous) => {
      if (state.hotspots !== previous.hotspots) syncHotspots()
    })

    const disposeGestures = createCanvasGestures(renderer.domElement, {
      // Debug-mode hotspot placement / reposition.
      onTap: event => {
        const { placement, editingId, add, update, setPlacement } = useHotspotStore.getState()
        if (!debug || placement === 'off' || !model) return false
        const hit = pickModelPoint(event, renderer.domElement, camera, model)
        if (!hit) return false
        // Stored relative to the model root, so the runtime rotation and
        // re-centering applied at load don't leak into the saved data.
        const position = roundVec3(model.worldToLocal(hit.clone()).toArray())
        if (placement === 'add') add(position)
        else if (editingId) {
          update(editingId, { position })
          setPlacement('off')
        }
        return true
      },
      // Clicking the bare canvas (not a dot — those are separate overlay
      // buttons the click never reaches) while a part is focused zooms back
      // out, same as Back.
      onClick: () => {
        if (focus.focusedPartId() !== null) useAnatomyStore.getState().returnToInstrument()
      },
    })

    const detachDebug = debugBridge.attach({
      applyLighting: stage.setLighting,
      setModelRotation: pose => {
        if (!model) return
        placeModel(pose)
        // From the front, at whatever distance the new pose fits — unless a
        // focused part owns the camera (the re-frame then waits for it).
        if (!focus.ownsCamera()) {
          camera.position.set(0, 0, 1)
          controls.target.set(0, 0, 0)
        }
        framing.reframe()
      },
      // Re-applies focus even when this part is already selected (the store
      // wouldn't change, so its subscription wouldn't fire) — e.g. to check
      // a hotspot view that was just re-captured.
      previewPart: id => {
        const anatomy = useAnatomyStore.getState()
        if (anatomy.selectedPartId === id) focus.apply(id, false)
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
      framing.reframe()
    })

    const observer = new ResizeObserver(resize)
    observer.observe(host)
    const labelObserver = new ResizeObserver(stage.requestRender)
    const noteText = anatomyLabelRef.current?.querySelector('.instrument-anatomy-label__text')
    if (noteText) labelObserver.observe(noteText)
    void stage.loadModel(url, loadedModel => {
      model = loadedModel
      objectBounds = createObjectBounds(model)
      placeModel(rotation)
      markers.attach(model)
      syncHotspots()
      resize()
    }).then(loadedModel => {
      if (!loadedModel || disposed) return
      setStatus('ready')
      onReady()
      modelReady = true
      updateAffordance()
    }).catch(() => {
      if (!disposed) {
        setStatus('error')
        onError()
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(visibilityFrame)
      idleOrbit.stop()
      window.clearTimeout(startTimer)
      host.ownerDocument.removeEventListener('description:layout', onTextLayout)
      host.ownerDocument.removeEventListener('description:settled', onTextSettled)
      window.clearTimeout(relayoutTimer)
      controls.removeEventListener('start', onControlsStart)
      controls.removeEventListener('change', onControlsChange)
      controls.removeEventListener('end', onControlsEnd)
      unsubscribeAffordanceSettle()
      unsubscribeExperience()
      reducedMotion.removeEventListener('change', onMotionPreference)
      requestRenderRef.current = () => {}
      observer.disconnect()
      labelObserver.disconnect()
      unsubscribeRender()
      unsubscribeSettle()
      unsubscribeAnatomy()
      unsubscribeHotspots()
      unsubscribeView()
      detachDebug()
      disposeGestures()
      focus.dispose()
      model?.removeFromParent()
      stage.dispose()
    }
  }, [debug, debugBridge, initialCamera, instrumentId, onError, onReady, rotation, url, view])

  return <div ref={hostRef} className="instrument-explore__model-canvas relative isolate block size-full">
    {status === 'loading' && <output className="instrument-explore__status absolute top-1/2 left-1/2 m-0 text-[#aaa9a3] text-[0.72rem] tracking-[0.08em] uppercase [transform:translate(-50%,-50%)]">Loading {name} model</output>}
    {status === 'error' && <p className="instrument-explore__status absolute top-1/2 left-1/2 m-0 text-[#aaa9a3] text-[0.72rem] tracking-[0.08em] uppercase [transform:translate(-50%,-50%)]" role="alert">{name} model unavailable</p>}
    <div ref={spotlightRef} className="instrument-explore__spotlight pointer-events-none absolute inset-0 z-[1] opacity-0" aria-hidden="true" />
    {anchorItems.length > 0 && (
      <div inert={selectedPartId !== null} className={[
        'instrument-anchors pointer-events-none absolute inset-0 z-[2]',
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
              'instrument-anchor pointer-events-auto invisible absolute top-0 left-0 m-0 flex size-[44px] items-center justify-center border-0 bg-transparent p-0 opacity-100 cursor-pointer focus-visible:rounded-full focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-[3px]',
              anchor.id === selectedPartId && 'instrument-anchor--selected',
              debug && anchor.hotspot && anchor.id === editingHotspotId && 'instrument-anchor--editing',
            ].filter(Boolean).join(' ')}
            aria-label={anchor.label}
            onClick={() => {
              if (debug && anchor.hotspot) useHotspotStore.getState().setEditing(anchor.id)
              selectAnatomyPart(anchor.id)
            }}
          >
            {/* The Watch performance node's glowing circle, with a magnifier. */}
            <span className="explore-action-surface instrument-anchor__surface pointer-events-none grid size-[44px] flex-none place-items-center rounded-full text-ivory" aria-hidden="true"><ActionIcon media="inspect" /></span>
          </button>
        ))}
      </div>
    )}
    {/* Under the instrument, a ring tilted in depth and formed by two
        arrows chasing each other round it (scene/rotate-ring.ts), pulsing
        slowly (instrument-explore.css). Static: placed from the instrument's
        full-orbit extent (placeRotateHint), so neither the sway nor a turn
        moves it. Depth fades it from the front edge to the back. Two layers
        in the same place: the far arrow below the canvas (z -1 inside this
        isolated host; the canvas is transparent where there is no model),
        so the instrument covers it where it passes behind, and the near
        arrow over it. */}
    <div ref={rotateHintBackRef} className="instrument-rotate-hint pointer-events-none absolute top-0 left-0 z-[-1]" data-visible={rotateHint} aria-hidden="true">
      <RotateRingArrow path={ROTATE_RING_PATHS.back} gradient="instrument-rotate-ring-depth-back" />
    </div>
    <div ref={rotateHintRef} className="instrument-rotate-hint pointer-events-none absolute top-0 left-0 z-[2]" data-visible={rotateHint} aria-hidden="true">
      <RotateRingArrow path={ROTATE_RING_PATHS.front} gradient="instrument-rotate-ring-depth-front" />
    </div>
    <div ref={anatomyLabelRef} className="instrument-anatomy-label pointer-events-none absolute top-0 left-0 z-[2]"
      data-visible={selectedPartId !== null}
      aria-hidden={selectedPartId === null}
      inert={selectedPartId === null}
    >
      <div className="instrument-anatomy-label__content absolute inset-0">
        <div className="instrument-anatomy-label__text absolute left-[max(16px,env(safe-area-inset-left))]">
          {noteIcon && <span className="instrument-anatomy-label__icon mb-3 block text-ivory [&_svg]:size-10" aria-hidden="true"><ActionIcon media={noteIcon} /></span>}
          <div role="status"><h3 className="m-0 mb-2 font-identity text-[clamp(1.4rem,2.2vw,1.8rem)] leading-[1.15] font-normal text-ivory">{noteContent.title}</h3><p className="m-0 font-identity text-[clamp(0.9rem,0.75rem+0.3vw,1.1rem)] leading-normal text-fog">{noteContent.description}</p></div>
          {activeAudio && audioState.error && <p className="m-0 font-identity text-[clamp(0.9rem,0.75rem+0.3vw,1.1rem)] leading-normal text-fog" role="alert">{audioState.error}</p>}
        </div>
      </div>
    </div>
    {notePartId && actions.length > 0 && <div className="instrument-actions pointer-events-none absolute inset-0 z-[3] pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]" role="group"
      data-visible={selectedPartId !== null}
      inert={selectedPartId === null}
      aria-hidden={selectedPartId === null}
      aria-label={`${anatomyLabel(notePartId)} actions`}
    >
      {actions.map((action, index) => <button
        key={`${notePartId}:${action.id}`}
        type="button"
        className="instrument-action pointer-events-auto invisible absolute top-0 left-0 size-[48px] rounded-full border-0 bg-transparent p-0 text-white cursor-pointer focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-4"
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
      ><span className="instrument-action__surface relative grid size-full place-items-center rounded-[inherit]">
        {action.media === 'audio' && <svg className="instrument-action__progress pointer-events-none absolute -inset-px size-[calc(100%+2px)] overflow-visible fill-none stroke-white stroke-3 opacity-0" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" /></svg>}
        <ActionIcon media={action.media === 'audio' && audioState.id === action.id && audioState.playing ? 'pause' : action.media} />
      </span></button>)}
    </div>}
    {debug && <InstrumentDebugPanel instrumentId={instrumentId} rotation={rotation} bridge={debugBridge} />}
  </div>
}
