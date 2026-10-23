import * as THREE from 'three'

export type Viewport = { width: number; height: number }
export type ProjectedObjectBounds = {
  screen: { left: number; top: number; width: number; height: number }
  /** Positive distance along the camera's forward axis; not world-Z size. */
  depth: { near: number; far: number; size: number }
  world: THREE.Box3
}

// Geometry boxes are measured once, then their local corners are transformed
// through each mesh's current matrixWorld and the camera on demand. Bounds
// are conservative (not a pixel silhouette), with O(meshes) work per update.
// This handles root/child rotation, translation, scaling, and non-origin meshes.
// Geometry edits need a new instance; the full-orbit envelope is
// createOrbitEnvelope (orbit-envelope.ts), from sampled vertices.
export function createObjectBounds(root: THREE.Object3D) {
  const meshes: { mesh: THREE.Mesh; corners: THREE.Vector3[] }[] = []
  root.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox
    if (!box || box.isEmpty()) return
    meshes.push({ mesh, corners: Array.from({ length: 8 }, (_, i) => new THREE.Vector3(
      i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z,
    )) })
  })
  const cameraCorners = Array.from({ length: 8 }, () => new THREE.Vector3())
  // Box edges as corner-index bit flips, and the depth planes, hoisted out of
  // measure()'s per-mesh loop (it can run every rendered frame).
  const edgeBits = [1, 2, 4] as const
  const depthPlanes = [0, 0]
  const worldPoint = new THREE.Vector3(), projected = new THREE.Vector3(), clipped = new THREE.Vector3()
  return {
    measure(camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, viewport: Viewport): ProjectedObjectBounds | undefined {
      if (viewport.width <= 0 || viewport.height <= 0) return undefined
      root.updateWorldMatrix(true, true)
      camera.updateWorldMatrix(true, false)
      const world = new THREE.Box3()
      let near = Infinity, far = -Infinity
      let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity
      const include = (point: THREE.Vector3) => {
        projected.copy(point).applyMatrix4(camera.projectionMatrix)
        const x = (projected.x + 1) * viewport.width / 2, y = (1 - projected.y) * viewport.height / 2
        left = Math.min(left, x); right = Math.max(right, x)
        top = Math.min(top, y); bottom = Math.max(bottom, y)
      }
      for (const { mesh, corners } of meshes) {
        let visible = true
        for (let parent: THREE.Object3D | null = mesh; parent; parent = parent.parent) if (!parent.visible) { visible = false; break }
        if (!visible || !camera.layers.test(mesh.layers)) continue
        for (let i = 0; i < 8; i++) {
          worldPoint.copy(corners[i]).applyMatrix4(mesh.matrixWorld)
          world.expandByPoint(worldPoint)
          const point = cameraCorners[i].copy(worldPoint).applyMatrix4(camera.matrixWorldInverse)
          const distance = -point.z
          near = Math.min(near, distance); far = Math.max(far, distance)
          if (distance >= camera.near && distance <= camera.far) include(point)
        }
        // Clip box edges against depth planes before perspective division.
        // A box crossing the camera must not invert or yield infinite bounds.
        depthPlanes[0] = camera.near; depthPlanes[1] = camera.far
        for (let i = 0; i < 8; i++) for (const bit of edgeBits) {
          const j = i ^ bit
          if (j <= i) continue
          const a = cameraCorners[i], b = cameraCorners[j]
          const da = -a.z, db = -b.z
          for (const plane of depthPlanes) {
            if ((da < plane && db > plane) || (da > plane && db < plane)) {
              include(clipped.copy(a).lerp(b, (plane - da) / (db - da)))
            }
          }
        }
      }
      if (!Number.isFinite(left) || !Number.isFinite(top)) return undefined
      return { screen: { left, top, width: right - left, height: bottom - top }, depth: { near, far, size: far - near }, world }
    },
  }
}

/** Project a circular marker in the world XY plane, including its radius. */
export function projectWorldCircle(center: readonly [number, number, number], radius: number, camera: THREE.Camera, viewport: Viewport) {
  const point = new THREE.Vector3(...center).project(camera)
  const edgeX = new THREE.Vector3(center[0] + radius, center[1], center[2]).project(camera)
  const edgeY = new THREE.Vector3(center[0], center[1] + radius, center[2]).project(camera)
  const x = (point.x + 1) * viewport.width / 2, y = (1 - point.y) * viewport.height / 2
  const rx = Math.max(2, Math.abs(edgeX.x - point.x) * viewport.width / 2)
  const ry = Math.max(2, Math.abs(edgeY.y - point.y) * viewport.height / 2)
  return { x: x - rx, y: y - ry, width: rx * 2, height: ry * 2 }
}
