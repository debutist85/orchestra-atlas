import assert from 'node:assert/strict'
import * as THREE from 'three'

export async function verifyInstrumentAnatomy(server) {
  const { anatomyLabel, anatomyDescription, isAnchorIntentionallyHidden } = await server.ssrLoadModule('/src/features/instrument-explorer/content/instrument-anatomy.ts')
  const { collectAnchors } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/instrument-model-resource.ts')
  const { projectToScreen, isOccluded } = await server.ssrLoadModule('/src/features/instrument-explorer/scene/anchor-projection.ts')

  const knownAnchors = [
    ['Anchor_Bow', 'Bow'],
    ['Anchor_Bridge', 'Bridge'],
    ['Anchor_Chinrest', 'Chinrest'],
    ['Anchor_FHole_Right', 'F-hole'],
    ['Anchor_Fingerboard', 'Fingerboard'],
    ['Anchor_Pegbox', 'Pegbox'],
    ['Anchor_Scroll', 'Scroll'],
    ['Anchor_Tailpiece', 'Tailpiece'],
  ]
  for (const [name, label] of knownAnchors) assert.equal(anatomyLabel(name), label)
  assert.equal(anatomyLabel('Anchor_Unknown'), undefined)
  assert.equal(anatomyLabel('Object_2'), undefined)
  // The left f-hole is deliberately unlabeled (only one f-hole anchor is
  // shown), not an unexpected omission the loader should warn about.
  assert.equal(anatomyLabel('Anchor_FHole_Left'), undefined)
  assert.equal(isAnchorIntentionallyHidden('Anchor_FHole_Left'), true)
  assert.equal(isAnchorIntentionallyHidden('Anchor_Unknown'), false)

  for (const [name] of knownAnchors) {
    const description = anatomyDescription(name)
    assert.equal(typeof description, 'string', `${name} has a description`)
    assert.ok(description.length > 0 && description.length < 220, `${name}'s description is short`)
  }
  assert.equal(anatomyDescription('Anchor_Unknown'), undefined)

  const root = new THREE.Group()
  const bridge = new THREE.Object3D()
  bridge.name = 'Anchor_Bridge'
  const mesh = new THREE.Mesh()
  mesh.name = 'Object_2'
  const wrapper = new THREE.Group()
  wrapper.name = 'Sketchfab_model'
  const scroll = new THREE.Object3D()
  scroll.name = 'Anchor_Scroll'
  wrapper.add(scroll, mesh)
  root.add(bridge, wrapper)
  assert.deepEqual(collectAnchors(root).map(node => node.name).sort(), ['Anchor_Bridge', 'Anchor_Scroll'],
    'finds anchors at any depth, skips non-anchor nodes')
  assert.deepEqual(collectAnchors(new THREE.Group()), [], 'no anchors is a valid, empty result')

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.set(0, 0, 5)
  camera.lookAt(0, 0, 0)
  camera.updateMatrixWorld(true)
  const viewport = { width: 400, height: 300 }
  const center = projectToScreen(new THREE.Vector3(0, 0, 0), camera, viewport)
  assert.ok(Math.abs(center.x - 200) < 1e-6 && Math.abs(center.y - 150) < 1e-6, 'a point on the optical axis projects to the viewport center')
  const right = projectToScreen(new THREE.Vector3(1, 0, 0), camera, viewport)
  assert.ok(right.x > center.x, 'a point to the camera-space right projects further right')
  const up = projectToScreen(new THREE.Vector3(0, 1, 0), camera, viewport)
  assert.ok(up.y < center.y, 'a point to the camera-space up projects higher (smaller y)')

  const blocker = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.1))
  blocker.position.set(0, 0, 2) // sits between the camera (z=5) and the origin
  blocker.updateMatrixWorld(true)
  assert.equal(isOccluded(camera.position, new THREE.Vector3(0, 0, 0), blocker, 0.01), true,
    'a point behind a closer surface is occluded')
  assert.equal(isOccluded(camera.position, new THREE.Vector3(0, 0, 3), blocker, 0.01), false,
    'a point in front of the surface is not occluded')
  // The target itself sits essentially on the obstacle's own surface (its
  // near face is at z=2.05) — without the epsilon, the ray would reach and
  // "hit" that same surface and incorrectly report self-occlusion.
  assert.equal(isOccluded(camera.position, new THREE.Vector3(0, 0, 2.05), blocker, 0.2), false,
    'a point on the obstacle is not self-occluded once the epsilon excludes it')

  const { anatomyNoteLayout } = await server.ssrLoadModule('/src/features/instrument-explorer/viewer/anatomy-label-layout.ts')
  const text = { width: 260, height: 130 }
  const landscape = anatomyNoteLayout({ x: 400, y: 300 }, text, { width: 1000, height: 720 }, { top: 66, bottom: 86 })
  assert.equal(landscape.x, 460)
  assert.equal(landscape.y, 0)
  assert.equal(landscape.height, 720, 'landscape band spans header and footer')
  assert.equal(landscape.textTop, 235)
  const portrait = anatomyNoteLayout({ x: 195, y: 300 }, text, { width: 390, height: 800 }, { top: 66, bottom: 86 })
  assert.equal(portrait.x, 0)
  assert.equal(portrait.width, 390, 'portrait band spans the full width')
  assert.equal(portrait.y, 348)
  assert.equal(portrait.gap, 48)
  const edge = anatomyNoteLayout({ x: 980, y: 700 }, text, { width: 1000, height: 720 }, { top: 66, bottom: 86 })
  assert.ok(edge.x + text.width + 32 <= 1000)
  assert.ok(edge.textTop + text.height <= 720 - 86)
  const lower = anatomyNoteLayout({ x: 195, y: 780 }, text, { width: 390, height: 800 }, { top: 66, bottom: 86 })
  assert.ok(lower.y + lower.textTop + text.height <= 800 - 86)

  console.log('Passed anatomy labels, anchor discovery, screen projection, and occlusion.')
}
