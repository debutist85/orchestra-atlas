import assert from 'node:assert/strict'

export async function verifyHotspots(server) {
  const { parseHotspotConfig, serializeHotspots, hotspotCameraPreset, hotspotIdError, nextHotspotId, roundVec3, configuredHotspots } = await server.ssrLoadModule('/src/features/instrument-explorer/content/hotspots.ts')
  const { useHotspotStore } = await server.ssrLoadModule('/src/store/hotspot-store.ts')

  const landscape = { target: [0, 0.1, 0], position: [0, 0.1, 0.4] }
  const portrait = { target: [0, 0.1, 0], position: [0, 0.1, 0.6] }
  const parsed = parseHotspotConfig({
    hotspots: [
      { id: 'purfling', title: 'Purfling', description: 'Inlaid edge.', position: [0.1, 0.2, 0.3], view: { landscape } },
      { id: 'no-title', position: [0, 0, 0] },
      { id: 'bad-position', position: [0, 0] },
      { title: 'missing id', position: [0, 0, 0] },
    ],
  })
  assert.deepEqual(parsed.map(hotspot => hotspot.id), ['purfling', 'no-title'], 'malformed entries are dropped, valid ones kept')
  assert.deepEqual(parsed[1], { id: 'no-title', title: '', description: '', position: [0, 0, 0] }, 'missing text fields default to empty')
  assert.deepEqual(parseHotspotConfig(null), [])
  assert.deepEqual(parseHotspotConfig({ hotspots: 'nope' }), [])
  assert.deepEqual(parseHotspotConfig(JSON.parse(serializeHotspots(parsed))), parsed, 'export round-trips through the parser')

  assert.deepEqual(hotspotCameraPreset(parsed[0], 'portrait'), landscape, 'portrait falls back to the landscape view')
  assert.deepEqual(hotspotCameraPreset({ ...parsed[0], view: { portrait } }, 'landscape'), portrait, 'landscape falls back to the portrait view')
  assert.deepEqual(hotspotCameraPreset({ ...parsed[0], view: { landscape, portrait } }, 'portrait'), portrait)
  assert.equal(hotspotCameraPreset(parsed[1], 'landscape'), undefined, 'no view → automatic close-up')

  assert.equal(hotspotIdError('purfling', parsed), 'ID already in use')
  assert.equal(hotspotIdError('purfling', parsed, 'purfling'), undefined, 'keeping its own id is fine')
  assert.equal(hotspotIdError('Anchor_Bridge', parsed), 'Anchor_ is reserved for model anchors')
  assert.ok(hotspotIdError('has space', parsed))
  assert.ok(hotspotIdError('', parsed))
  assert.equal(nextHotspotId([{ id: 'hotspot-1' }, { id: 'hotspot-3' }]), 'hotspot-2')
  assert.deepEqual(roundVec3([0.123456, -1.000049, 2]), [0.1235, -1, 2])
  assert.ok(Array.isArray(configuredHotspots('horn')), 'an instrument without a config file has no hotspots')

  const store = useHotspotStore.getState()
  store.load('horn')
  const created = useHotspotStore.getState().add([1, 2, 3])
  assert.equal(created.id, 'hotspot-1')
  assert.equal(useHotspotStore.getState().editingId, 'hotspot-1', 'a new hotspot opens for editing')
  useHotspotStore.getState().setPlacement('move')
  useHotspotStore.getState().update('hotspot-1', { id: 'rim', title: 'Rim' })
  assert.equal(useHotspotStore.getState().editingId, 'rim', 'renaming the id keeps it selected for editing')
  assert.deepEqual(useHotspotStore.getState().hotspots, [{ id: 'rim', title: 'Rim', description: '', position: [1, 2, 3] }])
  useHotspotStore.getState().remove('rim')
  assert.deepEqual(useHotspotStore.getState().hotspots, [])
  assert.equal(useHotspotStore.getState().editingId, null)
  assert.equal(useHotspotStore.getState().placement, 'off', 'deleting the hotspot being moved cancels the move')
  useHotspotStore.getState().add([0, 0, 0])
  useHotspotStore.getState().discardDraft()
  assert.deepEqual(useHotspotStore.getState().hotspots, useHotspotStore.getState().savedHotspots, 'discarding restores the config file')
  useHotspotStore.getState().add([0, 0, 0])
  useHotspotStore.getState().load('violin')
  assert.equal(useHotspotStore.getState().instrumentId, 'violin')
  assert.ok(useHotspotStore.getState().hotspots.every(hotspot => hotspot.id !== 'hotspot-1'), 'switching instrument replaces the previous one’s hotspots')

  console.log('Passed hotspot config parsing/export, view fallback, id rules, and editor store transitions.')
}
