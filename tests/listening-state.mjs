import assert from 'node:assert/strict'
import { createServer } from 'vite'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { useNavigationStore: navigation } = await server.ssrLoadModule('/src/store/navigation-store.ts')
  const { useListeningStore: listening, effectiveListeningMode } = await server.ssrLoadModule('/src/store/listening-store.ts')
  const { familySelection, familyInstrumentIds } = await server.ssrLoadModule('/src/store/catalog.ts')
  const { connectListeningEngine, channelGainDb, audioSelection } = await server.ssrLoadModule('/src/features/listening/audio-selection.ts')
  const nav = navigation.getState()
  const actions = listening.getState()
  const updates = []
  const disconnect = connectListeningEngine({ applySelection: state => updates.push(state) })
  assert.equal(updates.at(-1).effectiveListeningMode, 'normal')
  for (const [family, instrument] of [['woodwinds', 'flute'], ['strings', 'cello'], ['brass', 'horn']]) {
    const previous = listening.getState().selectedInstrumentIds
    nav.enterFamily(family)
    nav.enterInstrument(instrument)
    assert.deepEqual(listening.getState().selectedInstrumentIds, previous)
    actions.selectInstrument(instrument)
    nav.goBack()
    assert.deepEqual(navigation.getState().navigation, { level: 'family', familyId: family })
    nav.goBack()
    assert.deepEqual(navigation.getState().navigation, { level: 'orchestra' })
  }
  assert.deepEqual(listening.getState().selectedInstrumentIds, ['flute', 'cello', 'horn'])
  actions.selectFamily('woodwinds')
  actions.selectFamily('woodwinds')
  assert.equal(familySelection('woodwinds', listening.getState().selectedInstrumentIds), 'all')
  actions.deselectInstrument('bassoon')
  assert.equal(familySelection('woodwinds', listening.getState().selectedInstrumentIds), 'partial')
  actions.deselectFamily('woodwinds')
  assert.deepEqual(listening.getState().selectedInstrumentIds, ['cello', 'horn'])
  assert.equal(familySelection('woodwinds', listening.getState().selectedInstrumentIds), 'none')
  actions.selectFamily('other')
  assert.deepEqual(familyInstrumentIds('other'), ['celesta', 'harp'])
  assert.equal(familySelection('other', listening.getState().selectedInstrumentIds), 'all')
  actions.setListeningMode('highlight')
  assert.equal(channelGainDb('cello', updates.at(-1)), 0)
  assert.equal(channelGainDb('flute', updates.at(-1)), -15)
  assert.equal(channelGainDb('flute', updates.at(-1), { highlightAttenuationDb: -9, isolateAttenuationDb: -60 }), -9)
  actions.setListeningMode('isolate')
  assert.equal(channelGainDb('flute', updates.at(-1)), -Infinity)
  nav.enterInstrument('flute')
  const location = navigation.getState().navigation
  actions.clearSelection()
  assert.deepEqual(navigation.getState().navigation, location)
  assert.equal(effectiveListeningMode(listening.getState()), 'normal')
  assert.equal(channelGainDb('flute', updates.at(-1)), 0)
  actions.toggleInstrument('flute')
  assert.equal(updates.at(-1).effectiveListeningMode, 'isolate')
  actions.toggleInstrument('flute')
  assert.equal(updates.at(-1).effectiveListeningMode, 'normal')
  for (const mode of ['normal', 'highlight', 'isolate']) {
    actions.setListeningMode(mode)
    assert.equal(audioSelection(listening.getState()).effectiveListeningMode, 'normal')
  }
  nav.enterInstrument('not-an-instrument')
  assert.deepEqual(navigation.getState().navigation, location)
  actions.selectInstrument('not-an-instrument')
  assert.equal(listening.getState().selectedInstrumentIds.length, 0)
  const count = updates.length
  disconnect()
  actions.selectInstrument('flute')
  assert.equal(updates.length, count)
  console.log('Passed navigation independence, persistent selection, partial families, Other, empty-selection safety, mixing and subscription cleanup.')
} finally {
  await server.close()
}
