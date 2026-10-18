import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

import { anatomyCameraPreset } from '../content/anatomy-camera'
import { hotspotCameraPreset, roundVec3 } from '../content/hotspots'
import { anatomyDescription, anatomyLabel } from '../content/instrument-anatomy'
import { demonstrationsFor, partAction, radialPartActions } from '../content/technique'
import type { OrchestraInstrument } from '../../orchestra-map/config'
import { instrumentExplorerConfig } from '../config'
import { createDebugBridge, explorerDebugEnabled } from '../debug/debug-bridge'
import { InstrumentDebugPanel } from '../debug/InstrumentDebugPanel'
import type { InstrumentViewSignal } from '../instrument-view'
import { createCanvasGestures, pickModelPoint } from '../scene/canvas-gestures'
import { createInstrumentStage } from '../scene/instrument-stage'
import { instrumentLighting } from '../scene/instrument-lighting'
import { instantiateInstrumentModel } from '../scene/instrument-model-resource'
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
    let ready = false
    let model: THREE.Object3D | undefined
    const stage = createInstrumentStage(host, {
      lighting: instrumentLighting(instrumentId),
      // Debug mode also allows dolly-zoom, so a captured hotspot view can
      // be composed closer or further than the general framing.
      enableZoom: instrumentExplorerConfig.controls.enableZoom || debug,
    })
    const { camera, controls, renderer } = stage
    const rig: CameraRig = { camera, target: controls.target }
    view.setCameraRig(rig)
    const markers = createMarkers(camera)
    const framing = createModelFraming(stage, view, () => focus.ownsCamera())
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

    const unsubscribeRender = stage.onRender(() => {
      markers.refreshOcclusion(instrumentExplorerConfig.anchors.occlusionChecksPerFrame)
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
    // The camera has come to rest: one full occlusion pass makes every
    // marker exact.
    const unsubscribeSettle = stage.onSettle(() => {
      markers.refreshOcclusion(markers.all().length)
      writeOverlays()
      focus.writeSpotlight()
    })
    requestRenderRef.current = stage.requestRender

    const resize = () => {
      if (!stage.resize()) return
      // Aspect just changed, so re-frame against it every time, not only
      // once at load — otherwise a resize that changes the aspect a lot
      // (e.g. a phone rotating between portrait and landscape) could leave
      // the model cropped or oddly small instead of re-fit to its frame.
      framing.reframe()
      if (model && !ready) {
        ready = true
        onReady()
      }
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
      setAnchorItems(markers.all().map(({ id, label, hotspot }) => ({ id, label, hotspot })))
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
    void instantiateInstrumentModel(url).then(loadedModel => {
      if (disposed) return
      model = loadedModel
      model.rotation.set(...rotation)
      model.updateMatrixWorld(true)
      const bounds = new THREE.Box3().setFromObject(model)
      const center = bounds.getCenter(new THREE.Vector3())
      const size = bounds.getSize(new THREE.Vector3())
      model.position.sub(center)
      stage.scene.add(model)
      view.setModelAspect(size.x / size.y)
      // The model never moves (the camera orbits it), so its geometry is
      // sampled once, in its placed pose.
      framing.setModelPoints(sampleModelPoints(model))
      markers.attach(model, size)
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
