import assert from 'node:assert/strict'
import { createServer } from 'vite'
import { verifyEntityLayout } from './entity-layout.mjs'
import { verifyIdleAnimation } from './idle-animation.mjs'
import { verifyNavigationMotion } from './navigation-motion.mjs'
import { verifyGhostIdle } from './ghost-idle.mjs'
import { verifyNavigationPath } from './navigation-path.mjs'
import { verifyPlayback } from './playback.mjs'
import { verifyInstrumentActivity } from './instrument-activity.mjs'
import { verifyActivityProfile } from './activity-profile.mjs'
import { verifyOfflineActivity } from './offline-activity.mjs'
import { verifyOpusEncode } from './opus-encode.mjs'
import { verifyOpusChunks } from './opus-chunks.mjs'
import { verifyChunkPlayback } from './chunk-playback.mjs'
import { verifyPlaybackPlan } from './playback-plan.mjs'

const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { useNavigationStore: navigation } = await server.ssrLoadModule('/src/store/navigation-store.ts')
  const { familyInstrumentIds, highlightedInstrumentIds } = await server.ssrLoadModule('/src/store/catalog.ts')
  const { connectListeningEngine, audioSelection, linearGainFromDb, orchestraAverageIntensity } = await server.ssrLoadModule('/src/features/listening/audio-selection.ts')
  const { useListeningLockStore } = await server.ssrLoadModule('/src/store/listening-lock-store.ts')
  const { excerptStems, stemUrlFor, stemUrlsFor } = await server.ssrLoadModule('/src/features/listening/stems.ts')
  assert.equal(stemUrlFor('flute'), '/beethoven-7th-2nd/audio/opus/flute-1.opus')
  assert.deepEqual(stemUrlsFor('flute'), ['/beethoven-7th-2nd/audio/opus/flute-1.opus', '/beethoven-7th-2nd/audio/opus/flute-2.opus'])
  assert.equal(stemUrlFor('doubleBass'), '/beethoven-7th-2nd/audio/opus/contrabass.opus')
  assert.equal(stemUrlFor('trombone'), undefined)
  assert.ok(excerptStems.some(stem => stem.instrument === 'cello' && stem.urls.length === 2))
  assert.ok(!excerptStems.some(stem => stem.instrument === 'harp'))
  assert.ok(Math.abs(linearGainFromDb(-15) - 10 ** (-15 / 20)) < 1e-9)
  assert.equal(linearGainFromDb(Number.NEGATIVE_INFINITY), 0)
  const nav = navigation.getState()
  const updates = []
  const disconnect = connectListeningEngine({ applySelection: state => updates.push(state) })
  assert.equal(updates.at(-1).effectiveListeningMode, 'normal')
  assert.deepEqual(updates.at(-1).selectedInstrumentIds, [])

  nav.enterFamily('woodwinds')
  assert.deepEqual(navigation.getState().navigation, { level: 'family', familyId: 'woodwinds' })
  assert.equal(updates.at(-1).effectiveListeningMode, 'highlight')
  assert.deepEqual([...updates.at(-1).selectedInstrumentIds], familyInstrumentIds('woodwinds'))

  nav.enterInstrument('flute')
  assert.deepEqual(highlightedInstrumentIds(navigation.getState().navigation), ['flute'])
  assert.ok(Math.abs(orchestraAverageIntensity([0, 0.2, 0.4]) - 0.3) < 1e-9)
  assert.equal(orchestraAverageIntensity([0, 0, 0]), 0)

  nav.goBack()
  assert.deepEqual(navigation.getState().navigation, { level: 'family', familyId: 'woodwinds' })
  nav.goBack()
  assert.deepEqual(navigation.getState().navigation, { level: 'orchestra' })
  assert.equal(updates.at(-1).effectiveListeningMode, 'normal')

  nav.enterFamily('other')
  assert.deepEqual(familyInstrumentIds('other'), ['celesta', 'harp'])
  assert.deepEqual([...updates.at(-1).selectedInstrumentIds], ['celesta', 'harp'])

  // Locking full orchestra overrides whatever is currently highlighted —
  // navigation itself is untouched (still exploring 'other'), only what
  // gets fed to the listening engine changes.
  assert.equal(useListeningLockStore.getState().lockFullOrchestra, false, 'starts unlocked')
  useListeningLockStore.getState().setLockFullOrchestra(true)
  assert.equal(updates.at(-1).effectiveListeningMode, 'normal', 'locking mutes the highlight regardless of navigation')
  assert.deepEqual(updates.at(-1).selectedInstrumentIds, [])
  assert.deepEqual(navigation.getState().navigation, { level: 'family', familyId: 'other' }, 'navigation is unaffected by the lock — only audio is')
  useListeningLockStore.getState().toggleLockFullOrchestra()
  assert.equal(useListeningLockStore.getState().lockFullOrchestra, false, 'toggle unlocks again')
  assert.deepEqual([...updates.at(-1).selectedInstrumentIds], ['celesta', 'harp'], 'unlocking restores the navigation-derived selection')

  const location = navigation.getState().navigation
  nav.enterInstrument('not-an-instrument')
  assert.deepEqual(navigation.getState().navigation, location)
  const count = updates.length
  disconnect()
  nav.enterFamily('strings')
  assert.equal(updates.length, count)
  assert.deepEqual(audioSelection({ level: 'instrument', familyId: 'strings', instrumentId: 'cello' }).selectedInstrumentIds, ['cello'])

  await verifyEntityLayout(server)
  await verifyIdleAnimation(server)
  await verifyNavigationMotion(server, () => audioSelection(navigation.getState().navigation))
  await verifyPlayback(server)
  await verifyNavigationPath(server)
  await verifyGhostIdle(server)
  await verifyInstrumentActivity(server)
  await verifyActivityProfile(server)
  await verifyOfflineActivity(server)
  verifyOpusEncode()
  verifyOpusChunks()
  await verifyChunkPlayback(server)
  await verifyPlaybackPlan(server)
  console.log('Passed zoom-derived mix, family and instrument highlight, Other membership, invalid IDs, and subscription cleanup.')
} finally {
  await server.close()
}
