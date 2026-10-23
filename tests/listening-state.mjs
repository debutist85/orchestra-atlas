import { verifyOrbitEnvelope } from './orbit-envelope.mjs'
import assert from 'node:assert/strict'
import { verifySpatialLayout } from './spatial-layout.mjs'
import { verifyCaptionFraming } from './caption-framing.mjs'
import { verifyCaptionPlacement } from './caption-placement.mjs'
import { verifyModelInspector } from './model-inspector.mjs'
import { verifyModelPreparation } from './model-preparation.mjs'
import { verifyInstrumentModelResource } from './instrument-model-resource.mjs'
import { createServer } from 'vite'
import { verifyEntityLayout } from './entity-layout.mjs'
import { verifyIdleAnimation } from './idle-animation.mjs'
import { verifyLoadingWave } from './loading-wave.mjs'
import { verifyIdleOrbit } from './idle-orbit.mjs'
import { verifyInstrumentPerformance } from './instrument-performance.mjs'
import { verifyNavigationMotion } from './navigation-motion.mjs'
import { verifyGhostIdle } from './ghost-idle.mjs'
import { verifyNavigationPath } from './navigation-path.mjs'
import { verifyNavigationRoute } from './navigation-route.mjs'
import { verifyPlayback } from './playback.mjs'
import { verifyInstrumentActivity } from './instrument-activity.mjs'
import { verifyActivityProfile } from './activity-profile.mjs'
import { verifyAudioHighlight } from './audio-highlight.mjs'
import { verifyOfflineActivity } from './offline-activity.mjs'
import { verifyOpusEncode } from './opus-encode.mjs'
import { verifyOpusChunks } from './opus-chunks.mjs'
import { verifyChunkPlayback } from './chunk-playback.mjs'
import { verifyPlaybackPlan } from './playback-plan.mjs'
import { verifyExperienceMode } from './experience-mode.mjs'
import { verifyInstrumentAnatomy } from './instrument-anatomy.mjs'
import { verifyNodeAudio } from './node-audio.mjs'
import { verifyRadialActions } from './radial-actions-layout.mjs'
import { verifyTechnique } from './technique.mjs'
import { verifyAnatomyStore } from './anatomy-store.mjs'
import { verifyDemoPlaybackCoordination } from './demo-playback-coordination.mjs'
import { verifyHotspots } from './hotspots.mjs'
import { verifyCanvasGestures } from './canvas-gestures.mjs'
import { verifyExplorerLayout } from './explorer-layout.mjs'
import { verifyModelAttribution } from './model-attribution.mjs'
import { verifyNodeIntensity } from './node-intensity.mjs'
import { verifySpatialTypography } from './spatial-typography.mjs'
import { verifyLabelTravel } from './label-travel.mjs'
import { verifyInstrumentDescription } from './instrument-description.mjs'
import { verifyModelExtent } from './model-extent.mjs'

