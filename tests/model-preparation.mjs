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
  console.log('Passed staged GPU preparation, cancellation, and incremental visibility caching.')
}
