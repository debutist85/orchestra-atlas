import assert from 'node:assert/strict'

export async function verifyNavigationMotion(server, readSelection) {
  const { NavigationMotion, motionDirection } = await server.ssrLoadModule('/src/features/orchestra-installation/navigation-motion.ts')
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  const motion = new NavigationMotion()
  const orchestra = { level: 'orchestra' }
  const woodwinds = { level: 'family', familyId: 'woodwinds' }
  const flute = { level: 'instrument', familyId: 'woodwinds', instrumentId: 'flute' }
  assert.equal(motionDirection(orchestra, woodwinds), 'approach')
  assert.equal(motionDirection(flute, woodwinds), 'withdraw')
  const camera = { x: 0, y: 0, z: 30 }
  const center = { x: 0, y: 0, z: 0 }
  const emphasis = { value: 0 }
  let frames = 0
  const selectionBeforeMotion = readSelection()
  const travel = (from, to, destination, reduced = false) => motion.travel({
    from, to, camera, center, destination, destinationCenter: { x: destination.x, y: destination.y, z: 0 },
    values: [{ target: emphasis, values: { value: to.level === 'orchestra' ? 0 : 1 }, focused: true }],
    reduced, update: () => frames++,
  })
  travel(orchestra, woodwinds, { x: 2, y: 4, z: 15 })
  await sleep(250)
  assert.ok(camera.z < 30 && camera.z > 15)
  const interrupted = { ...camera }
  travel(woodwinds, flute, { x: 3, y: 4, z: 8 })
  assert.deepEqual(camera, interrupted, 'Replacement must not rewind the camera')
  await sleep(120)
  travel(flute, woodwinds, { x: 2, y: 4, z: 15 })
  await sleep(120)
  travel(woodwinds, orchestra, { x: 0, y: 0, z: 30 })
  await sleep(950)
  assert.ok(Math.abs(camera.x) < 1e-6 && Math.abs(camera.z - 30) < 1e-6)
  assert.equal(emphasis.value, 0)
  assert.ok(frames > 0)
  for (const [from, to, destination] of [
    [orchestra, woodwinds, { x: 2, y: 4, z: 15 }],
    [woodwinds, flute, { x: 3, y: 4, z: 8 }],
    [flute, woodwinds, { x: 2, y: 4, z: 15 }],
    [woodwinds, orchestra, { x: 0, y: 0, z: 30 }],
  ]) {
    travel(from, to, destination)
    await sleep(950)
    for (const axis of ['x', 'y', 'z']) assert.ok(Math.abs(camera[axis] - destination[axis]) < 1e-6)
    assert.deepEqual({ x: center.x, y: center.y, z: center.z }, { x: destination.x, y: destination.y, z: 0 })
    assert.deepEqual(readSelection(), selectionBeforeMotion)
  }
  travel(orchestra, flute, { x: 3, y: 4, z: 8 }, true)
  assert.deepEqual(camera, { x: 3, y: 4, z: 8 }, 'Reduced motion snaps without parallax')
  travel(flute, orchestra, { x: 0, y: 0, z: 30 })
  motion.finish()
  assert.deepEqual(camera, { x: 0, y: 0, z: 30 }, 'Resize/preference changes settle the latest destination')
  travel(orchestra, woodwinds, { x: 2, y: 4, z: 15 })
  motion.dispose()
  const disposed = { ...camera }
  await sleep(100)
  assert.deepEqual(camera, disposed, 'Disposed timelines cannot mutate the scene')
  assert.deepEqual(readSelection(), selectionBeforeMotion)
  console.log('Passed motion direction, continuous interruption, return path, reduced motion, settling, cleanup and listening independence.')
}
