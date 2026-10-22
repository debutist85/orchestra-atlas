import assert from 'node:assert/strict'

export async function verifyInstrumentPerformance(server) {
  const { instrumentExperience, performanceEmbedUrl } = await server.ssrLoadModule('/src/features/instrument-explorer/content/explorable-instruments.ts')
  const { useAnatomyStore } = await server.ssrLoadModule('/src/store/anatomy-store.ts')
  const at = (familyId, instrumentId) => instrumentExperience({ level: 'instrument', familyId, instrumentId })

  const violin = at('strings', 'violin').performance
  assert.deepEqual(violin, { videoId: 'SfnSamBCMVA', startSeconds: 360, performer: 'Madeline Adkins', ensemble: 'Utah Symphony' })
  assert.equal(at('strings', 'doubleBass').performance.performer, 'David Yavornitzky', 'contrabass maps to doubleBass')
  assert.equal(at('strings', 'harp').performance, undefined, 'instruments without a video have no trigger')

  const url = new URL(performanceEmbedUrl(violin))
  assert.equal(url.origin, 'https://www.youtube-nocookie.com')
  assert.equal(url.pathname, '/embed/SfnSamBCMVA')
  assert.equal(url.searchParams.get('start'), '360')
  assert.equal(url.searchParams.get('rel'), '0')
  assert.equal(url.searchParams.get('controls'), '0', 'no control bar')
  assert.equal(url.searchParams.get('fs'), '0')
  assert.equal(url.searchParams.has('si'), false, 'no share-tracking id')
  assert.equal(url.searchParams.has('enablejsapi'), false)
  const listening = new URL(performanceEmbedUrl(violin, 'https://atlas.example'))
  assert.equal(listening.searchParams.get('enablejsapi'), '1', 'player state is reported for the fade')
  assert.equal(listening.searchParams.get('origin'), 'https://atlas.example')

  const store = () => useAnatomyStore.getState()
  store().returnToInstrument()
  store().openPerformance()
  assert.equal(store().performanceOpen, true)
  store().selectAnatomyPart('bridge')
  assert.equal(store().performanceOpen, false, 'selecting a part closes the performance')
  store().openPerformance()
  assert.equal(store().performanceOpen, false, 'only opens from the general view')
  store().returnToInstrument()
  store().openPerformance()
  store().returnToInstrument()
  assert.equal(store().performanceOpen, false, 'leaving resets it')
}
