import assert from 'node:assert/strict'

export async function verifyLightShape(server) {
  const { convexHull, withinShape, SHAPE_MIN_LIGHTS } = await server.ssrLoadModule('/src/features/orchestra-map/utils/light-shape.ts')
  const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 5, y: 5 }, { x: 5, y: 0 }]
  const hull = convexHull(square)
  assert.equal(hull.length, 4, 'interior and collinear points are dropped')
  assert.ok(withinShape({ x: 5, y: 5 }, hull, 0) && withinShape({ x: 2, y: 8 }, hull, 0), 'the gaps between lights count')
  assert.ok(!withinShape({ x: 13, y: 5 }, hull, 1), 'outside, beyond the margin')
  assert.ok(withinShape({ x: 10.8, y: 5 }, hull, 1), "the outer lights' circles count")
  assert.ok(withinShape({ x: -0.5, y: -0.5 }, hull, 1), 'around a corner')
  assert.ok(!withinShape({ x: -1, y: -1 }, hull, 1), 'but not past it')
  const line = convexHull([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 8, y: 0 }])
  assert.ok(withinShape({ x: 6, y: 0.5 }, line, 1) && !withinShape({ x: 6, y: 2 }, line, 1), 'a row of lights forms a band')
  assert.ok(withinShape({ x: 0.5, y: 0 }, convexHull([{ x: 0, y: 0 }]), 1) && !withinShape({ x: 3, y: 0 }, convexHull([{ x: 0, y: 0 }]), 1))
  assert.equal(withinShape({ x: 0, y: 0 }, [], 5), false)
  assert.equal(SHAPE_MIN_LIGHTS, 4, 'more than three lights')
  console.log('Passed light shape: convex outline, interior gaps, margin for circles, rows and single lights.')
}