// Assertions use local public/ paths. Vite gives existing process.env values
// priority over .env files, so this keeps a configured CDN base out of them.
process.env.VITE_MEDIA_URL = ''
// SSR-only checks must not replace the browser dev server's optimized modules.
const server = await createServer({
  mode: 'test',
  define: { 'import.meta.env.VITE_INSTRUMENT_PACK_URL': '""' },
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})
try {
  await verifyOrbitEnvelope(server)
  await verifySpatialLayout(server)
  await verifyCaptionFraming(server)
  await verifyCaptionPlacement(server)
  const { useNavigationStore: navigation } = await server.ssrLoadModule('/src/store/navigation-store.ts')
  const { identityCaptionPlacement, identityLayoutVariables, identityFigures, familyLayout, instrumentLayout } = await server.ssrLoadModule('/src/features/orchestra-map/identity-layout.ts')
  const violin = { level: 'instrument', familyId: 'strings', instrumentId: 'violin' }
  assert.deepEqual(identityCaptionPlacement(violin, 'landscape'), { edge: 'left', align: 'start', gap: 1, side: 'outside' })
  const violinVars = identityLayoutVariables(violin)
  assert.equal(violinVars['--identity-landscape-figure-width'], 'clamp(230px, 18vw, 450px)')
  assert.equal(violinVars['--identity-landscape-figure-height'], 'auto')
  assert.equal(violinVars['--identity-portrait-figure-height'], 'auto')
  assert.equal(violinVars['--identity-landscape-figure-rotation'], '-12deg')
  assert.equal(violinVars['--identity-landscape-figure-opacity'], '0.3')
  assert.equal(violinVars['--identity-portrait-figure-width'], 'clamp(200px, 68vw, 520px)')
  assert.equal(violinVars['--identity-portrait-figure-x'], '-30%')
  assert.match(violinVars['--identity-landscape-figure-mask'], /ellipse 58% 100% at 28% 35%/)
  assert.match(violinVars['--identity-portrait-figure-mask'], /ellipse 58% 88% at 28% 45%/)
  assert.notEqual(violinVars['--identity-landscape-figure-mask'], violinVars['--identity-portrait-figure-mask'])
  const violinFigures = identityFigures({ level: 'instrument', familyId: 'strings', instrumentId: 'violin' })
  assert.equal(violinFigures.landscape.src, '/images/instruments/violin.webp')
  assert.equal(violinFigures.portrait.src, '/images/instruments/violin.webp')
  assert.equal(violinFigures.landscape.height, 'auto')
  assert.equal(violinFigures.portrait.height, 'auto')
  assert.equal(violinFigures.landscape.rotation, '-12deg')
  assert.equal(violinFigures.portrait.rotation, '-12deg')
  const hornVars = identityLayoutVariables({ level: 'instrument', familyId: 'brass', instrumentId: 'horn' })
  assert.equal(hornVars['--identity-landscape-figure-width'], 'clamp(300px, 66vw, 1500px)')
  assert.equal(hornVars['--identity-landscape-figure-rotation'], '-25deg')
  assert.match(hornVars['--identity-landscape-figure-mask'], /ellipse 58% 58% at 33% 43%/)
  assert.equal(hornVars['--identity-portrait-figure-width'], 'clamp(300px, 160vw, 820px)')
  assert.equal(hornVars['--identity-portrait-figure-opacity'], '0.3')
  const hornFigures = identityFigures({ level: 'instrument', familyId: 'brass', instrumentId: 'horn' })
  assert.equal(hornFigures.landscape.src, '/images/instruments/horn.webp')
  assert.equal(hornFigures.portrait.src, '/images/instruments/horn.webp')
  assert.notEqual(hornFigures.landscape.mask, hornFigures.portrait.mask)
  const stringsVars = identityLayoutVariables({ level: 'family', familyId: 'strings' })
  assert.equal(stringsVars['--identity-landscape-figure-width'], 'clamp(160px, 26vw, 800px)')
  assert.equal(stringsVars['--identity-landscape-figure-rotation'], '-6deg')
  assert.equal(stringsVars['--identity-portrait-figure-width'], 'clamp(180px, 42vw, 640px)')
  assert.match(stringsVars['--identity-landscape-figure-mask'], /ellipse 54% 66% at 46% 38%/)
  assert.match(stringsVars['--identity-portrait-figure-mask'], /ellipse 58% 66% at 48% 42%/)
  const stringsFigures = identityFigures({ level: 'family', familyId: 'strings' })
  assert.equal(stringsFigures.landscape.src, '/images/instruments/strings.webp')
  assert.equal(stringsFigures.portrait.src, '/images/instruments/strings.webp')
  assert.notEqual(stringsFigures.landscape.mask, stringsFigures.portrait.mask)
  for (const [familyId, src] of [
    ['woodwinds', '/images/instruments/woodwinds.webp'],
    ['brass', '/images/instruments/brass.webp'],
    ['percussion', '/images/instruments/percussions.webp'],
  ]) {
    const figures = identityFigures({ level: 'family', familyId })
    const variables = identityLayoutVariables({ level: 'family', familyId })
    assert.equal(figures.landscape.src, src)
    assert.equal(figures.portrait.src, src)
    assert.notEqual(figures.landscape.mask, figures.portrait.mask)
    assert.match(variables['--identity-landscape-figure-width'], /^clamp\(/)
    assert.match(variables['--identity-portrait-figure-width'], /^clamp\(/)
  }
  for (const [instrumentId, src, landscapeWidth] of [
    ['viola', '/images/instruments/viola.webp', 'clamp(400px, 22vw, 520px)'],
    ['cello', '/images/instruments/cello.webp', 'clamp(550px, 34vw, 1200px)'],
    ['doubleBass', '/images/instruments/contrabass.webp', 'clamp(1200px, 50vw, 1400px)'],
  ]) {
    const figures = identityFigures({ level: 'instrument', familyId: 'strings', instrumentId })
    const variables = identityLayoutVariables({ level: 'instrument', familyId: 'strings', instrumentId })
    assert.equal(figures.landscape.src, src)
    assert.equal(figures.portrait.src, src)
    assert.notEqual(figures.landscape.mask, figures.portrait.mask)
    assert.equal(variables['--identity-landscape-figure-width'], landscapeWidth)
  }
  for (const [instrumentId, familyId, src] of [
    ['flute', 'woodwinds', '/images/instruments/flute.webp'],
    ['oboe', 'woodwinds', '/images/instruments/oboe.webp'],
    ['clarinet', 'woodwinds', '/images/instruments/clarinet.webp'],
    ['bassoon', 'woodwinds', '/images/instruments/bassoon.webp'],
    ['trumpet', 'brass', '/images/instruments/trumpet.webp'],
    ['trombone', 'brass', '/images/instruments/trombone.webp'],
    ['tuba', 'brass', '/images/instruments/tuba.webp'],
    ['timpani', 'percussion', '/images/instruments/timpani.webp'],
    ['pitchedPercussion', 'percussion', '/images/instruments/marimba.webp'],
    ['unpitchedPercussion', 'percussion', '/images/instruments/bass-drum.webp'],
    ['harp', 'other', '/images/instruments/harp.webp'],
    ['celesta', 'other', '/images/instruments/celesta.webp'],
  ]) {
    const figures = identityFigures({ level: 'instrument', familyId, instrumentId })
    assert.equal(figures.landscape.src, src)
    assert.equal(figures.portrait.src, src)
    assert.match(figures.landscape.width, /^clamp\(/)
    assert.equal(figures.landscape.height, 'auto')
    assert.match(figures.portrait.width, /^clamp\(/)
    assert.equal(figures.portrait.height, 'auto')
  }
  assert.deepEqual(identityFigures({ level: 'instrument', familyId: 'strings', instrumentId: 'violin1' }), {})
  assert.deepEqual(identityFigures({ level: 'orchestra' }), {})
  assert.equal(familyLayout({ landscape: { edge: 'bottom', align: 'end', gap: 2 } }).landscape.edge, 'bottom')
  assert.equal('top' in familyLayout().portrait, false)
  assert.equal('left' in instrumentLayout().landscape, false)
  assert.equal(instrumentLayout({ portrait: { fontSize: '90px' } }).landscape.fontSize,
    'clamp(76px, 15vmin, 100px)')


  const { familyInstrumentIds, highlightedInstrumentIds } = await server.ssrLoadModule('/src/store/catalog.ts')
  const { connectListeningEngine, audioSelection, linearGainFromDb, orchestraAverageIntensity } = await server.ssrLoadModule('/src/features/listening/audio-selection.ts')
  const { useListeningLockStore } = await server.ssrLoadModule('/src/store/listening-lock-store.ts')
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
  await verifyLoadingWave(server)
  await verifyIdleOrbit(server)
  await verifyInstrumentPerformance(server)
  await verifyNavigationMotion(server, () => audioSelection(navigation.getState().navigation))
  await verifyPlayback(server)
  await verifyNavigationPath(server)
  await verifyNavigationRoute(server)
  await verifyGhostIdle(server)
  await verifyInstrumentActivity(server)
  await verifyActivityProfile(server)
  await verifyAudioHighlight(server)
  await verifyOfflineActivity(server)
  await verifyModelInspector(server)
  await verifyModelPreparation(server)
  await verifyInstrumentModelResource(server)
  await verifyExperienceMode(server)
  await verifyInstrumentAnatomy(server)
  await verifyTechnique(server)
  await verifyRadialActions(server)
  await verifyNodeAudio(server)
  await verifyAnatomyStore(server)
  await verifyDemoPlaybackCoordination(server)
  await verifyHotspots(server)
  await verifyCanvasGestures(server)
  await verifyExplorerLayout(server)
  await verifyModelAttribution(server)
  await verifyNodeIntensity(server)
  await verifySpatialTypography(server)
  await verifyInstrumentDescription(server)
  await verifyLabelTravel(server)
  await verifyModelExtent(server)
  verifyOpusEncode()
  verifyOpusChunks()
  await verifyChunkPlayback(server)
  await verifyPlaybackPlan(server)
  console.log('Passed zoom-derived mix, family and instrument highlight, Other membership, invalid IDs, and subscription cleanup.')
} finally {
  await server.close()
}
