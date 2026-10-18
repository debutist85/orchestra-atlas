import * as THREE from 'three'

// Lets HTML titles travel with the hotspot zoom: as the camera dollies
// toward the focused part, each title slides away from the part's on-screen
// position and grows, as text standing in the scene would; zooming back out
// brings it home. Only the dolly drives the titles, not the camera's turn
// toward the part — projecting fixed world points through a camera that
// tilts as it travels swings them past their place and back, which reads as
// a jump.

export type CameraRig = {
  camera: THREE.PerspectiveCamera
  target: THREE.Vector3
  // The world point the hotspot zoom centers on, set when a part is focused
  // and kept through the zoom back out.
  focus?: THREE.Vector3
}

export type TravelAnchor = {
  // The title's center (stage px) and the camera as it was when the zoom
  // started; resolved against the focus point once that is known (the
  // camera owner sets it in the same moment the zoom starts).
  point: { x: number; y: number }
  from: THREE.PerspectiveCamera
  // Fraction of the camera-to-focus distance the title's plane sits nearer
  // the camera (negative: further).
  nearer: number
  resolved?: { offset: { x: number; y: number }; startDistance: number }
}

const toScreen = (world: THREE.Vector3, camera: THREE.Camera, stage: { width: number; height: number }) => {
  camera.updateMatrixWorld()
  const ndc = world.clone().project(camera)
  return { x: (ndc.x + 1) / 2 * stage.width, y: (1 - ndc.y) / 2 * stage.height }
}

export function captureTravelAnchor(point: { x: number; y: number }, rig: CameraRig, nearer: number): TravelAnchor {
  rig.camera.updateMatrixWorld()
  return { point, from: rig.camera.clone(), nearer }
}

// Stage-px position and scale of a title through the camera as it is now;
// undefined once the camera has passed the title's plane. Without a focus
// point the title stays where it was.
export function projectTravelAnchor(anchor: TravelAnchor, rig: CameraRig, stage: { width: number; height: number }) {
  const focus = rig.focus
  if (!focus) return { ...anchor.point, scale: 1 }
  if (!anchor.resolved) {
    const start = toScreen(focus, anchor.from, stage)
    anchor.resolved = {
      offset: { x: anchor.point.x - start.x, y: anchor.point.y - start.y },
      startDistance: anchor.from.position.distanceTo(focus),
    }
  }
  const { offset, startDistance } = anchor.resolved
  // The title's plane is `nearer` of the starting distance in front of the
  // focus; dollying in closes on both by the same amount.
  const planeStart = startDistance * (1 - anchor.nearer)
  const planeNow = rig.camera.position.distanceTo(focus) - anchor.nearer * startDistance
  if (planeNow <= planeStart * 0.02) return undefined
  const zoom = planeStart / planeNow
  const center = toScreen(focus, rig.camera, stage)
  return { x: center.x + offset.x * zoom, y: center.y + offset.y * zoom, scale: zoom }
}
