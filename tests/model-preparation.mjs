import assert from 'node:assert/strict'

export async function verifyModelPreparation(server) {
  const THREE = await server.ssrLoadModule('three')
  const { prepareModel } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/prepare-model.ts')
  const { createMarkers } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/markers.ts')
  const texture = new THREE.Texture()
  const model = new THREE.Group()
  model.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: texture, normalMap: texture })))
  const scene = new THREE.Scene()
  scene.add(model)
  const camera = new THREE.PerspectiveCamera()
  const events = []
  const renderer = { initTexture: value => { assert.equal(value, texture); events.push('upload') }, compileAsync: async () => { events.push('compile') } }
  assert.equal(await prepareModel(renderer, model, scene, camera, () => false, async () => { events.push('yield') }), true)
  assert.deepEqual(events, ['yield', 'upload', 'yield', 'compile'], 'shared textures upload once, with paint opportunities before GPU work')
  events.length = 0
  assert.equal(await prepareModel(renderer, model, scene, camera, () => true, async () => {}), false)
  assert.deepEqual(events, [], 'cancelled preparation does not access a disposed renderer')

  camera.position.set(0, 0, 5)
  camera.updateMatrixWorld()
  const markers = createMarkers(camera)
  markers.attach(model)
  markers.syncHotspots([{ id: 'front', title: 'Front', position: [0, 0, 1] }, { id: 'rear', title: 'Rear', position: [0, 0, -1] }])
  let rays = 0
  model.children[0].raycast = () => { rays++ }
  assert.equal(markers.refreshOcclusion(1), true)
  assert.equal(markers.refreshOcclusion(1), false)
  assert.equal(rays, 2)
  markers.refreshOcclusion(1)
  assert.equal(rays, 2, 'stationary camera reuses completed visibility checks')
  camera.position.x = 1
  camera.updateMatrixWorld()
  assert.equal(markers.refreshOcclusion(1), true)
  assert.equal(rays, 3, 'camera movement invalidates visibility incrementally')
  markers.syncHotspots([{ id: 'front', title: 'Front', position: [1, 0, 1] }])
  assert.equal(markers.refreshOcclusion(1), false)
  assert.equal(rays, 4, 'editing hotspots invalidates visibility')
  const { createPointVisibility } = await server.ssrLoadModule('/src/lib/model-inspector/point-visibility.ts')
  const batch = createPointVisibility(camera)
  batch.setModel(model)
  batch.setPoints([0, 1, 2].map(id => ({ id: String(id), object: new THREE.Object3D() })))
  const before = rays
  assert.equal(batch.refresh(3), false, 'requested batch completes all remaining checks in one call')
  assert.equal(rays - before, 3)

  const { isOccluded } = await server.ssrLoadModule('/src/lib/model-inspector/anchor-projection.ts')
  const obstacles = new THREE.Group()
  const first = new THREE.Object3D(), second = new THREE.Object3D()
  let secondChecks = 0
  first.raycast = (_, hits) => { hits.push({ distance: 1, object: first }) }
  second.raycast = () => { secondChecks++ }
  obstacles.add(first, second)
  assert.equal(isOccluded(new THREE.Vector3(0, 0, 5), new THREE.Vector3(), obstacles, .01), true)
  assert.equal(secondChecks, 0, 'occlusion stops without visiting later siblings')
  first.layers.set(1)
  assert.equal(isOccluded(new THREE.Vector3(0, 0, 5), new THREE.Vector3(), obstacles, .01), false)
  assert.equal(secondChecks, 1, 'raycaster layers are respected')
  console.log('Passed staged GPU preparation, cancellation, and incremental visibility caching.')
}
