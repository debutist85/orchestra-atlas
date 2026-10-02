import assert from 'node:assert/strict'

export async function verifyIdleAnimation(server) {
  const {
    defaultIdleAnimation,
    breathCycle,
    idleAppearance,
    isIdlePlayer,
  } = await server.ssrLoadModule('/src/features/orchestra-map/three/idle-animation.ts')
  const settings = { ...defaultIdleAnimation }
  const { orchestraSceneConfig } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-map/three/seating.ts')
  const seating = createOrchestraPositions(orchestraSceneConfig)
    .filter(node => node.visible !== false)
  const players = seating.map(node => ({
    id: node.id, position: node.position, radius: node.radius, sectionId: node.sectionId,
  }))
  const conductor = players.find(node => node.sectionId === 'conductor')
  const members = players.filter(isIdlePlayer)

  const first = breathCycle(members[0].id, 1.25, settings)
  assert.ok(first.duration >= settings.durationMin && first.duration <= settings.durationMax)
  assert.deepEqual(breathCycle(members[0].id, 1.25, settings), first)
  assert.notEqual(breathCycle(members[0].id, 1.25, settings).duration, breathCycle(members[1].id, 1.25, settings).duration)
  assert.notEqual(breathCycle(members[0].id, 0, settings).wave, breathCycle(members[1].id, 0, settings).wave)

  const waves = members.map(node => breathCycle(node.id, 2, settings).wave)
  assert.ok(Math.max(...waves) - Math.min(...waves) > 0.2)
  const durations = members.map(node => breathCycle(node.id, 0, settings).duration)
  assert.ok(Math.min(...durations) >= settings.durationMin - 1e-6)
  assert.ok(Math.max(...durations) <= settings.durationMax + 1e-6)

  const rest = idleAppearance(members[0], 0.4, settings, 1)
  assert.ok(rest.brightness >= settings.brightnessMin && rest.brightness <= settings.brightnessMax)
  assert.ok(Math.abs(rest.scale - 1) <= settings.scaleAmount + 1e-6)
  assert.equal(idleAppearance(members[0], 0.4, settings, 0).brightness, 1)
  assert.equal(idleAppearance(conductor, 0.4, settings, 1).brightness, 1)
  assert.equal(isIdlePlayer(conductor), false)

  console.log('Passed idle breathing phases, bounded luminosity, and conductor exclusion.')
}
