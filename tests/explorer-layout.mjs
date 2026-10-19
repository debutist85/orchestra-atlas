import assert from 'node:assert/strict'

export async function verifyExplorerLayout(server) {
  const { explorerLayout, explorerLayoutDefaults, explorerLayoutOverrides } = await server.ssrLoadModule('/src/features/instrument-explorer/config.ts')

  const { instrumentCatalog } = await server.ssrLoadModule('/src/store/catalog.ts')

  // Every instrument starts from the same composition unless tuned; the
  // tuned values themselves are art direction, so only their sanity is
  // checked here, not the numbers.
  assert.deepEqual(explorerLayout('violin'), explorerLayoutDefaults)
  for (const { instrument } of instrumentCatalog) {
    const layout = explorerLayout(instrument)
    for (const orientation of ['landscape', 'portrait']) {
      assert.ok(layout.scale[orientation] > 0 && layout.scale[orientation] <= 1, `${instrument} ${orientation} scale is a share of the frame`)
      for (const gap of Object.values(layout.gaps[orientation])) assert.ok(Number.isFinite(gap) && gap >= 0, `${instrument} ${orientation} gaps are non-negative px`)
    }
  }

  // An override changes only what it names — down to a single gap in a
  // single orientation — for only that instrument.
  assert.deepEqual(explorerLayout('horn').gaps, explorerLayoutDefaults.gaps, 'horn inherits default gaps in both orientations')
  const hornOverride = explorerLayoutOverrides.horn
  explorerLayoutOverrides.horn = { portrait: { scale: 0.8, gap: { title: 24 } } }
  try {
    assert.deepEqual(explorerLayout('horn'), {
      labelBounds: explorerLayoutDefaults.labelBounds,
      scale: { landscape: explorerLayoutDefaults.scale.landscape, portrait: 0.8 },
      gaps: { landscape: explorerLayoutDefaults.gaps.landscape, portrait: { ...explorerLayoutDefaults.gaps.portrait, title: 24 } },
    })
    assert.deepEqual(explorerLayout('violin'), explorerLayoutDefaults)
    assert.notEqual(explorerLayout('horn').gaps.portrait, explorerLayoutDefaults.gaps.portrait, 'defaults are never mutated through a result')
    assert.notEqual(explorerLayout('horn').scale, explorerLayoutDefaults.scale)
  } finally {
    explorerLayoutOverrides.horn = hornOverride
  }

  console.log('Passed explorer layout: shared defaults and per-instrument per-orientation scale and gap overrides.')
}
