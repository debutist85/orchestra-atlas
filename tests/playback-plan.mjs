import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

export async function verifyPlaybackPlan(server) {
  const { currentExcerpt, fullOrchestraStemId, leafStemId } = await server.ssrLoadModule('/src/features/listening/excerpt.ts')
  const {
    audioSelection, backgroundGainFor, ensembleIntensity, focusBoostGain, focusDepth, listeningMix,
    selectedFocusIntensity, linearGainFromDb, soloIntensityGain,
  } = await server.ssrLoadModule('/src/features/listening/audio-selection.ts')
  const {
    familyStemId, instrumentStemId, missingFamilyStems, playbackPlan, speculativeStemIds,
  } = await server.ssrLoadModule('/src/features/listening/playback-plan.ts')
  const {
    arrivingStemIds, BACKGROUND_FADE_SECONDS, departingStemIds, HANDOFF_SECONDS,
    keepPriorFocusOnFailure, rampValue, restingRamp, sameStemIds, START_LEAD, transitionKind,
  } = await server.ssrLoadModule('/src/features/listening/playback-transition.ts')
  const { parseChunkManifest } = await server.ssrLoadModule('/src/features/listening/chunk-playback/assets.ts')

  const disk = JSON.parse(await readFile(new URL('../public/audio/beethoven-7th-2nd/stems/chunks/manifest.json', import.meta.url), 'utf8'))
  const manifest = parseChunkManifest(disk)

  assert.equal(fullOrchestraStemId(currentExcerpt), 'full_orchestra')
  assert.ok(manifest.stems.includes(fullOrchestraStemId(currentExcerpt)), 'the full mix is chunked')
  assert.equal(leafStemId('flute.wav'), 'flute')
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
  assert.deepEqual(woodwinds.stemIds, ['woodwinds'])
  assert.equal(focusDepth(woodwindSel), 'family')
  assert.equal(backgroundGainFor(woodwindSel), listeningMix.familyBackgroundGain)

  const flute = playbackPlan(fluteSel, currentExcerpt, manifest.stems)
  assert.deepEqual(flute.stemIds, ['flute'])
  assert.equal(focusDepth(fluteSel), 'instrument')
  assert.equal(backgroundGainFor(fluteSel), listeningMix.instrumentBackgroundGain)

  const strings = playbackPlan(stringSel, currentExcerpt, manifest.stems)
  assert.deepEqual(strings.stemIds, ['strings'])

  const cello = playbackPlan(celloSel, currentExcerpt, manifest.stems)
  assert.deepEqual(cello.stemIds, ['cello'])

  const brass = playbackPlan(brassSel, currentExcerpt, manifest.stems)
  assert.deepEqual(brass.stemIds, ['brass'])
  assert.deepEqual(speculativeStemIds(currentExcerpt, manifest.stems, []), ['strings', 'woodwinds', 'brass', 'timpani'])
  assert.deepEqual(speculativeStemIds(currentExcerpt, manifest.stems, woodwinds.stemIds), ['flute', 'oboe', 'clarinet', 'bassoon'])
  assert.deepEqual(speculativeStemIds(currentExcerpt, manifest.stems, flute.stemIds), ['woodwinds', 'oboe', 'clarinet', 'bassoon'])
  assert.deepEqual(speculativeStemIds(currentExcerpt, manifest.stems, ['timpani']), [])

  const other = playbackPlan(audioSelection({ level: 'family', familyId: 'other' }), currentExcerpt, manifest.stems)
  // A part with no stem in this recording is a permanent rest: stay in focus
  // with nothing to schedule, so the bed still ducks.
  assert.deepEqual(other, { mode: 'focus', stemIds: [] })
  assert.equal(
    backgroundGainFor(audioSelection({ level: 'family', familyId: 'other' }), undefined, other.mode === 'focus'),
    listeningMix.familyBackgroundGain,
  )

  const unavailable = playbackPlan(woodwindSel, currentExcerpt, [])
  assert.deepEqual(unavailable, { mode: 'focus', stemIds: [] })

  assert.equal(instrumentStemId(currentExcerpt, 'doubleBass'), 'contrabass')
  assert.equal(instrumentStemId(currentExcerpt, 'trombone'), undefined)
  assert.equal(familyStemId(currentExcerpt, 'percussion'), 'timpani')
  assert.equal(familyStemId(currentExcerpt, 'other'), undefined)
  assert.deepEqual(missingFamilyStems(currentExcerpt), [], 'every family with instruments has a premix')
  const withoutBrassMix = { ...currentExcerpt, familyStems: { ...currentExcerpt.familyStems, brass: undefined } }
  assert.deepEqual(missingFamilyStems(withoutBrassMix), ['brass'])
  assert.deepEqual(playbackPlan(brassSel, withoutBrassMix, manifest.stems), { mode: 'focus', stemIds: [] },
    'a family never falls back to summing its instrument stems')
  const unlisted = playbackPlan(celloSel, currentExcerpt, manifest.stems.filter(id => id !== 'cello'))
  assert.deepEqual(unlisted.stemIds, [], 'a stem missing from the manifest is not scheduled')
  assert.equal(sameStemIds(flute.stemIds, ['flute']), true)
  assert.equal(sameStemIds(flute.stemIds, woodwinds.stemIds), false)
  assert.deepEqual(departingStemIds(woodwinds.stemIds, flute.stemIds), ['woodwinds'])
  assert.deepEqual(arrivingStemIds(flute.stemIds, woodwinds.stemIds), ['woodwinds'])
  assert.equal(transitionKind(orchestra, woodwinds), 'orchestra-to-focus')
  assert.equal(transitionKind(woodwinds, orchestra), 'focus-to-orchestra')
  assert.equal(transitionKind(woodwinds, flute), 'focus-to-focus')
  assert.equal(transitionKind(flute, woodwinds), 'focus-to-focus')
  assert.equal(transitionKind(woodwinds, strings), 'focus-to-focus')
  assert.equal(transitionKind(orchestra, orchestra), 'none')
  assert.equal(transitionKind(flute, flute), 'none')
  assert.equal(keepPriorFocusOnFailure('orchestra', 'focus'), 'orchestra')
  assert.equal(keepPriorFocusOnFailure(true, false), true)

  const ramp = { from: 0, to: 1, start: 10, duration: 0.6 }
  assert.equal(rampValue(ramp, 9), 0)
  assert.ok(Math.abs(rampValue(ramp, 10.3) - 0.5) < 1e-9)
  assert.equal(rampValue(ramp, 11), 1)
  assert.equal(rampValue(restingRamp(1), 5), 1)

  // Zooming in during a soft passage: the full mix is boosted ~12 dB in
  // orchestra view. The audible orchestra level is the scope fade times the
  // boost, which now hands over along the same ramp. It must fall
  // monotonically to the duck, with no early ~12 dB dip.
  const softBoost = linearGainFromDb(12)
  const duck = listeningMix.familyBackgroundGain
  const levelAt = t => {
    const amount = rampValue({ from: 0, to: 1, start: 0, duration: BACKGROUND_FADE_SECONDS }, t)
    const scope = 1 + (duck - 1) * amount
    return scope * (softBoost + (1 - softBoost) * amount)
  }
  let previous = levelAt(0)
  assert.ok(Math.abs(previous - softBoost) < 1e-9, 'starts at the boosted orchestra level')
  for (let t = 0.01; t <= BACKGROUND_FADE_SECONDS + 1e-9; t += 0.01) {
    const level = levelAt(t)
    assert.ok(level <= previous + 1e-12, `orchestra level never rises while ducking (t=${t.toFixed(2)})`)
    assert.ok(20 * Math.log10(previous / level) < 3, `no step above 3 dB per 10 ms (t=${t.toFixed(2)})`)
    previous = level
  }
  assert.ok(Math.abs(previous - duck) < 1e-9, 'lands exactly on the duck')


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

  // focusBoostGain: a quiet part under a louder ensemble (the common,
  // most-valuable case for zooming in) should land strictly between the
  // orchestra layer's boost (ensemble-only) and the old fully-own-intensity
  // boost, not collapse to either endpoint — that would mean the blend
  // weight is doing nothing (see its comment in audio-selection.ts for why
  // a naive min/max of the two intensities can't produce a real blend).
  const selected = 0.1, ensemble = 0.6
  const ownOnly = soloIntensityGain(selected)
  const ensembleOnly = soloIntensityGain(ensemble)
  assert.ok(ownOnly > ensembleOnly, 'sanity check: the quieter reference yields the bigger boost')
  const blended = focusBoostGain(selected, ensemble, { soloEnsembleBlend: 0.5 })
  assert.ok(blended > ensembleOnly && blended < ownOnly, 'a 0.5 blend lands strictly between the two boosts')
  assert.ok(Math.abs(focusBoostGain(selected, ensemble, { soloEnsembleBlend: 0 }) - ensembleOnly) < 1e-9, 'blend 0 matches the orchestra layer exactly')
  assert.ok(Math.abs(focusBoostGain(selected, ensemble, { soloEnsembleBlend: 1 }) - ownOnly) < 1e-9, 'blend 1 matches the original own-intensity boost exactly')
  assert.equal(focusBoostGain(0.3, 0.3, { soloEnsembleBlend: 0.5 }), soloIntensityGain(0.3), 'no ensemble/own mismatch means no blending effect either way')

  console.log('Passed focus plan, background gains, intensity-aware focus gain, and failure fallback.')
}
