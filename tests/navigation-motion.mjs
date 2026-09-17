import assert from 'node:assert/strict'

export async function verifyNavigationMotion(server, readSelection) {
  const { NavigationMotion, motionDirection, navigationTiming } = await server.ssrLoadModule('/src/features/orchestra-map/three/navigation-motion.ts')
  const { travelingTargetId, sameNavigation, clickDestination, acceptCanvasNavigation, mapLabels, exploreLabelId } = await server.ssrLoadModule('/src/features/orchestra-map/utils/navigation.ts')
  const { orchestraScenePresets } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const explore = mapLabels(orchestraScenePresets['classical-wide'], { level: 'instrument', familyId: 'woodwinds', instrumentId: 'flute' })
  assert.equal(explore.length, 1)
  assert.equal(explore[0].kind, 'explore')
  assert.equal(explore[0].id, exploreLabelId('flute'))
  assert.equal(explore[0].placementId, 'flute')
  assert.equal(mapLabels(orchestraScenePresets['classical-wide'], { level: 'orchestra' }).every(label => label.kind === 'navigate'), true)
  assert.ok(sameNavigation({ level: 'family', familyId: 'strings' }, { level: 'family', familyId: 'strings' }))
  assert.ok(!sameNavigation({ level: 'orchestra' }, { level: 'family', familyId: 'strings' }))
  assert.deepEqual(clickDestination({ level: 'orchestra' }, { level: 'family', familyId: 'strings' }), { level: 'family', familyId: 'strings' })
  assert.equal(clickDestination({ level: 'orchestra' }), undefined)
  assert.deepEqual(clickDestination({ level: 'family', familyId: 'strings' }), { level: 'orchestra' })
  assert.deepEqual(clickDestination({ level: 'family', familyId: 'strings' }, { level: 'instrument', familyId: 'strings', instrumentId: 'viola' }), { level: 'instrument', familyId: 'strings', instrumentId: 'viola' })
  assert.deepEqual(clickDestination({ level: 'instrument', familyId: 'strings', instrumentId: 'viola' }), { level: 'family', familyId: 'strings' })
  assert.equal(clickDestination({ level: 'instrument', familyId: 'strings', instrumentId: 'viola' }, { level: 'instrument', familyId: 'strings', instrumentId: 'viola' }), undefined)
  assert.deepEqual(clickDestination(
    { level: 'instrument', familyId: 'strings', instrumentId: 'viola' },
    { level: 'instrument', familyId: 'strings', instrumentId: 'cello' },
  ), { level: 'family', familyId: 'strings' })
  const canvasClick = { targetIsCanvas: true, pointerStartedOnCanvas: true }
  assert.equal(acceptCanvasNavigation(canvasClick), true)
  assert.equal(acceptCanvasNavigation({ ...canvasClick, traveling: true }), false)
  assert.equal(acceptCanvasNavigation({ ...canvasClick, pointerStartedOnCanvas: false }), false)
  assert.equal(acceptCanvasNavigation({ ...canvasClick, targetIsCanvas: false }), false)
  assert.equal(acceptCanvasNavigation({ ...canvasClick, defaultPrevented: true }), false)
  assert.equal(acceptCanvasNavigation({ ...canvasClick, debug: true }), false)
  assert.ok(navigationTiming.swap >= navigationTiming.travelStart + navigationTiming.travelDuration - 1e-6, 'Old labels stay until travel finishes')
  assert.ok(navigationTiming.exploreOutgoingDuration < navigationTiming.travelDuration * 0.4, 'Explore/Back should leave faster than travel')
  assert.ok(navigationTiming.incomingResolve < navigationTiming.travelStart + navigationTiming.travelDuration, 'Family labels can fade in during travel')
  assert.ok(navigationTiming.instrumentIncomingResolve >= navigationTiming.travelStart + navigationTiming.travelDuration - 1e-6, 'Instrument labels fade in after travel')
  assert.equal(travelingTargetId({ level: 'orchestra' }, { level: 'family', familyId: 'strings' }), 'strings')
  assert.equal(travelingTargetId({ level: 'family', familyId: 'strings' }, { level: 'instrument', familyId: 'strings', instrumentId: 'viola' }), 'viola')
  assert.equal(travelingTargetId({ level: 'family', familyId: 'strings' }, { level: 'orchestra' }), undefined)
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
  const motion = new NavigationMotion()
  const orchestra = { level: 'orchestra' }
  const woodwinds = { level: 'family', familyId: 'woodwinds' }
  const flute = { level: 'instrument', familyId: 'woodwinds', instrumentId: 'flute' }
  assert.equal(motionDirection(orchestra, woodwinds), 'approach')
  assert.equal(motionDirection(flute, woodwinds), 'withdraw')
  {
    const dimMotion = new NavigationMotion()
    const dimCamera = { x: 0, y: 0, z: 30 }
    const dimCenter = { x: 0, y: 0, z: 0 }
    const dimming = { emphasis: 0 }
    dimMotion.travel({
      from: orchestra, to: woodwinds,
      camera: dimCamera, center: dimCenter,
      destination: { x: 2, y: 4, z: 15 },
      destinationCenter: { x: 2, y: 4, z: 0 },
      values: [{ target: dimming, values: { emphasis: -1 }, focused: false }],
      reduced: false, update: () => {},
    })
    await sleep(280)
    const cameraProgress = (30 - dimCamera.z) / 15
    const dimProgress = -dimming.emphasis
    assert.ok(cameraProgress > 0.05 && cameraProgress < 0.7, 'Camera should still be traveling')
    assert.ok(Math.abs(cameraProgress - dimProgress) < 0.08, 'Dimming must share the camera travel curve')
    await sleep(700)
    assert.ok(Math.abs(dimming.emphasis + 1) < 1e-4)
    dimMotion.dispose()
  }
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
