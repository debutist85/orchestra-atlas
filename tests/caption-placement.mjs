import assert from 'node:assert/strict'

export async function verifyCaptionPlacement(server) {
  const { placeCaption, resolveCaptionGap } = await server.ssrLoadModule('/src/features/orchestra-map/utils/caption-placement.ts')
  for (const edge of ['top', 'bottom']) {
    assert.equal(resolveCaptionGap(edge, 2, { width: 1280, height: 800 }), 16)
    assert.equal(resolveCaptionGap(edge, 2, { width: 1280, height: 400 }), 8)
  }
  for (const edge of ['left', 'right']) {
    assert.equal(resolveCaptionGap(edge, 2, { width: 1000, height: 800 }), 20)
    assert.equal(resolveCaptionGap(edge, 2, { width: 500, height: 800 }), 10)
  }
  assert.equal(resolveCaptionGap('center', 100, { width: 1000, height: 800 }), 0)
  const bounds = { x: 350, y: 300, width: 300, height: 180 }
  const size = { width: 120, height: 100 }
  for (const edge of ['top', 'bottom', 'left', 'right']) for (const align of ['start', 'center', 'end']) {
    for (const side of ['inside', 'outside']) for (const gap of [0, 16, 100]) {
      const result = placeCaption(bounds, size, edge, align, gap, side)
      const vertical = edge === 'top' || edge === 'bottom'
      const offset = align === 'start' ? 0 : align === 'end' ? 1 : .5
      assert.equal(vertical ? result.x : result.y, vertical ? bounds.x + (bounds.width - size.width) * offset : bounds.y + (bounds.height - size.height) * offset)
      if (edge === 'top') assert.equal(side === 'inside' ? result.y - bounds.y : bounds.y - result.y - size.height, gap)
      if (edge === 'bottom') assert.equal(side === 'inside' ? bounds.y + bounds.height - result.y - size.height : result.y - bounds.y - bounds.height, gap)
      if (edge === 'left') assert.equal(side === 'inside' ? result.x - bounds.x : bounds.x - result.x - size.width, gap)
      if (edge === 'right') assert.equal(side === 'inside' ? bounds.x + bounds.width - result.x - size.width : result.x - bounds.x - bounds.width, gap)
      const shifted = placeCaption({ ...bounds, x: bounds.x - 1000, y: bounds.y - 1000 }, size, edge, align, gap, side)
      assert.equal(shifted.x, result.x - 1000)
      assert.equal(shifted.y, result.y - 1000)
      assert.deepEqual(placeCaption(bounds, size, 'center', align, gap, side), { x: 440, y: 340 })
    }
  }
  const { identityCaptionPlacement, instrumentLayout } = await server.ssrLoadModule('/src/features/orchestra-map/identity-layout.ts')
  assert.deepEqual(identityCaptionPlacement({ level: 'family', familyId: 'brass' }, 'portrait'), { edge: 'top', align: 'center', gap: 2, side: 'outside' })
  const custom = instrumentLayout({ portrait: { edge: 'left', align: 'end', side: 'inside' } })
  assert.equal(custom.portrait.edge, 'left')
  assert.equal(custom.landscape.edge, 'top')
  console.log('Passed independent edge/alignment, inside/outside gaps, unconstrained translation, center semantics, and orientation overrides.')
}
