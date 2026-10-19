import * as THREE from 'three'

// The model's actual geometry, for framing it exactly. Its bounding box is
// a poor stand-in under perspective: fitting the box assumes every edge sits
// on the box's nearest face, which shrinks a thin instrument well below the
// space it was given. Points are sampled once, after the model is placed;
// the camera orbits and the model never moves.

// Vertex positions (x, y, z interleaved) in world space, at most `limit`
// points so a dense mesh stays cheap to fit on every resize.
export function sampleModelPoints(model: THREE.Object3D, limit = 60_000) {
  model.updateMatrixWorld(true)
  let total = 0
  model.traverse(object => {
    const mesh = object as THREE.Mesh
    if (mesh.isMesh) total += mesh.geometry.getAttribute('position')?.count ?? 0
  })
  const stride = Math.max(1, Math.ceil(total / limit))
  const points: number[] = []
  const point = new THREE.Vector3()
  let index = 0
  model.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const positions = mesh.geometry.getAttribute('position')
    if (!positions) return
    for (let i = 0; i < positions.count; i++, index++) {
      if (index % stride) continue
      point.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld)
      points.push(point.x, point.y, point.z)
    }
  })
  return new Float32Array(points)
}

// Camera distance, looking down -z at the origin, at which every point fits
// within `halfX`/`halfY` — the frame's half-extents as tangents of the view
// angle (half the frame's share of the canvas × tan(fov/2), times aspect
// horizontally). A point at depth z is (distance − z) from the camera.
export function fitDistance(points: Float32Array, halfX: number, halfY: number) {
  let distance = 0
  for (let i = 0; i < points.length; i += 3) {
    const z = points[i + 2]
    distance = Math.max(distance, z + Math.abs(points[i]) / halfX, z + Math.abs(points[i + 1]) / halfY)
  }
  return distance
}

// Radius of the sphere around the origin containing every point.
export function modelRadius(points: Float32Array) {
  let radius = 0
  for (let i = 0; i < points.length; i += 3) radius = Math.max(radius, Math.hypot(points[i], points[i + 1], points[i + 2]))
  return radius
}

// Screen bounds (stage px) of the points through `camera`.
export function projectedBounds(points: Float32Array, camera: THREE.Camera, viewport: { width: number; height: number }) {
  camera.updateMatrixWorld()
  const point = new THREE.Vector3()
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity
  for (let i = 0; i < points.length; i += 3) {
    point.set(points[i], points[i + 1], points[i + 2]).project(camera)
    const x = (point.x + 1) * viewport.width / 2
    const y = (1 - point.y) * viewport.height / 2
    left = Math.min(left, x); right = Math.max(right, x)
    top = Math.min(top, y); bottom = Math.max(bottom, y)
  }
  return { left, top, width: right - left, height: bottom - top }
}
