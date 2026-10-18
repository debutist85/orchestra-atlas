import assert from 'node:assert/strict'

export async function verifyModelExtent(server) {
  const THREE = await server.ssrLoadModule('three')
  const { sampleModelPoints, fitDistance, projectedBounds } = await server.ssrLoadModule('/src/features/instrument-explorer/model-extent.ts')

  // Shaped like a violin seen from the front: thin at its top and bottom
  // extremes (scroll, bow tips), deep only in the middle (the body).
  const slab = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.01))
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.1))
  const group = new THREE.Group()
  group.add(slab, body)
  const points = sampleModelPoints(group)
  assert.equal(points.length % 3, 0)
  assert.ok(points.length >= 8 * 3)

  // Fitted exactly: at the fitted distance the projected extent fills the
  // frame along the binding axis, rather than falling short of it.
  const viewport = { width: 868, height: 390 }
  const camera = new THREE.PerspectiveCamera(28, viewport.width / viewport.height, 0.01, 100)
  const tangent = Math.tan(THREE.MathUtils.degToRad(14))
  const frame = { width: 160, height: 272 }
  const halfY = tangent * frame.height / viewport.height
  const halfX = tangent * camera.aspect * frame.width / viewport.width
  const distance = fitDistance(points, halfX, halfY)
  camera.position.set(0, 0, distance)
  camera.lookAt(0, 0, 0)
  camera.updateProjectionMatrix()
  const bounds = projectedBounds(points, camera, viewport)
  assert.ok(Math.abs(bounds.height - frame.height) < 0.5, `fills the frame height (${bounds.height})`)
  assert.ok(bounds.width <= frame.width + 0.5)

  // The old bounding-box rule (fit the box, then step back by half its
  // depth) assumes the extremes sit on the deepest face, so it leaves such a
  // model visibly short of its frame.
  const size = new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3())
  const boxDistance = Math.max(size.y / (2 * halfY), size.x / (2 * halfX)) + size.z / 2
  assert.ok(boxDistance > distance)

  // Sampling caps dense meshes but keeps their extent.
  const dense = new THREE.Mesh(new THREE.SphereGeometry(0.5, 256, 256))
  const sampled = sampleModelPoints(dense, 2000)
  assert.ok(sampled.length / 3 <= 2100)
  assert.ok(fitDistance(sampled, halfX, halfY) > 0)

  console.log('Passed model extent: vertex sampling, exact perspective fit, projected bounds, and sampling limits.')
}
