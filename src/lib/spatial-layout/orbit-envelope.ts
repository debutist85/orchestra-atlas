import * as THREE from 'three'
import type { ProjectedObjectBounds, Viewport } from './object-bounds'

export type OrbitEnvelopeOptions = {
  target: THREE.Vector3
  distance: number
  minPolarAngle?: number
  maxPolarAngle?: number
}

// Critical angles for a*cos(phi) + b*sin(phi) = value, restricted to
// OrbitControls' polar interval. No sampled camera positions are needed.
function roots(a: number, b: number, value: number, min: number, max: number) {
  const radius = Math.hypot(a, b)
  if (!radius || Math.abs(value) > radius) return []
  const center = Math.atan2(b, a), angle = Math.acos(THREE.MathUtils.clamp(value / radius, -1, 1))
  const result: number[] = []
  for (const sign of [-1, 1]) for (const turn of [-1, 0, 1]) {
    const phi = center + sign * angle + turn * Math.PI * 2
    if (phi >= min && phi <= max) result.push(phi)
  }
  return result
}

/** Conservative projected extent for a full azimuth orbit at fixed distance.
 * Camera looks at target with a fixed up axis. Object geometry does not move.
 * Each point sweeps a circle about the up axis; extrema are solved analytically.
 */
export function projectOrbitEnvelope(
  points: readonly THREE.Vector3[], camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
  viewport: Viewport, options: OrbitEnvelopeOptions,
): ProjectedObjectBounds | undefined {
  if (!points.length || viewport.width <= 0 || viewport.height <= 0 || !Number.isFinite(options.distance) || options.distance <= 0) return undefined
  const min = THREE.MathUtils.clamp(options.minPolarAngle ?? 0, 0, Math.PI)
  const max = THREE.MathUtils.clamp(options.maxPolarAngle ?? Math.PI, 0, Math.PI)
  if (max < min) return undefined
  const perspective = (camera as THREE.PerspectiveCamera).isPerspectiveCamera === true
  const up = camera.up.clone().normalize(), relative = new THREE.Vector3()
  const world = new THREE.Box3()
  let horizontal = 0, low = Infinity, high = -Infinity, near = Infinity, far = -Infinity
  for (const point of points) {
    world.expandByPoint(point)
    relative.copy(point).sub(options.target)
    const y = relative.dot(up), r = Math.sqrt(Math.max(0, relative.lengthSq() - y * y))
    const radiusSquared = r * r + y * y, distance = options.distance
    // Depth extrema over polar angle and the two extreme azimuth radii.
    for (const q of [-r, r]) {
      const depthAngles = [min, max, ...roots(q, -y, 0, min, max)]
      for (const phi of depthAngles) {
        const depth = distance - y * Math.cos(phi) - q * Math.sin(phi)
        near = Math.min(near, depth); far = Math.max(far, depth)
      }
    }
    // A near-plane crossing has no finite unclipped orbit envelope under
    // this formula. Let the consumer retain its last envelope or use live
    // clipped bounds while zoomed that close, rather than returning infinity.
    if (perspective && near <= camera.near) return undefined
    if (perspective) {
      const cMin = Math.cos(max), cMax = Math.cos(min)
      const c = radiusSquared ? THREE.MathUtils.clamp(distance * y / radiusSquared, cMin, cMax) : cMin
      const denominatorSquared = distance * distance - r * r - 2 * distance * y * c + radiusSquared * c * c
      horizontal = Math.max(horizontal, r / Math.sqrt(Math.max(Number.EPSILON, denominatorSquared)))
    } else horizontal = Math.max(horizontal, r)
    // For each polar angle the vertical projection is monotonic in the
    // horizontal circle coordinate q, so only q = +/-r can be extrema.
    for (const q of [-r, r]) {
      const critical = perspective ? radiusSquared / distance : 0
      const angles = [min, max, ...roots(y, q, critical, min, max)]
      for (const phi of angles) {
        const numerator = y * Math.sin(phi) - q * Math.cos(phi)
        const value = perspective ? numerator / (distance - y * Math.cos(phi) - q * Math.sin(phi)) : numerator
        low = Math.min(low, value); high = Math.max(high, value)
      }
    }
  }
  // Project unit-depth rays (perspective) or camera-plane coordinates
  // (orthographic), preserving zoom, aspect, and asymmetric view offsets.
  const a = new THREE.Vector3(-horizontal, low, -1).applyMatrix4(camera.projectionMatrix)
  const b = new THREE.Vector3(horizontal, high, -1).applyMatrix4(camera.projectionMatrix)
  const left = (Math.min(a.x, b.x) + 1) * viewport.width / 2
  const right = (Math.max(a.x, b.x) + 1) * viewport.width / 2
  const top = (1 - Math.max(a.y, b.y)) * viewport.height / 2
  const bottom = (1 - Math.min(a.y, b.y)) * viewport.height / 2
  return { screen: { left, top, width: right - left, height: bottom - top }, depth: { near, far, size: far - near }, world }
}

