import * as THREE from 'three'

// Mirrors the NDC->pixel conversion already used by
// src/features/orchestra-map/three/camera-focus.ts's projectedNodeBounds and
// inline in OrchestraScene.ts's label layout — duplicated here (a few lines)
// rather than shared, since the two scenes/cameras are otherwise unrelated.
export function projectToScreen(point: THREE.Vector3, camera: THREE.Camera, viewport: { width: number; height: number }) {
  const ndc = point.clone().project(camera)
  return { x: (ndc.x + 1) * viewport.width / 2, y: (1 - ndc.y) * viewport.height / 2 }
}

// A point sitting essentially ON an obstacle's own surface would otherwise
// report a self-intersection with that same adjacent surface, so the ray
// stops just short of `to` (by `epsilon`) rather than reaching it — only a
// genuinely closer surface in front counts as occluding.
export function isOccluded(from: THREE.Vector3, to: THREE.Vector3, obstacle: THREE.Object3D, epsilon: number, raycaster = new THREE.Raycaster()) {
  const distance = from.distanceTo(to)
  const direction = to.clone().sub(from).normalize()
  raycaster.set(from, direction)
  raycaster.far = Math.max(0, distance - epsilon)
  return raycaster.intersectObject(obstacle, true).length > 0
}
