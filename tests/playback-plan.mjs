import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

export async function verifyPlaybackPlan(server) {
  const { currentExcerpt, fullOrchestraUrl, leafStemId } = await server.ssrLoadModule('/src/features/listening/excerpt.ts')
  const {
    audioSelection, backgroundGainFor, ensembleIntensity, focusDepth, listeningMix,
    selectedFocusIntensity, linearGainFromDb, soloIntensityGain,
  } = await server.ssrLoadModule('/src/features/listening/audio-selection.ts')
  const { leafStemIdsForInstruments, playbackPlan } = await server.ssrLoadModule('/src/features/listening/playback-plan.ts')
  const {
    arrivingStemIds, BACKGROUND_FADE_SECONDS, departingStemIds, HANDOFF_SECONDS, keepPriorFocusOnFailure,
    sameStemIds, START_LEAD, transitionKind,
  } = await server.ssrLoadModule('/src/features/listening/playback-transition.ts')
  const { parseChunkManifest } = await server.ssrLoadModule('/src/features/listening/chunk-playback/index.ts')

  const disk = JSON.parse(await readFile(new URL('../public/audio/beethoven-7th-2nd/chunks/manifest.json', import.meta.url), 'utf8'))
  const manifest = parseChunkManifest(disk)

  assert.equal(fullOrchestraUrl(currentExcerpt), '/audio/beethoven-7th-2nd/opus/full-orchestra.opus')
  assert.equal(leafStemId('flute-1.wav'), 'flute-1')
  assert.ok(START_LEAD > 0 && START_LEAD < 0.2)
  assert.ok(HANDOFF_SECONDS >= 0.03 && HANDOFF_SECONDS <= 0.08)
  assert.ok(BACKGROUND_FADE_SECONDS > HANDOFF_SECONDS, 'the background duck reads as a musical fade, not a stem-swap click-guard')

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

  // soloIntensityGain never takes a second (ensemble) value — it can only
  // react to the highlighted part's own intensity, so there is nothing else
  // for it to jump against (see its comment in audio-selection.ts for why
  // an earlier, ensemble-relative version of this boost was erratic).
  assert.equal(soloIntensityGain(0), 1, 'rest plays at unity, not silence, so the next onset is not fighting a collapsed gain')
  assert.equal(soloIntensityGain(1), 1, 'the instrument at its own loudest gets no boost')
  const soloQuiet = soloIntensityGain(0.3)
  const soloQuieter = soloIntensityGain(0.1)
  assert.ok(soloQuiet > 1, 'a quiet passage is boosted above unity')
  assert.ok(soloQuieter > soloQuiet, 'the quieter the part, the larger the boost')
  assert.ok(Math.abs(soloIntensityGain(1e-6) - linearGainFromDb(listeningMix.maxInstrumentBoostDb)) < 1e-3, 'a nearly-buried note approaches the ceiling')

  // ensembleIntensity: the loudest current part, not an average of only the
  // "sounding" ones — unlike orchestraAverageIntensity, dropping a value to
  // 0 (an instrument going to rest) never changes what the max already was
  // driven by, so there is no membership-change jump to feed into
  // soloIntensityGain for the full-orchestra layer.
  assert.equal(ensembleIntensity([]), 0)
  assert.equal(ensembleIntensity([0, 0, 0]), 0)
  assert.equal(ensembleIntensity([0.1, 0.6, 0.3]), 0.6)
  const before = ensembleIntensity([0.6, 0.2, 0.05])
  const afterRest = ensembleIntensity([0.6, 0, 0.05])
  assert.equal(before, afterRest, 'the loudest part resting elsewhere does not move the ensemble reading')

  console.log('Passed focus plan, background gains, intensity-aware focus gain, and failure fallback.')
}
