import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

export async function verifyPlaybackPlan(server) {
  const { currentExcerpt, fullOrchestraUrl, leafStemId } = await server.ssrLoadModule('/src/features/listening/excerpt.ts')
  const {
    audioSelection, backgroundGainFor, dynamicFocusGain, focusDepth, listeningMix,
    selectedFocusIntensity, relativeInstrumentBoostDb, linearGainFromDb,
  } = await server.ssrLoadModule('/src/features/listening/audio-selection.ts')
  const { leafStemIdsForInstruments, playbackPlan } = await server.ssrLoadModule('/src/features/listening/playback-plan.ts')
  const {
    arrivingStemIds, departingStemIds, HANDOFF_SECONDS, keepPriorFocusOnFailure,
    sameStemIds, START_LEAD, transitionKind,
  } = await server.ssrLoadModule('/src/features/listening/playback-transition.ts')
  const { parseChunkManifest } = await server.ssrLoadModule('/src/features/listening/chunk-playback/index.ts')

  const disk = JSON.parse(await readFile(new URL('../public/audio/beethoven-7th-2nd/chunks/manifest.json', import.meta.url), 'utf8'))
  const manifest = parseChunkManifest(disk)

  assert.equal(fullOrchestraUrl(currentExcerpt), '/audio/beethoven-7th-2nd/opus/full-orchestra.opus')
  assert.equal(leafStemId('flute-1.wav'), 'flute-1')
  assert.ok(START_LEAD > 0 && START_LEAD < 0.2)
  assert.ok(HANDOFF_SECONDS >= 0.03 && HANDOFF_SECONDS <= 0.08)

  const orchestraSel = audioSelection({ level: 'orchestra' })
  const woodwindSel = audioSelection({ level: 'family', familyId: 'woodwinds' })
  const fluteSel = audioSelection({ level: 'instrument', familyId: 'woodwinds', instrumentId: 'flute' })
  const stringSel = audioSelection({ level: 'family', familyId: 'strings' })
  const celloSel = audioSelection({ level: 'instrument', familyId: 'strings', instrumentId: 'cello' })
  const brassSel = audioSelection({ level: 'family', familyId: 'brass' })

  const orchestra = playbackPlan(orchestraSel, currentExcerpt, manifest.stems)
  assert.deepEqual(orchestra, { mode: 'orchestra', stemIds: [] })
  assert.equal(focusDepth(orchestraSel), 'orchestra')
  assert.equal(backgroundGainFor(orchestraSel), 1)
  assert.equal(backgroundGainFor(woodwindSel, undefined, false), 1, 'do not duck until focus is ready')
  assert.equal(backgroundGainFor(fluteSel, undefined, false), 1)

  const woodwinds = playbackPlan(woodwindSel, currentExcerpt, manifest.stems)
  assert.equal(woodwinds.mode, 'focus')
  assert.deepEqual(woodwinds.stemIds, ['flute-1', 'flute-2', 'oboe-1', 'oboe-2', 'clarinet-1', 'clarinet-2', 'bassoon-1', 'bassoon-2'])
  assert.equal(focusDepth(woodwindSel), 'family')
  assert.equal(backgroundGainFor(woodwindSel), listeningMix.familyBackgroundGain)

  const flute = playbackPlan(fluteSel, currentExcerpt, manifest.stems)
  assert.deepEqual(flute.stemIds, ['flute-1', 'flute-2'])
  assert.equal(focusDepth(fluteSel), 'instrument')
  assert.equal(backgroundGainFor(fluteSel), listeningMix.instrumentBackgroundGain)

  const strings = playbackPlan(stringSel, currentExcerpt, manifest.stems)
  assert.deepEqual(strings.stemIds, ['violin-1', 'violin-2', 'viola', 'cello-1', 'cello-2', 'contrabass'])

  const cello = playbackPlan(celloSel, currentExcerpt, manifest.stems)
  assert.deepEqual(cello.stemIds, ['cello-1', 'cello-2'])

  const brass = playbackPlan(brassSel, currentExcerpt, manifest.stems)
  assert.deepEqual(brass.stemIds, ['horn-1', 'horn-2', 'trumpet-1', 'trumpet-2'])

  const other = playbackPlan(audioSelection({ level: 'family', familyId: 'other' }), currentExcerpt, manifest.stems)
  assert.deepEqual(other, { mode: 'orchestra', stemIds: [] })
  assert.equal(backgroundGainFor(audioSelection({ level: 'family', familyId: 'other' }), undefined, other.mode === 'focus'), 1)

  const unavailable = playbackPlan(woodwindSel, currentExcerpt, [])
  assert.deepEqual(unavailable, { mode: 'orchestra', stemIds: [] })

  assert.deepEqual(leafStemIdsForInstruments(currentExcerpt, ['flute', 'oboe']), ['flute-1', 'flute-2', 'oboe-1', 'oboe-2'])
  assert.equal(sameStemIds(flute.stemIds, ['flute-1', 'flute-2']), true)
  assert.equal(sameStemIds(flute.stemIds, woodwinds.stemIds), false)
  assert.deepEqual(departingStemIds(woodwinds.stemIds, flute.stemIds), ['oboe-1', 'oboe-2', 'clarinet-1', 'clarinet-2', 'bassoon-1', 'bassoon-2'])
  assert.deepEqual(arrivingStemIds(flute.stemIds, woodwinds.stemIds), ['oboe-1', 'oboe-2', 'clarinet-1', 'clarinet-2', 'bassoon-1', 'bassoon-2'])
  assert.equal(transitionKind(orchestra, woodwinds), 'orchestra-to-focus')
  assert.equal(transitionKind(woodwinds, orchestra), 'focus-to-orchestra')
  assert.equal(transitionKind(woodwinds, flute), 'focus-to-focus')
  assert.equal(transitionKind(flute, woodwinds), 'focus-to-focus')
  assert.equal(transitionKind(woodwinds, strings), 'focus-to-focus')
  assert.equal(transitionKind(orchestra, orchestra), 'none')
  assert.equal(transitionKind(flute, flute), 'none')
  assert.equal(keepPriorFocusOnFailure('orchestra', 'focus'), 'orchestra')
  assert.equal(keepPriorFocusOnFailure(true, false), true)

  assert.equal(selectedFocusIntensity([0, 0, 0]), 0)
  assert.equal(selectedFocusIntensity([0.4]), 0.4)
  assert.ok(Math.abs(selectedFocusIntensity([0, 0.2, 0.4]) - 0.3) < 1e-9)
  assert.ok(Math.abs(selectedFocusIntensity([0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2]) - 0.2) < 1e-9, 'family size does not raise intensity')

  assert.equal(relativeInstrumentBoostDb(0, 0.3), 0)
  assert.equal(dynamicFocusGain(0, 0.3), 0, 'rests add no focus layer')
  assert.equal(relativeInstrumentBoostDb(0.4, 0.3), 0)
  assert.equal(dynamicFocusGain(0.4, 0.3), listeningMix.minActiveFocusGain, 'already-loud material gets only the active floor')
  const quiet = dynamicFocusGain(0.15, 0.3)
  const quieter = dynamicFocusGain(0.075, 0.3)
  assert.ok(quiet > listeningMix.minActiveFocusGain)
  assert.ok(quieter > quiet)
  const boost = relativeInstrumentBoostDb(0.15, 0.3)
  assert.ok(Math.abs(quiet - Math.max(linearGainFromDb(boost) - 1, listeningMix.minActiveFocusGain)) < 1e-9)
  assert.ok(dynamicFocusGain(1, 0.3) <= listeningMix.minActiveFocusGain + 1e-9, 'fortissimo does not take the boost curve')

  console.log('Passed focus plan, background gains, intensity-aware focus gain, and failure fallback.')
}
