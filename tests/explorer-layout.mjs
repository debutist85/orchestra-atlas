import assert from 'node:assert/strict'

export async function verifyExplorerLayout(server) {
  const { explorerLayout, explorerLayoutDefaults, explorerLayoutOverrides, stageLabelGaps, LABEL_GAP_SCALE } = await server.ssrLoadModule('/src/features/instrument-explorer/config.ts')

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

  // Gaps shrink with a small stage along the direction they run.
  const gaps = { title: 32, description: 40 }
  assert.deepEqual(stageLabelGaps(gaps, 'landscape', { width: 1440, height: 900 }), gaps, 'a roomy landscape keeps the configured gaps')
  const phone = stageLabelGaps(gaps, 'landscape', { width: 640, height: 360 })
  assert.equal(phone.description, 20, 'half the reference width, half the gap')
  assert.equal(phone.title, 16)
  assert.equal(stageLabelGaps(gaps, 'landscape', { width: 100, height: 360 }).description, 40 * LABEL_GAP_SCALE.minFactor, 'never below the minimum share')
  assert.equal(stageLabelGaps(gaps, 'portrait', { width: 390, height: 450 }).description, 20, 'portrait gaps follow the height, not the narrow width')
  assert.deepEqual(stageLabelGaps(gaps, 'portrait', { width: 390, height: 1000 }), gaps)

  console.log('Passed explorer layout: shared defaults, per-instrument per-orientation scale and gap overrides, and gaps scaled to the stage.')
}
