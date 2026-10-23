import assert from 'node:assert/strict'
import * as THREE from 'three'

export async function verifyOrbitEnvelope(server) {
  const { createObjectBounds } = await server.ssrLoadModule('/src/lib/spatial-layout/index.ts')
  const { explorerLayout, explorerLayoutDefaults, explorerLayoutOverrides } = await server.ssrLoadModule('/src/features/instrument-explorer/config.ts')
  const root = new THREE.Group()
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 6, 1))
  mesh.position.set(.7, .2, -.3)
  mesh.rotation.z = .2
  root.add(mesh)
  const probe = createObjectBounds(root)
  const viewport = { width: 1000, height: 800 }
  const camera = new THREE.PerspectiveCamera(35, viewport.width / viewport.height, .1, 100)
  camera.setViewOffset(1000, 800, 35, -20, 1000, 800)
  const options = { target: new THREE.Vector3(), distance: 12, minPolarAngle: Math.PI / 9, maxPolarAngle: Math.PI * 8 / 9 }
  const envelope = probe.measureEnvelope(camera, viewport, options)
  assert.ok(envelope)
  const inside = (live, all) => {
    assert.ok(live.screen.left >= all.screen.left - 1e-6)
    assert.ok(live.screen.top >= all.screen.top - 1e-6)
    assert.ok(live.screen.left + live.screen.width <= all.screen.left + all.screen.width + 1e-6)
    assert.ok(live.screen.top + live.screen.height <= all.screen.top + all.screen.height + 1e-6)
    assert.ok(live.depth.near >= all.depth.near - 1e-6)
    assert.ok(live.depth.far <= all.depth.far + 1e-6)
  }
  const staticProbe = createObjectBounds(root, { static: true })
  const staticEnvelope = staticProbe.measureEnvelope(camera, viewport, options)
  let updates = 0
  const update = root.updateWorldMatrix
  root.updateWorldMatrix = function (...args) { updates++; return update.apply(this, args) }
  try {
    assert.equal(staticProbe.measureEnvelope(camera, viewport, options), staticEnvelope)
    assert.equal(updates, 0, 'static envelope cache hits do not traverse world matrices')
    root.position.x += .2
    staticProbe.invalidateTransforms()
    assert.notEqual(staticProbe.measureEnvelope(camera, viewport, options), staticEnvelope)
    assert.equal(updates, 1, 'explicit pose invalidation refreshes static geometry')
    root.position.x -= .2
    root.updateWorldMatrix(true, true)
  } finally { root.updateWorldMatrix = update }
  let firstLive
  for (let i = 0; i <= 12; i++) for (let j = 0; j < 36; j++) {
    const phi = options.minPolarAngle + (options.maxPolarAngle - options.minPolarAngle) * i / 12
    camera.position.setFromSphericalCoords(options.distance, phi, j * Math.PI / 18)
    camera.lookAt(options.target)
    const live = probe.measure(camera, viewport)
    assert.ok(live)
    inside(live, envelope)
    assert.equal(probe.measureEnvelope(camera, viewport, options), envelope, 'orbit reuses the same stable envelope')
    if (!firstLive) firstLive = live.screen.width
  }
  assert.notEqual(probe.measure(camera, viewport).screen.width, firstLive, 'live mode still follows changing edges')
  const farther = probe.measureEnvelope(camera, viewport, { ...options, distance: 16 })
  assert.ok(farther.screen.width < envelope.screen.width, 'zoom updates envelope')
  const resized = probe.measureEnvelope(camera, { width: 500, height: 400 }, options)
  assert.ok(Math.abs(resized.screen.width - envelope.screen.width / 2) < 1e-6)
  const narrow = probe.measureEnvelope(camera, viewport, { ...options, minPolarAngle: Math.PI / 2, maxPolarAngle: Math.PI / 2 })
  assert.ok(narrow.screen.width <= envelope.screen.width + 1e-6)
  root.rotation.x = .4
  assert.notEqual(probe.measureEnvelope(camera, viewport, options), envelope, 'model pose invalidates the envelope')
  assert.equal(probe.measureEnvelope(camera, viewport, { ...options, distance: .1 }), undefined, 'near-plane crossing never produces infinite bounds')

  const ortho = new THREE.OrthographicCamera(-6, 6, 5, -5, .1, 100)
  const orthoEnvelope = probe.measureEnvelope(ortho, viewport, options)
  for (const phi of [.4, 1, 2.4]) for (const theta of [0, 1, 3]) {
    ortho.position.setFromSphericalCoords(12, phi, theta); ortho.lookAt(options.target)
    inside(probe.measure(ortho, viewport), orthoEnvelope)
  }
  assert.equal(explorerLayoutDefaults.labelBounds, 'envelope')
  const old = explorerLayoutOverrides.violin
  try {
    explorerLayoutOverrides.violin = { ...old, labelBounds: 'live' }
    assert.equal(explorerLayout('violin').labelBounds, 'live')
  } finally {
    if (old) explorerLayoutOverrides.violin = old
    else delete explorerLayoutOverrides.violin
  }

  // The vertex profile (height bands, widest radius at each band edge)
  // contains the full point cloud's envelope and stays close to it.
  {
    const THREE = await server.ssrLoadModule('three')
    const { projectOrbitEnvelope, orbitEnvelopeProfile, createOrbitEnvelope } = await server.ssrLoadModule('/src/lib/spatial-layout/orbit-envelope.ts')
    let seed = 7
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const flat = Array.from({ length: 3000 }, () => [(random() - 0.5) * 3, (random() - 0.5) * 1.2, (random() - 0.5) * 0.8]).flat()
    const vectors = []
    for (let i = 0; i < flat.length; i += 3) vectors.push(new THREE.Vector3(flat[i], flat[i + 1], flat[i + 2]))
    const up = new THREE.Vector3(0, 1, 0)
    const profile = orbitEnvelopeProfile(flat, up)
    assert.ok(profile.length <= 512, 'a compact profile')
    for (const [distance, polar] of [[6, [20, 160]], [10, [45, 135]], [4, [0, 180]]]) {
      const camera = new THREE.PerspectiveCamera(30, 1.5, 0.01, 100)
      const viewport = { width: 1200, height: 800 }
      const orbit = { target: new THREE.Vector3(), distance, minPolarAngle: THREE.MathUtils.degToRad(polar[0]), maxPolarAngle: THREE.MathUtils.degToRad(polar[1]) }
      const exact = projectOrbitEnvelope(vectors, camera, viewport, orbit).screen
      const reduced = projectOrbitEnvelope(profile, camera, viewport, orbit).screen
      assert.ok(reduced.left <= exact.left + 1e-6 && reduced.top <= exact.top + 1e-6
        && reduced.left + reduced.width >= exact.left + exact.width - 1e-6
        && reduced.top + reduced.height >= exact.top + exact.height - 1e-6, `profile contains the exact envelope at d=${distance}`)
      assert.ok(reduced.width <= exact.width * 1.02 && reduced.height <= exact.height * 1.02, `and stays within 2% of it at d=${distance}`)
      const cached = createOrbitEnvelope(flat, up)
      assert.equal(cached(camera, viewport, orbit), cached(camera, viewport, orbit), 'cached while nothing changes')
    }
  }
  console.log('Passed stable analytical orbit envelope, permitted-angle coverage, zoom/resize/pose invalidation, live-mode override, and the vertex profile.')
}
