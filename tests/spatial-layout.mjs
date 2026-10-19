import assert from 'node:assert/strict'
import * as THREE from 'three'

export async function verifySpatialLayout(server) {
  const { createObjectBounds, layoutLabels, edgeLabelBox, projectWorldCircle } = await server.ssrLoadModule('/src/lib/spatial-layout/index.ts')
  const root = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 1))
  mesh.position.x = 1
  root.add(mesh)
  const camera = new THREE.PerspectiveCamera(45, 1, .1, 100)
  camera.position.z = 10
  camera.lookAt(0, 0, 0)
  const probe = createObjectBounds(root), viewport = { width: 800, height: 800 }
  const front = probe.measure(camera, viewport)
  assert.ok(front.screen.width > front.screen.height)
  assert.ok(Math.abs(front.depth.size - 1) < 1e-6)
  root.rotation.y = Math.PI / 2
  const rotated = probe.measure(camera, viewport)
  assert.ok(Math.abs(rotated.depth.size - 4) < 1e-6, 'root rotation changes camera-space depth')
  assert.ok(rotated.screen.width < front.screen.width, 'effective width follows rotation rather than an old world AABB')
  mesh.rotation.x = Math.PI / 2
  const nested = probe.measure(camera, viewport)
  assert.ok(nested.world.getSize(new THREE.Vector3()).z > 3.9)
  camera.position.set(10, 0, 0); camera.lookAt(0, 0, 0)
  assert.ok(probe.measure(camera, viewport).depth.size < 2.1, 'depth follows camera orientation too')
  root.scale.set(2, 2, 2)
  const scaled = probe.measure(camera, viewport)
  assert.ok(scaled.depth.size >= 1.9)
  mesh.visible = false
  assert.equal(probe.measure(camera, viewport), undefined)
  mesh.visible = true
  assert.equal(probe.measure(camera, { width: 0, height: 0 }), undefined)

  const nearMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
  const nearProbe = createObjectBounds(nearMesh)
  camera.position.set(0, 0, .5); camera.lookAt(0, 0, 0)
  const crossing = nearProbe.measure(camera, viewport)
  assert.ok(crossing)
  assert.ok(Object.values(crossing.screen).every(Number.isFinite), 'near-plane crossings stay finite')
  nearMesh.position.z = 20
  assert.equal(nearProbe.measure(camera, viewport), undefined, 'objects behind the camera have no screen rectangle')
  const empty = createObjectBounds(new THREE.Group())
  assert.equal(empty.measure(camera, viewport), undefined)

  const ortho = new THREE.OrthographicCamera(-5, 5, 5, -5, .1, 100)
  ortho.position.z = 10; ortho.lookAt(0, 0, 0)
  const editable = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2))
  const editableProbe = createObjectBounds(editable)
  assert.equal(editableProbe.measure(ortho, viewport).screen.width, 160)
  editable.geometry.scale(2, 1, 1)
  editableProbe.refreshGeometry()
  assert.ok(Math.abs(editableProbe.measure(ortho, viewport).screen.width - 320) < 1e-6)

  const object = { left: 100, top: 100, width: 200, height: 300 }
  const result = layoutLabels([
    { id: 'title', position: { edge: 'right', align: 'center', gap: 20 }, measure: () => ({ width: 100, height: 60 }) },
    { id: 'family', relativeTo: 'title', position: { edge: 'top', align: 'start', gap: 6 }, measure: () => ({ width: 80, height: 20 }) },
  ], object, { left: 0, top: 0, right: 800, bottom: 800 })
  assert.deepEqual(result.boxes.title, { left: 320, top: 220, width: 100, height: 60 })
  assert.equal(result.boxes.family.top + 20, result.boxes.title.top - 6)
  assert.equal(result.boxes.family.left, result.boxes.title.left)
  const uncontained = edgeLabelBox({ edge: 'left', align: 'start', gap: 50 }, object, { width: 100, height: 20 })
  assert.equal(uncontained.left, -50, 'shared placement does not silently clamp')
  camera.position.set(0, 0, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld()
  const circle = projectWorldCircle([0, 0, 0], 1, camera, viewport)
  assert.ok(Math.abs(circle.x + circle.width / 2 - 400) < 1e-6)
  assert.ok(circle.width > 0)
  console.log('Passed reusable spatial layout: nested transforms, camera-space depth, near-plane clipping, linked edge labels, and planar markers.')
}
