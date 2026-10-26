import assert from 'node:assert/strict'

export async function verifyConstellationMiniature(server) {
  const THREE = await server.ssrLoadModule('three')
  const { orchestraSceneConfig: config } = await server.ssrLoadModule('/src/features/orchestra-map/config.ts')
  const { createOrchestraPositions } = await server.ssrLoadModule('/src/features/orchestra-map/three/seating.ts')
  const { constellationScope } = await server.ssrLoadModule('/src/features/orchestra-map/utils/constellation-scope.ts')
  const { normalizeConstellation, buildMiniature, DEFAULT_MINIATURE_FRAME, GLOW_SCALE, GLOW_BLUR } = await server.ssrLoadModule('/src/features/orchestra-map/utils/constellation-miniature.ts')
  const { captureConstellation } = await server.ssrLoadModule('/src/features/orchestra-map/three/constellation-capture.ts')
  const { nodeBaseColor } = await server.ssrLoadModule('/src/features/orchestra-map/three/section-palette.ts')
  const { familySections } = await server.ssrLoadModule('/src/features/orchestra-map/utils/navigation.ts')
  const positions = createOrchestraPositions(config)

  // Scope: which real lights make up each view.
  const ids = navigation => constellationScope(config, navigation, positions).map(({ node }) => node)
  assert.ok(ids({ level: 'orchestra' }).length > 0 && ids({ level: 'orchestra' }).every(node => node.sectionId === 'strings'), 'orchestra: Strings only')
  assert.equal(ids({ level: 'orchestra' }).length, ids({ level: 'family', familyId: 'strings' }).length, 'the same Strings lights as the family view')
  assert.ok(ids({ level: 'family', familyId: 'woodwinds' }).every(node => node.sectionId === 'woodwinds' && node.instrument))
  assert.ok(ids({ level: 'family', familyId: 'other' }).every(node => familySections('other').includes(node.sectionId)), 'a family spanning sections')
  assert.ok(ids({ level: 'instrument', familyId: 'strings', instrumentId: 'violin' }).every(node => node.instrument === 'violin'))
  assert.equal(ids({ level: 'instrument', familyId: 'brass', instrumentId: 'tuba' }).length, 1)

  // Normalization: tight crop, uniform scale, centered, padding kept.
  const frame = { width: 220, height: 135, padding: 16 }
  const light = (id, x, y, radius = 4) => ({ id, sectionId: 'strings', x, y, radius, color: '#fff' })
  // What a light draws: its glow (halo plus blur).
  const glow = node => node.radius * GLOW_SCALE + GLOW_BLUR * 2
  const extent = nodes => ({
    left: Math.min(...nodes.map(node => node.x - glow(node))), right: Math.max(...nodes.map(node => node.x + glow(node))),
    top: Math.min(...nodes.map(node => node.y - glow(node))), bottom: Math.max(...nodes.map(node => node.y + glow(node))),
  })
  const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-6, `${message}: ${a} vs ${b}`)
  for (const [name, source] of [
    ['horizontal', [light('a', 100, 500), light('b', 900, 520), light('c', 500, 480)]],
    ['vertical', [light('a', 300, 100), light('b', 310, 800)]],
    ['irregular', [light('a', 10, 10, 2), light('b', 40, 90, 9), light('c', 70, 30, 5), light('d', 61, 75, 3)]],
  ]) {
    const { nodes, scale } = normalizeConstellation(source, frame)
    const box = extent(nodes)
    near((box.left + box.right) / 2, frame.width / 2, `${name} centered horizontally`)
    near((box.top + box.bottom) / 2, frame.height / 2, `${name} centered vertically`)
    assert.ok(box.left >= frame.padding - 1e-4 && box.right <= frame.width - frame.padding + 1e-4 && box.top >= frame.padding - 1e-4 && box.bottom <= frame.height - frame.padding + 1e-4, `${name}: glows inside the padding`)
    assert.ok(Math.abs(box.right - box.left - (frame.width - 2 * frame.padding)) < 1e-4 || Math.abs(box.bottom - box.top - (frame.height - 2 * frame.padding)) < 1e-4, `${name} fills one axis`)
    // Uniform: every distance scales by the same factor.
    near(Math.hypot(nodes[1].x - nodes[0].x, nodes[1].y - nodes[0].y), Math.hypot(source[1].x - source[0].x, source[1].y - source[0].y) * scale, `${name} undistorted`)
    assert.deepEqual(nodes.map(node => node.id), source.map(node => node.id), 'ids kept')
  }
  const single = normalizeConstellation([light('solo', 412, 87, 30)], frame).nodes[0]
  near(single.x, 110, 'one light centered'); near(single.y, 67.5, 'one light centered')
  assert.ok(Number.isFinite(single.radius) && single.radius > 0)
  // With the invitation: every glow, the featured light's widest rings and
  // the hand all fit inside the frame.
  const { invitationReach } = await server.ssrLoadModule('/src/features/orchestra-map/utils/constellation-invitation.ts')
  const invitedCluster = [light('a', 100, 500, 6), light('b', 900, 520, 6), light('c', 500, 480, 6), light('d', 520, 700, 9)].map((node, index) => ({ ...node, tier: index < 3 ? 0 : 1 }))
  const built = buildMiniature(invitedCluster, frame)
  assert.ok(built.invitation && ['a', 'b', 'c'].includes(built.invitation.id), 'carried by the featured tier')
  const invited = built.nodes.find(node => node.id === built.invitation.id)
  const drawn = invitationReach(invited.radius, built.invitation.side)
  assert.ok(invited.x - drawn.left >= -1e-4 && invited.x + drawn.right <= frame.width + 1e-4 && invited.y - drawn.top >= -1e-4 && invited.y + drawn.bottom <= frame.height + 1e-4, 'rings and hand inside the frame')
  const glowBox = extent(built.nodes)
  assert.ok(glowBox.left >= -1e-4 && glowBox.right <= frame.width + 1e-4 && glowBox.top >= -1e-4 && glowBox.bottom <= frame.height + 1e-4, 'glows inside the frame')
  const stacked = normalizeConstellation([light('a', 5, 5, 0), light('b', 5, 5, 0)], frame).nodes
  assert.ok(stacked.every(node => Number.isFinite(node.x) && Number.isFinite(node.y)), 'zero extent does not divide by zero')
  assert.deepEqual(normalizeConstellation([], frame).nodes, [])

  // Capture: from the meshes' instance matrices under their parents, through the camera.
  const root = new THREE.Group()
  root.position.set(3, -2, 0)
  const groups = Object.entries(Object.groupBy(positions, node => node.sectionId)).map(([, nodes]) => {
    const mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1), new THREE.MeshBasicMaterial(), nodes.length)
    nodes.forEach((node, index) => mesh.setMatrixAt(index, new THREE.Matrix4().makeScale(node.radius, node.radius, node.radius).setPosition(...node.position)))
    root.add(mesh)
    return { nodes, mesh }
  })
  const camera = new THREE.PerspectiveCamera(30, 1440 / 900, 0.1, 1000)
  camera.position.set(3, -2, 60)
  camera.lookAt(3, -2, 0)
  root.updateMatrixWorld(true)
  const viewport = { width: 1440, height: 900 }
  const orchestra = captureConstellation({ config, navigation: { level: 'orchestra' }, groups, camera, viewport })
  const strings = ids({ level: 'orchestra' })
  assert.equal(orchestra.nodes.length, strings.length, 'every Strings light, nothing else')
  assert.equal(orchestra.key, '/')
  for (const node of orchestra.nodes) assert.equal(node.color, nodeBaseColor(node, config), 'drawn in its own color')
  // The parent transform is applied: a light's miniature position matches
  // projecting its world position (seat + parent offset) and normalizing.
  const project = node => {
    const point = new THREE.Vector3(...node.position).add(root.position).project(camera)
    return { x: (point.x + 1) * 720, y: (1 - point.y) * 450 }
  }
  const [first, last] = [strings[0], strings.at(-1)]
  const a = orchestra.nodes.find(node => node.id === first.id), b = orchestra.nodes.find(node => node.id === last.id)
  const pa = project(first), pb = project(last)
  near((b.x - a.x) / orchestra.scale, pb.x - pa.x, 'horizontal arrangement preserved')
  near((b.y - a.y) / orchestra.scale, pb.y - pa.y, 'vertical arrangement preserved (screen y down)')
  near(a.x, pa.x * orchestra.scale + orchestra.offset.x, 'the exposed fit maps stage px into the miniature')
  // Relative sizes follow the lights' radii.
  const sizes = orchestra.nodes.map(node => node.radius / strings.find(seat => seat.id === node.id).radius)
  assert.ok(Math.max(...sizes) / Math.min(...sizes) < 1.25, 'sizes stay proportional (perspective aside)')
  const tuba = captureConstellation({ config, navigation: { level: 'instrument', familyId: 'brass', instrumentId: 'tuba' }, groups, camera, viewport })
  assert.equal(tuba.nodes.length, 1)
  // Centered together with its rings and hand, which reach further right
  // and below than above.
  assert.ok(Math.abs(tuba.nodes[0].x - DEFAULT_MINIATURE_FRAME.width / 2) < 6 && Math.abs(tuba.nodes[0].y - DEFAULT_MINIATURE_FRAME.height / 2) < 12, 'a one-light instrument sits in the middle')
  assert.ok(DEFAULT_MINIATURE_FRAME.width <= 160, 'small: an illustration, not a second map')
  // Lights behind the camera are left out; nothing in the scene is moved.
  const before = camera.position.clone()
  camera.position.set(3, -2, -1); camera.lookAt(3, -2, -100); root.updateMatrixWorld(true)
  assert.equal(captureConstellation({ config, navigation: { level: 'orchestra' }, groups, camera, viewport }).nodes.length, 0, 'behind the camera')
  assert.ok(camera.position.equals(new THREE.Vector3(3, -2, -1)) && !camera.position.equals(before))

  // On-screen size: follows the stage, clamped, proportions kept.
  const { miniatureDisplayScale, MINIATURE_DISPLAY } = await server.ssrLoadModule('/src/features/orchestra-map/utils/constellation-miniature.ts')
  const widthAt = (width, height) => miniatureDisplayScale({ width, height }) * DEFAULT_MINIATURE_FRAME.width
  near(widthAt(390, 844), MINIATURE_DISPLAY.minWidth, 'a phone keeps the legible minimum')
  near(widthAt(844, 390), MINIATURE_DISPLAY.minWidth, 'so does a short landscape phone')
  near(widthAt(2560, 1440), MINIATURE_DISPLAY.maxWidth, 'a large display stops at the maximum')
  assert.ok(widthAt(1024, 1366) > MINIATURE_DISPLAY.minWidth && widthAt(1024, 1366) < MINIATURE_DISPLAY.maxWidth, 'a tablet in between')
  assert.ok(widthAt(1100, 800) > widthAt(1000, 800) && widthAt(1300, 600) < widthAt(1300, 800), 'grows with the limiting side')

  // Free space for the illustration beside the map.
  const { findFreeSpot } = await server.ssrLoadModule('/src/features/orchestra-map/utils/free-spot.ts')
  const area = { x: 0, y: 0, width: 800, height: 500 }
  const size = { width: 150, height: 92 }
  const inside = spot => spot.x >= area.x && spot.y >= area.y && spot.x + size.width <= area.x + area.width && spot.y + size.height <= area.y + area.height
  const clearOf = (spot, rect, gap) => spot.x + size.width + gap <= rect.x || rect.x + rect.width + gap <= spot.x || spot.y + size.height + gap <= rect.y || rect.y + rect.height + gap <= spot.y
  const cluster = { x: 250, y: 180, width: 300, height: 150 }
  const spot = findFreeSpot({ size, area, hard: [cluster], gap: 12, step: 4 })
  assert.ok(spot && inside(spot) && clearOf(spot, cluster, 12), 'never on the hard content')
  assert.equal(findFreeSpot({ size, area, hard: [{ x: 0, y: 0, width: 800, height: 500 }] }), undefined, 'no room, no illustration')
  assert.equal(findFreeSpot({ size: { width: 900, height: 50 }, area, hard: [] }), undefined, 'larger than the stage')
  // Beyond comfortable clearance, it sits near what it illustrates.
  const open = { x: 0, y: 0, width: 1400, height: 800 }
  const small = { x: 1000, y: 300, width: 40, height: 40 }
  const nearby = findFreeSpot({ size, area: open, hard: [small], near: { x: 1020, y: 320 }, comfort: 40, step: 4 })
  assert.ok(nearby && Math.hypot(nearby.x + 75 - 1020, nearby.y + 46 - 320) < 260, 'beside its constellation, not in a far corner')
  assert.deepEqual(findFreeSpot({ size, area, hard: [cluster] }), findFreeSpot({ size, area, hard: [cluster] }), 'deterministic')
  // Anchored: corners and top/bottom centers first.
  const { spotAnchors } = await server.ssrLoadModule('/src/features/orchestra-map/utils/free-spot.ts')
  const anchorPoints = spotAnchors(size, area)
  const anchors = Object.values(anchorPoints).map(point => `${point.x},${point.y}`)
  const at = spot => `${spot.x},${spot.y}`
  const anchoredSpot = findFreeSpot({ size, area, hard: [cluster], prefer: [], near: { x: 400, y: 255 } })
  assert.ok(anchors.includes(at(anchoredSpot)), 'a free corner or edge center is used')
  assert.equal(at(findFreeSpot({ size, area, hard: [cluster], prefer: ['top-left'], near: { x: 790, y: 490 } })), `${area.x},${area.y}`, 'a preferred anchor wins, even away from the constellation')
  const bottomCenter = anchorPoints['bottom-center']
  assert.equal(at(findFreeSpot({ size, area, hard: [cluster], prefer: ['bottom-center'], near: { x: 10, y: 10 } })), at(bottomCenter), 'whichever anchor is preferred')
  assert.equal(at(findFreeSpot({ size, area, hard: [cluster, { x: bottomCenter.x + 10, y: bottomCenter.y + 10, width: 10, height: 10 }], prefer: ['bottom-center', 'top-right'], near: { x: 10, y: 10 } })), at(anchorPoints['top-right']), 'preferences are tried in order')
  const topLeftTaken = { x: 0, y: 0, width: 40, height: 40 }
  const nearRight = findFreeSpot({ size, area, hard: [cluster, topLeftTaken], prefer: ['top-left'], near: { x: 790, y: 490 } })
  assert.equal(at(nearRight), `${area.width - size.width},${area.height - size.height}`, 'otherwise the free anchor nearest its constellation')
  // Every anchor blocked: the whole area is searched instead.
  const corners = Object.values(anchorPoints).map(point => ({ x: point.x + 10, y: point.y + 10, width: 20, height: 20 }))
  const fallback = findFreeSpot({ size, area, hard: corners, prefer: ['top-left'], step: 4 })
  assert.ok(fallback && !anchors.includes(at(fallback)), 'falls back to free space elsewhere')

  console.log('Passed constellation miniature: per-view scope, tight undistorted centered crop, single/zero-extent lights, instance-matrix capture with parent transforms, colors, sizes, and clip exclusion.')
}
