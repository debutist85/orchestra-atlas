import * as THREE from 'three'

// Mirrors the NDC->pixel conversion already used by
// src/features/orchestra-map/three/camera-focus.ts's projectedNodeBounds and
// inline in OrchestraScene.ts's label layout — duplicated here (a few lines)
// rather than shared, since the two scenes/cameras are otherwise unrelated.
// Scratch for projectToScreen: it runs per hotspot per rendered frame.
const ndc = new THREE.Vector3()
export function projectToScreen(point: THREE.Vector3, camera: THREE.Camera, viewport: { width: number; height: number }) {
  ndc.copy(point).project(camera)
  return { x: (ndc.x + 1) * viewport.width / 2, y: (1 - ndc.y) * viewport.height / 2 }
}

const intersectionBuffers = new WeakMap<THREE.Raycaster, THREE.Intersection[]>()

// A point sitting essentially ON an obstacle's own surface would otherwise
// report a self-intersection with that same adjacent surface, so the ray
// stops just short of `to` (by `epsilon`) rather than reaching it — only a
// genuinely closer surface in front counts as occluding.
export function isOccluded(from: THREE.Vector3, to: THREE.Vector3, obstacle: THREE.Object3D, epsilon: number, raycaster = new THREE.Raycaster()) {
  const distance = from.distanceTo(to)
  raycaster.ray.origin.copy(from)
  raycaster.ray.direction.copy(to).sub(from).normalize()
  raycaster.far = Math.max(0, distance - epsilon)
  // Raycaster's recursive helper sorts every hit across the entire tree.
  // Occlusion only needs one hit, so stop at the first occluding object.
  let hits = intersectionBuffers.get(raycaster)
  if (!hits) { hits = []; intersectionBuffers.set(raycaster, hits) }
  return intersectsTree(obstacle, raycaster, hits)
}

// Depth-first, stopping at the first hit; a plain function so a check does
// not allocate a closure (occlusion runs per hotspot across frames).
function intersectsTree(object: THREE.Object3D, raycaster: THREE.Raycaster, buffer: THREE.Intersection[]): boolean {
  if (raycaster.layers.test(object.layers)) {
    buffer.length = 0
    const descend: unknown = object.raycast(raycaster, buffer)
    if (buffer.length) { buffer.length = 0; return true }
    if (descend === false) return false
  }
  for (const child of object.children) if (intersectsTree(child, raycaster, buffer)) return true
  return false
}
