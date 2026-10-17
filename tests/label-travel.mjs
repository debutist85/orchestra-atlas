import assert from 'node:assert/strict'

export async function verifyLabelTravel(server) {
  const THREE = await server.ssrLoadModule('three')
  const { captureTravelAnchor, projectTravelAnchor } = await server.ssrLoadModule('/src/features/instrument-explorer/label-travel.ts')

  const stage = { width: 1200, height: 800 }
  const camera = new THREE.PerspectiveCamera(28, stage.width / stage.height, 0.01, 100)
  const target = new THREE.Vector3(0, 0, 0)
  const rig = { camera, target }
  const pose = (position, lookAt) => { camera.position.copy(position); camera.lookAt(lookAt); camera.updateMatrixWorld() }
  const general = { position: new THREE.Vector3(0, 0, 2), lookAt: new THREE.Vector3(0, 0, 0) }
  // A close-up like the violin bridge preset: below the part, looking up at it.
  const part = new THREE.Vector3(-0.04, -0.12, 0.05)
  const closeUp = new THREE.Vector3(-0.13, -0.33, 0.19)
  camera.setViewOffset(stage.width, stage.height, 180, 20, stage.width, stage.height)
  pose(general.position, general.lookAt)

  // No focus yet: the title stays where it is.
  const point = { x: 900, y: 300 }
  const anchor = captureTravelAnchor(point, rig, 0.12)
  assert.deepEqual(projectTravelAnchor(anchor, rig, stage), { ...point, scale: 1 })

  // The camera owner sets the focus as the zoom starts; resolved against the
  // camera as it was at capture, the title is still exactly in place.
  rig.focus = part.clone()
  let projected = projectTravelAnchor(anchor, rig, stage)
  assert.ok(Math.abs(projected.x - point.x) < 1e-6 && Math.abs(projected.y - point.y) < 1e-6)
  assert.ok(Math.abs(projected.scale - 1) < 1e-9)

  // Fly in and back out along the same path, the camera tilting up at the
  // part as it goes (with the projection shift easing to zero and back).
  const at = t => {
    camera.setViewOffset(stage.width, stage.height, 180 * (1 - t), 20 * (1 - t), stage.width, stage.height)
    pose(general.position.clone().lerp(closeUp, t), general.lookAt.clone().lerp(part, t))
  }
  const path = []
  for (let t = 0; t <= 0.85; t += 0.05) { at(t); path.push(projectTravelAnchor(anchor, rig, stage)) }
  const visible = path.filter(Boolean)
  // The title only ever moves away from where it started and grows — it
  // never swings past its place and back (the jump this model replaces).
  const away = visible.map(p => Math.hypot(p.x - point.x, p.y - point.y))
  for (let i = 1; i < visible.length; i++) {
    assert.ok(away[i] >= away[i - 1] - 1e-6, `moves steadily away (${away[i - 1].toFixed(1)} → ${away[i].toFixed(1)})`)
    assert.ok(visible[i].scale >= visible[i - 1].scale - 1e-9)
  }
  assert.ok(visible.at(-1).scale > 1.5)

  // Back at the starting pose it lands exactly where it began.
  at(0)
  projected = projectTravelAnchor(anchor, rig, stage)
  assert.ok(Math.abs(projected.x - point.x) < 1e-6 && Math.abs(projected.y - point.y) < 1e-6)
  assert.ok(Math.abs(projected.scale - 1) < 1e-9)

  // A nearer plane rushes past faster than one further back.
  const near = captureTravelAnchor(point, rig, 0.12)
  const far = captureTravelAnchor(point, rig, -0.12)
  at(0.5)
  assert.ok(projectTravelAnchor(near, rig, stage).scale > projectTravelAnchor(far, rig, stage).scale)

  // Once the camera has passed a title's plane it is no longer drawn.
  at(0)
  const passed = captureTravelAnchor({ x: 600, y: 400 }, rig, 0.95)
  at(1)
  assert.equal(projectTravelAnchor(passed, rig, stage), undefined)

  console.log('Passed label travel: in-place without focus, exact start and landing, monotonic zoom path under a tilting camera, depth separation, and passed planes.')
}
