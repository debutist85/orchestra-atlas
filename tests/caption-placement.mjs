import assert from 'node:assert/strict'

export async function verifyCaptionPlacement(server) {
  const { placeCaption } = await server.ssrLoadModule('/src/features/orchestra-map/utils/caption-placement.ts')
  const bounds = { x: 350, y: 300, width: 300, height: 180 }
  const size = { width: 120, height: 100 }
  const expected = {
    'top-left': [214, 184], 'top-center': [440, 184], 'top-right': [666, 184],
    'bottom-left': [214, 496], 'bottom-center': [440, 496], 'bottom-right': [666, 496],
    center: [440, 340],
  }
  for (const [placement, [x, y]] of Object.entries(expected)) {
    assert.deepEqual(placeCaption(bounds, size, placement), { x, y })
  }
  const insideExpected = {
    'top-left': [366, 316], 'top-center': [440, 316], 'top-right': [514, 316],
    'bottom-left': [366, 364], 'bottom-center': [440, 364], 'bottom-right': [514, 364],
    center: [440, 340],
  }
  for (const [placement, [x, y]] of Object.entries(insideExpected)) {
    assert.deepEqual(placeCaption(bounds, size, placement, 16, 'inside'), { x, y })
  }
  const top = placeCaption({ ...bounds, y: 80 }, size, 'top-center')
  assert.equal(top.y, -36, 'outside captions rely on framing, without a second position clamp')
  assert.equal(placeCaption({ ...bounds, y: 20 }, size, 'top-center', 16, 'inside').y, 36,
    'inside captions retain their authored edge without stage clamping')
  assert.equal(placeCaption({ x: -200, y: -200, width: 20, height: 20 }, size, 'center').x, -250,
    'centered captions remain centered even outside the stage')
  const zeroGap = placeCaption(bounds, size, 'top-left', 0)
  assert.equal(zeroGap.x + size.width, bounds.x, 'left anchors caption right')
  assert.equal(zeroGap.y + size.height, bounds.y, 'top anchors caption bottom')
  const opposite = placeCaption(bounds, size, 'bottom-right', 0)
  assert.equal(opposite.x, bounds.x + bounds.width, 'right anchors caption left')
  assert.equal(opposite.y, bounds.y + bounds.height, 'bottom anchors caption top')
  // Moving the constellation translates every caption identically, even
  // beyond stage boundaries, without an edge collision or post-zoom snap.
  for (const placement of Object.keys(expected)) for (const side of ['inside', 'outside']) {
    const initial = placeCaption(bounds, size, placement, 16, side)
    const shifted = placeCaption({ ...bounds, x: bounds.x - 1000, y: bounds.y - 1000 }, size, placement, 16, side)
    assert.equal(shifted.x, initial.x - 1000)
    assert.equal(shifted.y, initial.y - 1000)
  }
  const { identityCaptionPlacement } = await server.ssrLoadModule('/src/features/orchestra-map/identity-layout.ts')
  assert.deepEqual(identityCaptionPlacement({ level: 'family', familyId: 'brass' }, 'portrait'), { placement: 'top-center', gap: 16, side: 'outside' })
  console.log('Passed caption anchors, explicit inside/outside edges, unconstrained translation in all placement modes.')
}
