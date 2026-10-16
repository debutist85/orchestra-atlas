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
      for (const point of points) {
        assert.ok(point.x - (diameter + 20) / 2 >= left + edge - 0.01 && point.x < projection.x, 'nodes respect the left stage inset')
        assert.ok(point.y - diameter / 2 >= edge && point.y + diameter / 2 + 32 <= height - edge + 0.01, 'circles and labels respect the vertical stage insets')
        assert.ok(Math.hypot(point.x - projection.x, point.y - projection.y) >= 44, 'actions leave the feature visible')
      }
      for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        assert.ok(Math.abs(points[i].x - points[j].x) >= diameter + 20 - 0.01 || Math.abs(points[i].y - points[j].y) >= diameter + 32 - 0.01, 'node and label boxes do not overlap')
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
  // Large responsive nodes must not trigger a grid solely due to a fixed
  // radius cap when there is ample space for an arc.
  const roomy = { x: 1000, y: 600, view: { left: 320, top: 0, width: 1360, height: 1200 }, moving: false, visible: true }
  const arc = constellationLayout(roomy, 4, { width: 1920, height: 1200 })
  assert.ok(arc[0].x > arc[1].x + 20)
  assert.ok(arc[3].x > arc[2].x + 20)
  assert.ok(arc.every((point, index) => index === 0 || point.y > arc[index - 1].y), 'arc runs from upper-left to lower-left')
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
