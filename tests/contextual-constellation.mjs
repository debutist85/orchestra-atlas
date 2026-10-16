import assert from 'node:assert/strict'

export async function verifyContextualConstellation(server) {
  const { constellationLayout, constellationNodeSize, constellationEdgeInset, constellationNoteLayout, constellationLineEnd, constellationConnection } = await server.ssrLoadModule('/src/features/instrument-explorer/contextual-constellation-layout.ts')
  for (const [left, width, height] of [[308, 1132, 900], [280, 564, 390], [280, 360, 320], [0, 390, 500], [0, 320, 260], [0, 900, 1000]]) {
    for (const count of [1, 2, 3, 4]) {
      const projection = { x: left + width / 2, y: height / 2, view: { left, top: 0, width, height }, moving: false, visible: true }
      const points = constellationLayout(projection, count)
      const diameter = constellationNodeSize(projection.view, { width, height }, count)
      const edge = constellationEdgeInset(projection.view)
      assert.equal(points.length, count)
      const radii = points.map(point => Math.hypot(point.x - projection.x, point.y - projection.y))
      for (const point of points) {
        assert.ok(point.x - (diameter + 20) / 2 >= left + edge - 0.01, 'nodes respect the left stage inset')
        assert.ok(point.x + (diameter + 20) / 2 <= left + width - edge + 0.01, 'nodes respect the right stage inset')
        assert.ok(point.y - diameter / 2 >= edge && point.y + diameter / 2 + 32 <= height - edge + 0.01, 'circles and labels respect the vertical stage insets')
        assert.ok(Math.hypot(point.x - projection.x, point.y - projection.y) >= 36, 'actions leave the feature visible')
      }
      assert.ok(radii.every(radius => Math.abs(radius - radii[0]) < 1e-6), 'nodes share one circle radius')
      const separation = count > 1 ? (Math.max(diameter + 20, diameter + 32) + 8) / (2 * Math.sin(Math.PI / count)) : 0
      const neededGap = Math.max(diameter + 20, diameter + 32) + 8
      if (radii[0] + 0.01 >= separation) {
        for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
          const steps = Math.min(j - i, count - (j - i))
          if (steps !== 1) continue
          assert.ok(Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) >= neededGap - 0.01, 'neighboring nodes stay a box apart')
        }
      }
    }
  }
  for (const view of [{ left: 280, top: 0, width: 564, height: 390 }, { left: 0, top: 0, width: 320, height: 260 }]) {
    for (const fraction of [0.15, 0.5, 0.85]) {
      const node = { x: view.left + view.width * fraction, y: view.height * fraction }
      const layout = constellationNoteLayout(view, node, 60, 400)
      const edge = constellationEdgeInset(view)
      assert.ok(layout.width > 0)
      assert.ok(layout.left >= view.left + edge)
      assert.ok(layout.left + layout.width <= view.left + view.width - edge + 0.01)
      assert.ok(layout.top >= edge)
      assert.ok(layout.top + Math.min(400, layout.maxHeight) <= view.height - edge + 0.01)
      assert.ok(layout.left >= node.x + 46 || layout.left + layout.width <= node.x - 46 + 0.01, 'note sits beside the node')
    }
  }
  // Three equally spaced nodes form an equilateral triangle around the
  // hotspot. A smaller stage contracts the radius without distorting it.
  const roomy = { x: 1000, y: 600, view: { left: 320, top: 0, width: 1360, height: 1200 }, moving: false, visible: true }
  const triangle = constellationLayout(roomy, 3, { width: 1920, height: 1200 })
  const sides = triangle.map((point, index) => {
    const next = triangle[(index + 1) % triangle.length]
    return Math.hypot(next.x - point.x, next.y - point.y)
  })
  assert.ok(sides.every(side => Math.abs(side - sides[0]) < 1e-6), 'three nodes form an equilateral triangle')
  assert.ok(Math.abs(Math.hypot(triangle[0].x - roomy.x, triangle[0].y - roomy.y) - 190 * 2 / 3) < 1e-6, 'a roomy orbit sits a third closer than the 190px radius')
  const diamond = constellationLayout(roomy, 4, { width: 1920, height: 1200 })
  const diamondRadius = Math.hypot(diamond[0].x - roomy.x, diamond[0].y - roomy.y)
  const axes = [[0, -1], [1, 0], [0, 1], [-1, 0]]
  diamond.forEach((point, index) => {
    const [dx, dy] = axes[index]
    assert.ok(Math.abs(point.x - roomy.x - dx * diamondRadius) < 1e-6 && Math.abs(point.y - roomy.y - dy * diamondRadius) < 1e-6, 'four nodes form a diamond')
  })
  const openStage = { left: 280, top: 0, width: 564, height: 390 }
  const panelStage = { left: 280, top: 0, width: 280, height: 390 }
  const windowSize = { width: 844, height: 390 }
  assert.equal(constellationNodeSize(openStage, windowSize, 4), constellationNodeSize(panelStage, windowSize, 4), 'opening a panel does not shrink the nodes')
  const openPoint = constellationLayout({ x: 562, y: 195, view: openStage, moving: false, visible: true }, 4, windowSize)[0]
  const panelPoint = constellationLayout({ x: 420, y: 195, view: panelStage, moving: false, visible: true }, 4, windowSize)[0]
  assert.ok(Math.hypot(panelPoint.x - 420, panelPoint.y - 195) < Math.hypot(openPoint.x - 562, openPoint.y - 195), 'opening a panel contracts the orbit')
  const cramped = { x: 160, y: 130, view: { left: 0, top: 0, width: 320, height: 260 }, moving: false, visible: true }
  const crampedTriangle = constellationLayout(cramped, 3, { width: 320, height: 260 })
  const roomyRadius = Math.hypot(triangle[0].x - roomy.x, triangle[0].y - roomy.y)
  const crampedRadius = Math.hypot(crampedTriangle[0].x - cramped.x, crampedTriangle[0].y - cramped.y)
  assert.ok(crampedRadius < roomyRadius, 'the orbit radius contracts when room is limited')
  assert.deepEqual(constellationLineEnd({ x: 0, y: 0 }, { x: 100, y: 0 }, 30), { x: 70, y: 0 })
  assert.deepEqual(constellationLineEnd({ x: 0, y: 0 }, { x: 0, y: 0 }, 30), { x: 0, y: 0 })
  const diagonal = constellationLineEnd({ x: 20, y: 30 }, { x: 120, y: 130 }, 36)
  assert.ok(Math.abs(Math.hypot(diagonal.x - 120, diagonal.y - 130) - 36) < 1e-6)
  assert.deepEqual(constellationConnection({ x: 0, y: 0 }, { x: 100, y: 0 }, 10, 30), { start: { x: 10, y: 0 }, end: { x: 70, y: 0 } })
  const { useAnatomyStore } = await server.ssrLoadModule('/src/store/anatomy-store.ts')
  const store = useAnatomyStore.getState()
  store.returnToInstrument()
  store.openDiscovery()
  assert.equal(useAnatomyStore.getState().discoveryOpen, false)
  store.selectAnatomyPart('Anchor_Bridge')
  store.openDiscovery()
  assert.equal(useAnatomyStore.getState().discoveryOpen, true)
  store.closeDiscovery()
  assert.equal(useAnatomyStore.getState().selectedPartId, 'Anchor_Bridge')
  store.openDiscovery()
  store.openPerformance('pizzicato', 'violin')
  assert.equal(useAnatomyStore.getState().discoveryOpen, false)
  assert.equal(useAnatomyStore.getState().demonstrationOpen, true)
  store.openDiscovery()
  assert.equal(useAnatomyStore.getState().discoveryOpen, false, 'video and discovery cannot overlap')
  store.closeDemonstration()
  assert.equal(useAnatomyStore.getState().selectedPartId, 'Anchor_Bridge')
  store.openDiscovery()
  store.selectAnatomyPart('Anchor_Bow')
  assert.equal(useAnatomyStore.getState().discoveryOpen, false)
  for (let i = 0; i < 10; i++) {
    store.selectAnatomyPart('Anchor_Bridge')
    store.openDiscovery()
    store.openPerformance('pizzicato', 'violin')
    store.closeDemonstration()
    store.returnToInstrument()
  }
  assert.equal(useAnatomyStore.getState().selectedPartId, null)
  assert.equal(useAnatomyStore.getState().discoveryOpen, false)
  console.log('Passed constellation placement, contextual state, performance return, and repeated navigation checks.')
}