/** Reduces points to an orbit profile: for each band of height along `up`
 * (through the origin), the largest distance from the up axis, placed at both
 * band edges. projectOrbitEnvelope depends only on a point's height and axis
 * distance, and each band's profile circles bound a cylinder that contains
 * every point in that band; a perspective projection keeps convex sets convex,
 * so the profile's envelope contains the original points' (conservative by at
 * most one band of height). Hundreds of points instead of tens of thousands.
 */
export function orbitEnvelopeProfile(points: ArrayLike<number>, up: THREE.Vector3, bands = 256): THREE.Vector3[] {
  const axis = up.clone().normalize()
  const side = new THREE.Vector3(1, 0, 0)
  if (Math.abs(side.dot(axis)) > 0.9) side.set(0, 0, 1)
  side.sub(axis.clone().multiplyScalar(side.dot(axis))).normalize()
  const heights: number[] = [], radii: number[] = []
  const point = new THREE.Vector3()
  let low = Infinity, high = -Infinity
  for (let index = 0; index + 2 < points.length; index += 3) {
    point.set(points[index], points[index + 1], points[index + 2])
    const y = point.dot(axis)
    heights.push(y)
    radii.push(Math.sqrt(Math.max(0, point.lengthSq() - y * y)))
    low = Math.min(low, y); high = Math.max(high, y)
  }
  if (!heights.length) return []
  const span = Math.max(high - low, Number.EPSILON)
  const widest = new Array<number>(bands).fill(-1)
  heights.forEach((y, i) => {
    const band = Math.min(bands - 1, Math.floor((y - low) / span * bands))
    widest[band] = Math.max(widest[band], radii[i])
  })
  const profile: THREE.Vector3[] = []
  widest.forEach((radius, band) => {
    if (radius < 0) return
    for (const edge of [band, band + 1]) {
      const y = low + span * edge / bands
      profile.push(axis.clone().multiplyScalar(y).addScaledVector(side, radius))
    }
  })
  return profile
}

/** A cached full-orbit envelope of sampled model points (see
 * orbitEnvelopeProfile), recomputed only when the viewport, projection or
 * orbit parameters change — not as the camera orbits. The orbit target is
 * expected at the origin, where the profile is built. */
export function createOrbitEnvelope(points: ArrayLike<number>, up: THREE.Vector3) {
  const profile = orbitEnvelopeProfile(points, up)
  // The cache key, written into a reused buffer: this is asked for on every
  // rendered frame, and almost always answers from the cache.
  const KEY_LENGTH = 28
  const key = new Float64Array(KEY_LENGTH)
  const cachedKey = new Float64Array(KEY_LENGTH)
  let cached = false
  let result: ProjectedObjectBounds | undefined
  return (camera: THREE.PerspectiveCamera | THREE.OrthographicCamera, viewport: Viewport, options: OrbitEnvelopeOptions) => {
    key[0] = viewport.width; key[1] = viewport.height; key[2] = options.distance
    key[3] = options.minPolarAngle ?? 0; key[4] = options.maxPolarAngle ?? Math.PI
    key[5] = options.target.x; key[6] = options.target.y; key[7] = options.target.z
    key[8] = camera.up.x; key[9] = camera.up.y; key[10] = camera.up.z
    key.set(camera.projectionMatrix.elements, 11)
    key[27] = camera.near
    if (cached) {
      let same = true
      for (let i = 0; i < KEY_LENGTH; i++) {
        if (key[i] !== cachedKey[i] && Math.abs(key[i] - cachedKey[i]) >= 1e-10) { same = false; break }
      }
      if (same) return result
    }
    result = projectOrbitEnvelope(profile, camera, viewport, options)
    cachedKey.set(key)
    cached = true
    return result
  }
}
