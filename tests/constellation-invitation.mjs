import assert from 'node:assert/strict'

export async function verifyConstellationInvitation(server) {
  const {
    invitationLight, invitationReach, invitationRingScale, invitationRingRadius, invitationPhaseDelay,
    INVITATION_RING_MAX_SCALE, INVITATION_MIN_RADIUS, INVITATION_HAND_SIZE,
    INVITATION_CYCLE_MS, INVITATION_RING_START, INVITATION_RING_STAGGER_MS,
  } = await server.ssrLoadModule('/src/features/orchestra-map/utils/constellation-invitation.ts')
  const { orchestraSceneConfig: config } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-map/three/seating.ts')
  const { familyInstruments } = await server.ssrLoadModule('/src/features/orchestra-map/utils/navigation.ts')
  const { captureConstellation } = await server.ssrLoadModule('/src/features/orchestra-map/three/constellation-capture.ts')
  const THREE = await server.ssrLoadModule('three')
  const positions = createOrchestraPositions(config)

  // The light: central in the featured tier, deterministic; the hand from
  // the cluster's outer side.
  const light = (id, x, y, tier = 0) => ({ id, sectionId: 'strings', x, y, radius: 4, color: '#fff', tier })
  const row = [light('a', 0, 0), light('b', 40, 0), light('c', 60, 0), light('d', 80, 0), light('e', 120, 0), light('f', 60, 0, 1)]
  assert.equal(invitationLight(row).id, 'c', 'nearest the featured cluster middle')
  assert.equal(invitationLight([...row].reverse()).id, 'c', 'independent of array order')
  assert.equal(invitationLight(row.slice(4)).id, 'e', 'the next tier only when it is the lowest present')
  assert.equal(invitationLight([light('l', 10, 0), light('r', 50, 0), light('m', 40, 0)]).side, 'right', 'right of the middle: from the right')
  assert.equal(invitationLight([light('l', 10, 0), light('r', 50, 0), light('m', 20, 0)]).side, 'left', 'left of the middle: from the left')
  assert.equal(invitationLight([light('solo', 5, 5)]).side, 'right')
  assert.equal(invitationLight([]), undefined)
  // Rings: up to 2.75× a small light, a bounded growth for a large one, and
  // a visible size for a tiny one. The reach covers rings and hand.
  assert.equal(invitationRingScale(4), INVITATION_RING_MAX_SCALE)
  assert.ok(invitationRingScale(40) < 2 && invitationRingScale(40) > 1, 'a large light ripples less far')
  assert.equal(invitationRingRadius(1), INVITATION_MIN_RADIUS)
  const right = invitationReach(4, 'right'), left = invitationReach(4, 'left')
  assert.ok(right.right > right.left && left.left > left.right, 'the hand side reaches further')
  assert.ok(right.bottom >= INVITATION_HAND_SIZE && right.top >= 4 * INVITATION_RING_MAX_SCALE - 1e-9, 'hand below, rings all round')

  // On a real capture: the full orchestra's miniature features the first
  // Strings instrument; families feature their own first instrument.
  const groups = Object.values(Object.groupBy(positions, node => node.sectionId)).map(nodes => {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial(), nodes.length)
    nodes.forEach((node, index) => mesh.setMatrixAt(index, new THREE.Matrix4().makeScale(node.radius, node.radius, node.radius).setPosition(...node.position)))
    mesh.updateMatrixWorld(true)
    return { nodes, mesh }
  })
  const camera = new THREE.PerspectiveCamera(30, 1440 / 900, 0.1, 1000)
  camera.position.set(0, -20, 60)
  camera.lookAt(0, 0, 0)
  const capture = navigation => captureConstellation({ config, navigation, groups, camera, viewport: { width: 1440, height: 900 } })
  const orchestra = capture({ level: 'orchestra' })
  const featured = orchestra.nodes.find(node => node.id === orchestra.invitation.id)
  assert.equal(featured.instrument, familyInstruments(config, 'strings')[0].instrument, 'orchestra: the first Strings instrument is featured')
  assert.equal(orchestra.invitation.color, featured.color, "in the light's own color")
  const percussion = capture({ level: 'family', familyId: 'percussion' })
  const rightmost = percussion.nodes.reduce((best, node) => node.x > best.x ? node : best)
  assert.equal(percussion.invitation.id, rightmost.id, 'percussion demonstrates on its rightmost light')
  assert.equal(percussion.invitation.side, 'right')
  assert.equal(invitationLight([light('l', 0, 0), light('r', 90, 0, 2), light('m', 40, 0)], 'rightmost').id, 'r', 'rightmost ignores tiers')
  const brass = capture({ level: 'family', familyId: 'brass' })
  assert.equal(brass.nodes.find(node => node.id === brass.invitation.id).instrument, familyInstruments(config, 'brass')[0].instrument, 'not hard-coded to violin')
  for (const node of positions.filter(node => node.instrument && node.visible !== false)) {
    const family = ['strings', 'woodwinds', 'brass', 'percussion'].find(id => id === node.sectionId) ?? 'other'
    const miniature = capture({ level: 'instrument', familyId: family, instrumentId: node.instrument })
    const invited = miniature.nodes.find(item => item.id === miniature.invitation?.id)
    assert.ok(invited, `${node.instrument} has an invitation`)
    const reach = invitationReach(invited.radius, miniature.invitation.side)
    assert.ok(invited.x - reach.left >= -1e-4 && invited.x + reach.right <= miniature.frame.width + 1e-4
      && invited.y - reach.top >= -1e-4 && invited.y + reach.bottom <= miniature.frame.height + 1e-4, `${node.instrument}: rings and hand inside the miniature`)
  }

  // Which depth a navigation retires the invitation at: only forward ones.
  const { forwardFromLevel } = await server.ssrLoadModule('/src/features/orchestra-map/utils/navigation.ts')
  const orchestraLevel = { level: 'orchestra' }, strings = { level: 'family', familyId: 'strings' }, brassFamily = { level: 'family', familyId: 'brass' }
  const violin = { level: 'instrument', familyId: 'strings', instrumentId: 'violin' }, horn = { level: 'instrument', familyId: 'brass', instrumentId: 'horn' }
  assert.equal(forwardFromLevel(orchestraLevel, strings), 'orchestra', 'into a family')
  assert.equal(forwardFromLevel(orchestraLevel, violin), 'orchestra', 'straight into an instrument')
  assert.equal(forwardFromLevel(strings, violin), 'family', 'into an instrument')
  assert.equal(forwardFromLevel(strings, horn), 'family', "into another family's instrument")
  for (const [from, to] of [[strings, orchestraLevel], [violin, strings], [strings, brassFamily], [violin, horn], [strings, strings], [orchestraLevel, orchestraLevel]]) {
    assert.equal(forwardFromLevel(from, to), undefined, `${JSON.stringify(from)} → ${JSON.stringify(to)} is not forward`)
  }

  // The node's own display color, color bands included.
  const { nodeBaseColor } = await server.ssrLoadModule('/src/features/orchestra-map/three/section-palette.ts')
  for (const [sectionId, groups] of Object.entries(config.instrumentGroups)) {
    for (const group of groups) {
      for (const nodeId of group.nodeIds) {
        const band = group.colorBands?.find(item => item.nodeIds.includes(nodeId))
        assert.equal(nodeBaseColor({ id: nodeId, sectionId }, config), band?.color ?? group.color ?? config.sections[sectionId].color)
      }
    }
  }

  // Phase: our ring peaks fall halfway between the Play button's.
  assert.equal(invitationPhaseDelay(undefined), 0, 'no Play button: start now')
  const ownPeak = INVITATION_RING_START * INVITATION_CYCLE_MS + INVITATION_RING_STAGGER_MS / 2
  for (const elapsed of [0, 123, 900, 1799, 5000, 123456.7]) {
    const delay = invitationPhaseDelay(elapsed)
    assert.ok(delay <= 0 && delay > -INVITATION_CYCLE_MS)
    // Time (ms from now) until our peak, and the Play phase then.
    const until = ownPeak + delay
    const playPhase = ((elapsed + until) % 1800 + 1800) % 1800
    const fromPlayPeak = Math.abs(playPhase - 288)
    assert.ok(Math.abs(Math.min(fromPlayPeak, 1800 - fromPlayPeak) - 900) < 1e-6, `peaks offset from Play at ${elapsed}`)
  }

  console.log('Passed constellation invitation: featured central light, outward hand side, ring sizing, rings and hand inside every miniature, node colors, and phase offset from the Play rings.')
}
