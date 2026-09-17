import assert from 'node:assert/strict'

export async function verifyIdleAnimation(server) {
  const {
    defaultIdleAnimation,
    breathCycle,
    glintEvent,
    glintSpan,
    glintTargets,
    currentGlints,
    idleAppearance,
    isIdlePlayer,
  } = await server.ssrLoadModule('/src/features/orchestra-map/three/idle-animation.ts')
  const settings = { ...defaultIdleAnimation }
  const { orchestraScenePresets } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-map/three/seating.ts')
  const seating = createOrchestraPositions(orchestraScenePresets['classical-wide'])
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

  const rest = idleAppearance(members[0], 0.4, { ...settings, glintEnabled: false }, players, 1)
  assert.ok(rest.brightness >= settings.brightnessMin && rest.brightness <= settings.brightnessMax)
  assert.ok(Math.abs(rest.scale - 1) <= settings.scaleAmount + 1e-6)
  assert.equal(idleAppearance(members[0], 0.4, settings, players, 0).brightness, 1)
  const faded = idleAppearance(members[0], 0.4, settings, players, 0, new Map([[members[0].id, 0.2]]))
  assert.ok(Math.abs(faded.brightness - 1.2) < 1e-6)
  assert.equal(idleAppearance(conductor, 0.4, settings, players, 1).brightness, 1)
  assert.equal(isIdlePlayer(conductor), false)

  assert.equal(glintEvent(1, settings), undefined)
  assert.equal(currentGlints(1, settings, players).size, 0)

  const events = []
  for (let time = 0; time <= 40; time += 0.05) {
    const event = glintEvent(time, settings)
    if (!event) continue
    const last = events.at(-1)
    if (!last || last.cycle !== event.cycle) events.push(event)
  }
  const minEvents = Math.floor(40 / settings.glintIntervalMax)
  const maxEvents = Math.ceil(40 / Math.max(settings.glintDuration, settings.glintIntervalMin)) + 1
  assert.ok(events.length >= minEvents && events.length <= maxEvents)
  for (let index = 1; index < events.length; index++) {
    assert.ok(events[index].start - events[index - 1].start >= glintSpan(settings) - 1e-6)
  }

  const primaries = members.map((_, cycle) => glintTargets(players, cycle, settings)[0].id)
  assert.equal(new Set(primaries).size, members.length)

  const sizes = new Set()
  for (let cycle = 0; cycle < 16; cycle++) {
    const targets = glintTargets(players, cycle, settings)
    sizes.add(targets.length)
  }
  assert.ok(sizes.size >= 2)
  for (const event of events) {
    const targets = glintTargets(players, event.cycle, settings)
    assert.ok(targets.length >= settings.glintClusterMin && targets.length <= settings.glintClusterMax)
    assert.ok(targets.every(target => target.id !== 'conductor'))
    assert.equal(targets.filter(target => target.weight === 1).length, 1)
    const delays = targets.map(target => target.delay)
    assert.ok(Math.max(...delays) - Math.min(...delays) > 0.2)
    const points = targets.map(target => players.find(node => node.id === target.id))
    const distances = []
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        distances.push(Math.hypot(
          points[i].position[0] - points[j].position[0],
          points[i].position[1] - points[j].position[1],
        ))
      }
    }
    assert.ok(Math.max(...distances) > Math.min(...distances) * 2)
  }

  const cluster = glintTargets(players, events[0].cycle, settings)
  const earliest = cluster.reduce((min, target) => Math.min(min, target.delay), Infinity)
  const opening = currentGlints(events[0].start + earliest + 0.02, settings, players)
  assert.ok(opening.size >= 1 && opening.size < cluster.length)
  const active = currentGlints(events[0].start + settings.glintDuration / 2, settings, players)
  assert.ok(active.size >= settings.glintClusterMin - 1)
  assert.equal(currentGlints(events[0].start + glintSpan(settings) + 0.05, settings, players).size, 0)

  const peak = idleAppearance(players.find(node => active.has(node.id)), events[0].start + settings.glintDuration / 2, settings, players, 1, active)
  assert.ok(!active.has('conductor'))
  assert.ok(peak.glint > 0)
  assert.ok(peak.brightness <= settings.brightnessMax + settings.glintIntensity + 1e-6)
  console.log('Passed idle breathing phases, bounded luminosity, infrequent glints, and conductor exclusion.')
}
