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
  const { identityAnchorEdges, identityLayoutVariables, identityFigures, familyLayout, instrumentLayout } = await server.ssrLoadModule('/src/features/orchestra-map/identity-layout.ts')
  for (const vertical of ['top', 'bottom']) for (const horizontal of ['left', 'center', 'right']) {
    assert.deepEqual(identityAnchorEdges(`${vertical}-${horizontal}`), { x: horizontal, y: vertical })
  }
  const violinVars = identityLayoutVariables({ level: 'instrument', familyId: 'strings', instrumentId: 'violin' })
  assert.equal(violinVars['--identity-landscape-anchor-x'], '50%')
  assert.equal(violinVars['--identity-landscape-figure-width'], 'clamp(240px, 12vw, 400px)')
  assert.equal(violinVars['--identity-landscape-figure-rotation'], '-12deg')
  assert.equal(violinVars['--identity-landscape-figure-opacity'], '0.3')
  assert.equal(violinVars['--identity-portrait-figure-width'], 'clamp(300px, 70vw, 520px)')
  assert.equal(violinVars['--identity-portrait-figure-x'], '-14%')
  assert.match(violinVars['--identity-landscape-figure-mask'], /ellipse 58% 75% at 33% 35%/)
  assert.match(violinVars['--identity-portrait-figure-mask'], /ellipse 58% 42% at 28% 55%/)
  assert.notEqual(violinVars['--identity-landscape-figure-mask'], violinVars['--identity-portrait-figure-mask'])
  const violinFigures = identityFigures({ level: 'instrument', familyId: 'strings', instrumentId: 'violin' })
  assert.equal(violinFigures.landscape.src, '/images/instruments/violin.webp')
  assert.equal(violinFigures.portrait.src, '/images/instruments/violin.webp')
  assert.notEqual(violinFigures.landscape.rotation, violinFigures.portrait.rotation)
  const hornVars = identityLayoutVariables({ level: 'instrument', familyId: 'brass', instrumentId: 'horn' })
  assert.equal(hornVars['--identity-landscape-figure-width'], 'clamp(300px, 98vw, 1120px)')
  assert.equal(hornVars['--identity-landscape-figure-rotation'], '-25deg')
  assert.match(hornVars['--identity-landscape-figure-mask'], /ellipse 58% 58% at 33% 43%/)
  assert.equal(hornVars['--identity-portrait-figure-width'], 'clamp(300px, 124vw, 820px)')
  assert.equal(hornVars['--identity-portrait-figure-opacity'], '0.4')
  const hornFigures = identityFigures({ level: 'instrument', familyId: 'brass', instrumentId: 'horn' })
  assert.equal(hornFigures.landscape.src, '/images/instruments/horn.webp')
  assert.equal(hornFigures.portrait.src, '/images/instruments/horn.webp')
  assert.notEqual(hornFigures.landscape.mask, hornFigures.portrait.mask)
  const stringsVars = identityLayoutVariables({ level: 'family', familyId: 'strings' })
  assert.equal(stringsVars['--identity-landscape-figure-width'], 'clamp(160px, 14vw, 980px)')
  assert.equal(stringsVars['--identity-landscape-figure-rotation'], '-6deg')
  assert.equal(stringsVars['--identity-portrait-figure-width'], 'clamp(180px, 42vw, 640px)')
  assert.match(stringsVars['--identity-landscape-figure-mask'], /ellipse 54% 66% at 46% 38%/)
  assert.match(stringsVars['--identity-portrait-figure-mask'], /ellipse 58% 66% at 48% 42%/)
  const stringsFigures = identityFigures({ level: 'family', familyId: 'strings' })
  assert.equal(stringsFigures.landscape.src, '/images/instruments/strings.webp')
  assert.equal(stringsFigures.portrait.src, '/images/instruments/strings.webp')
  assert.notEqual(stringsFigures.landscape.mask, stringsFigures.portrait.mask)
  for (const [instrumentId, src, landscapeWidth] of [
    ['viola', '/images/instruments/viola.webp', 'clamp(160px, 22vw, 420px)'],
    ['cello', '/images/instruments/cello.webp', 'clamp(250px, 26vw, 800px)'],
    ['doubleBass', '/images/instruments/contrabass.webp', 'clamp(580px, 50vw, 1160px)'],
  ]) {
    const figures = identityFigures({ level: 'instrument', familyId: 'strings', instrumentId })
    const variables = identityLayoutVariables({ level: 'instrument', familyId: 'strings', instrumentId })
    assert.equal(figures.landscape.src, src)
    assert.equal(figures.portrait.src, src)
    assert.notEqual(figures.landscape.mask, figures.portrait.mask)
    assert.equal(variables['--identity-landscape-figure-width'], landscapeWidth)
  }
  assert.deepEqual(identityFigures({ level: 'family', familyId: 'woodwinds' }), {})
  assert.deepEqual(identityFigures({ level: 'instrument', familyId: 'strings', instrumentId: 'violin1' }), {})
  assert.deepEqual(identityFigures({ level: 'orchestra' }), {})
  assert.deepEqual(familyLayout({ landscape: { anchor: 'bottom-right', left: '2%' } }).landscape,
    { top: '-30%', left: '2%', fontSize: 'clamp(54px, 6vw, min(180px, 29vh))', anchor: 'bottom-right' })
  assert.equal(familyLayout({ portrait: { top: 'clamp(-40%, -8vmin, -10%)' } }).portrait.top,
    'clamp(-40%, -8vmin, -10%)')
  assert.equal(instrumentLayout({ portrait: { fontSize: '90px' } }).landscape.fontSize,
    'clamp(76px, 15vmin, 100px)')


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
