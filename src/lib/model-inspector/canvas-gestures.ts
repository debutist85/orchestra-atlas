import * as THREE from 'three'

// A pointer gesture that travels further than this is an orbit drag, not a
// tap — so placing a hotspot or tapping out of a focused part never fires at
// the end of a rotation.
const TAP_TOLERANCE_PX = 6

// Tap detection on the canvas, listening alongside OrbitControls (not
// instead of it) so rotation is untouched; any multi-touch gesture (pinch)
// never counts as a tap. `onTap` sees the tap first and returns true to
// consume it; otherwise the click that follows reaches `onClick`.
export function createCanvasGestures(element: HTMLElement, { onTap, onClick }: { onTap: (event: PointerEvent) => boolean; onClick: () => void }) {
  const activePointers = new Set<number>()
  let gestureStart = { x: 0, y: 0 }
  let gestureIsDrag = false
  let tapConsumed = false
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
    tapConsumed = !gestureIsDrag && onTap(event)
  }
  const handlePointerCancel = (event: PointerEvent) => {
    activePointers.delete(event.pointerId)
    gestureIsDrag = true
  }
  const handleClick = () => {
    if (gestureIsDrag || tapConsumed) return
    onClick()
  }
  element.addEventListener('pointerdown', handlePointerDown)
  element.addEventListener('pointerup', handlePointerUp)
  element.addEventListener('pointercancel', handlePointerCancel)
  element.addEventListener('click', handleClick)
  return () => {
    element.removeEventListener('pointerdown', handlePointerDown)
    element.removeEventListener('pointerup', handlePointerUp)
    element.removeEventListener('pointercancel', handlePointerCancel)
    element.removeEventListener('click', handleClick)
  }
}

const pickRaycaster = new THREE.Raycaster()
const pickPointer = new THREE.Vector2()

// The model surface point under a pointer, in world space.
export function pickModelPoint(event: PointerEvent, element: HTMLElement, camera: THREE.Camera, model: THREE.Object3D) {
  const rect = element.getBoundingClientRect()
  pickPointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1)
  pickRaycaster.setFromCamera(pickPointer, camera)
  return pickRaycaster.intersectObject(model, true)[0]?.point
}
