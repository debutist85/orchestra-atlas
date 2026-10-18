import * as THREE from 'three'
import gsap from 'gsap'

import type { CameraPreset } from '../content/anatomy-camera'
import { anatomySpotlightDefaults, anatomySpotlightOverrides, instrumentExplorerConfig } from '../config'
import type { CameraRig } from '../typography/label-travel'
import { projectToScreen } from './anchor-projection'
import type { InstrumentStage, Orientation } from './instrument-stage'
import type { Marker, Markers } from './markers'
import type { ModelFraming } from './model-framing'

type Options = {
  stage: InstrumentStage
  framing: ModelFraming
  markers: Markers
  rig: CameraRig
  // The vignette that darkens everything but the focused part.
  spotlight: HTMLElement | null
  // Debug mode keeps orbit/zoom live while focused, so a previewed hotspot
  // view can be fine-tuned and re-captured in place.
  orbitWhileFocused: boolean
  // A composed view for a part, if it has one (anatomy-camera.ts, hotspot JSON).
  cameraPreset: (marker: Marker, orientation: Orientation) => CameraPreset | undefined
  onFocusStart: (partId: string) => void
  // The destination pose changed: overlays laid out against it re-measure.
  onDestinationChange: () => void
}

// No authored preset for a part falls back to an automatic close-up: keep
// the direction the visitor is already viewing from, just move closer and
// re-center on the part. Either way the camera looks at the part and the
// projection shift eases to zero, so it ends in the center of the stage.
const FOCUS_DISTANCE_FRACTION = 0.22

// Camera focus on one part (anatomy anchor or hotspot) and the return to
// the general view — a sibling mechanism to experience-motion.ts's
// map<->explore DOM choreography, not an extension of it (that class only
// knows the two top-level stage modes). Killing any in-flight tween before
// starting a new one handles rapid re-selection and Back-during-transition
// without stacked timelines or inconsistent state.
export function createPartFocus({ stage, framing, markers, rig, spotlight, orbitWhileFocused, cameraPreset, onFocusStart, onDestinationChange }: Options) {
  const { camera, controls } = stage
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const worldPosition = new THREE.Vector3()
  // resize/re-frame read this to know whether the general framing owns the
  // camera right now or a focused part does.
  let focusedPartId: string | null = null
  let focusTimeline: gsap.core.Timeline | undefined
  let generalCameraState: { position: THREE.Vector3; target: THREE.Vector3 } | undefined
  // The note projects through the destination pose, not the travelling
  // camera, so its own entry is independent of the zoom's screen motion.
  let noteCamera: THREE.PerspectiveCamera | undefined
  // Retain the last anchor during the return tween so the light follows it
  // all the way out, independent of marker occlusion and React mounting.
  let spotlightPartId: string | null = null
  const spotlightState = { opacity: 0 }
  const stageCenter = { x: 0, y: 0 }

  const writeSpotlight = () => {
    if (!spotlight || !spotlightPartId) return
    const anchor = markers.find(spotlightPartId)
    if (!anchor) return
    const { width, height } = stage.size()
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
      Object.assign(framing.viewShift, shift)
      framing.applyViewShift()
      controls.update()
      spotlightState.opacity = focusedPartId ? 1 : 0
      writeSpotlight()
      stage.requestRender()
      onComplete?.()
      return
    }
    const timeline = gsap.timeline({
      onUpdate: () => {
        framing.applyViewShift()
        controls.update()
        stage.requestRender()
      },
      onComplete,
    })
    timeline.to(camera.position, { x: position.x, y: position.y, z: position.z, duration, ease: 'power2.inOut' }, 0)
    timeline.to(controls.target, { x: target.x, y: target.y, z: target.z, duration, ease: 'power2.inOut' }, 0)
    // The framing glides between the composed frame and the stage center
    // on the same curve, so the part arrives centered.
    timeline.to(spotlightState, { opacity: focusedPartId ? 1 : 0, duration, ease: 'power2.inOut' }, 0)
    timeline.to(framing.viewShift, { x: shift.x, y: shift.y, duration, ease: 'power2.inOut' }, 0)
    focusTimeline = timeline
  }

  const apply = (partId: string | null, instant: boolean) => {
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
        framing.flushPendingReframe()
      }
      if (previous) tweenCamera(previous.position, previous.target, framing.frameShift(), instant, undefined, landed)
      else landed()
      return
    }
    // Disabled from the moment the zoom-in starts (not just once framed) —
    // the curated composition isn't meant to be nudged mid-flight either.
    controls.enabled = orbitWhileFocused
    const anchor = markers.find(partId)
    if (!anchor) return
    onFocusStart(partId)
    spotlightPartId = partId
    if (!generalCameraState) generalCameraState = { position: camera.position.clone(), target: controls.target.clone() }
    const override = cameraPreset(anchor, stage.orientation())
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
    onDestinationChange()
    tweenCamera(position, target, stageCenter, instant, override?.duration)
  }

  return {
    apply,
    focusedPartId: () => focusedPartId,
    noteCamera: () => noteCamera,
    ownsCamera: () => focusedPartId !== null || (focusTimeline?.isActive() ?? false),
    writeSpotlight,
    dispose: () => { focusTimeline?.kill() },
  }
}
