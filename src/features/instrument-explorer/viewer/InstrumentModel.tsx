import { createObjectBounds } from '../../../lib/spatial-layout'
import { createOrbitEnvelope } from '../../../lib/spatial-layout/orbit-envelope'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'

import { anatomyCameraPreset, type CameraPreset } from '../content/anatomy-camera'
import { hotspotCameraPreset, roundVec3 } from '../content/hotspots'
import { anatomyDescription, anatomyLabel } from '../content/instrument-anatomy'
import { demonstrationsFor, hasPartAudio, partAction, radialPartActions } from '../content/technique'
import { instrumentCatalog } from '../../../store/catalog'
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
import { createPartFocus } from '../scene/part-focus'
import { descriptionZoomed } from '../typography/instrument-description'
import type { CameraRig } from '../typography/label-travel'
import { useAnatomyStore } from '../../../store/anatomy-store'
import { useExploreLayoutStore } from '../../../store/explore-layout-store'
import { useHotspotStore } from '../../../store/hotspot-store'
import { ActionIcon } from './ActionIcon'
import { writeFocusOverlay } from './focus-overlay'
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
  const instrumentColor = instrumentCatalog.find(group => group.instrument === instrumentId)?.color
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
    const writeOverlays = () => {
      const viewport = stage.size()
      if (!viewport.width || !viewport.height) return
      const focused = markers.find(focus.focusedPartId())
      focused?.object.getWorldPosition(focusPoint)
      writeFocusOverlay({
        host,
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
      const pending = markers.refreshOcclusion(instrumentExplorerConfig.anchors.occlusionChecksPerFrame)
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
      objectBounds?.invalidateTransforms()
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

    const resize = () => {
      if (!stage.resize()) return
      // Aspect just changed, so re-frame against it every time, not only
      // once at load — otherwise a resize that changes the aspect a lot
      // (e.g. a phone rotating between portrait and landscape) could leave
      // the model cropped or oddly small instead of re-fit to its frame.
      framing.reframe()

    }

    // Camera focus follows the anatomy store's selection.
    const unsubscribeAnatomy = useAnatomyStore.subscribe((state, previous) => {
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
      objectBounds = createObjectBounds(model, { static: true })
      placeModel(rotation)
      markers.attach(model)
      syncHotspots()
      resize()
    }).then(loadedModel => {
      if (!loadedModel || disposed) return
      setStatus('ready')
      onReady()
    }).catch(() => {
      if (!disposed) {
        setStatus('error')
        onError()
      }
    })

    return () => {
      disposed = true
      cancelAnimationFrame(visibilityFrame)
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
      // The hotspots glow in the instrument's own color from the map.
      style={{ '--anchor-color': instrumentColor } as CSSProperties}
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
              'instrument-anchor pointer-events-auto invisible absolute top-0 left-0 m-0 flex size-[clamp(2.2rem,6vmin,4.4rem)] items-center justify-center border-0 bg-transparent p-0 opacity-100 cursor-pointer focus-visible:rounded-full focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-ivory focus-visible:outline-offset-2',
              anchor.id === selectedPartId && 'instrument-anchor--selected',
              debug && anchor.hotspot && anchor.id === editingHotspotId && 'instrument-anchor--editing',
            ].filter(Boolean).join(' ')}
            aria-label={anchor.label}
            onClick={() => {
              if (debug && anchor.hotspot) useHotspotStore.getState().setEditing(anchor.id)
              selectAnatomyPart(anchor.id)
            }}
          >
            <span className="instrument-anchor__dot pointer-events-none relative size-[34%] flex-none rounded-full" aria-hidden="true" />
          </button>
        ))}
      </div>
    )}
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
