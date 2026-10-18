import assert from 'node:assert/strict'

export async function verifyRadialActions(server) {
  const { radialActionPositions } = await server.ssrLoadModule('/src/features/instrument-explorer/viewer/radial-actions-layout.ts')
  for (const portrait of [false, true]) {
    const center = portrait ? { x: 200, y: 400 } : { x: 500, y: 300 }
    const area = portrait ? { left: 16, top: 66, width: 368, height: 650 } : { left: 16, top: 66, width: 968, height: 550 }
    const note = portrait ? { left: 0, top: 460, width: 400, height: 340 } : { left: 560, top: 0, width: 440, height: 720 }
    for (const count of [1, 2, 3, 5, 8]) {
      const points = radialActionPositions(center, count, area, portrait, [note])
      assert.equal(points.length, count)
      const radii = points.map(point => Math.hypot(point.x - center.x, point.y - center.y))
      for (const radius of radii) assert.ok(Math.abs(radius - radii[0]) < 1e-6, 'nodes share a circle')
      for (const [i, point] of points.entries()) {
        assert.ok(portrait ? point.y < center.y : point.x < center.x)
        assert.ok(point.x - 24 >= area.left && point.x + 24 <= area.left + area.width)
        assert.ok(point.y - 24 >= area.top && point.y + 24 <= area.top + area.height)
        if (i) assert.ok(Math.hypot(point.x - points[i - 1].x, point.y - points[i - 1].y) >= 56 - 1e-6, 'touch targets do not overlap')
      }
      const angles = points.map(point => Math.atan2(point.y - center.y, point.x - center.x))
      for (let i = 2; i < angles.length; i++) {
        const delta = angle => Math.atan2(Math.sin(angle), Math.cos(angle))
        assert.ok(Math.abs(delta(angles[i] - angles[i - 1]) - delta(angles[1] - angles[0])) < 1e-6, 'even angular spacing')
      }
    }
    const map = { left: 16, top: 66, width: 160, height: 100 }
    const points = radialActionPositions(center, 3, area, portrait, [note, map])
    assert.equal(points.length, 3)
    for (const point of points) assert.ok(point.x + 26 <= map.left || point.x - 26 >= map.left + map.width || point.y - 26 >= map.top + map.height || point.y + 26 <= map.top)
  }
  const broad = radialActionPositions({ x: 500, y: 300 }, 3,
    { left: 16, top: 66, width: 968, height: 550 }, false)
  assert.ok(Math.hypot(broad[0].x - 500, broad[0].y - 300) >= 200, 'roomy stages use a larger arc')
  const constrained = radialActionPositions({ x: 500, y: 160 }, 3,
    { left: 16, top: 66, width: 968, height: 550 }, false)
  assert.equal(constrained.length, 3)
  assert.ok(Math.hypot(constrained[0].x - 500, constrained[0].y - 160) > 80,
    'edge constraints preserve the largest nearby fitting radius, not the smallest fallback')
  assert.deepEqual(radialActionPositions({ x: 0, y: 0 }, 3, { left: 16, top: 66, width: 200, height: 200 }, false), [], 'unsafe travel poses do not expose overlapping nodes')
  assert.deepEqual(radialActionPositions({ x: 100, y: 100 }, 0, { left: 0, top: 0, width: 200, height: 200 }, true), [])
  console.log('Passed radial action halves, circular/even spacing, touch clearance, safe margins, minimap/note avoidance, and travel fallback.')
}
