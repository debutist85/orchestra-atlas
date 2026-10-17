import assert from 'node:assert/strict'

export async function verifyTechnique(server) {
  const { techniqueById, partActions, partAction, demonstrationsFor, instrumentPartActions, discoverActionId } = await server.ssrLoadModule('/src/features/instrument-explorer/technique.ts')

  // Every part starts with Discover, followed by its configured techniques
  // in order, each with its media.
  const actionsOf = (instrument, part) => partActions(instrument, part).map(action => action.kind === 'technique' ? [action.id, [...action.media]] : action.id)
  assert.deepEqual(actionsOf('violin', 'Anchor_Bow'), [discoverActionId, ['col-legno', ['audio']], ['arco', ['video']]])
  assert.deepEqual(actionsOf('violin', 'Anchor_Bridge'), [discoverActionId, ['sul-ponticello', ['audio']], ['chords', ['audio']], ['pizzicato', ['video']]])
  assert.deepEqual(actionsOf('violin', 'Anchor_Fingerboard'), [discoverActionId, ['harmonics', ['audio']]])
  for (const part of ['Anchor_Chinrest', 'Anchor_FHole_Right', 'Anchor_Pegbox', 'Anchor_Scroll', 'Anchor_Tailpiece']) {
    assert.deepEqual(actionsOf('violin', part), [discoverActionId], `${part}: Discover only`)
  }
  assert.deepEqual(actionsOf('violin', 'Anchor_Unknown'), [discoverActionId], 'an unconfigured part still has Discover')
  assert.deepEqual(actionsOf('cello', 'Anchor_Bridge'), [discoverActionId], 'an unconfigured instrument still has Discover')
  assert.equal(partActions('violin', 'Anchor_Bow')[0].title, 'Discover')

  // Configuration is per instrument: the timpani stand-in does not inherit
  // the violin's techniques, and vice versa.
  assert.deepEqual(actionsOf('timpani', 'Anchor_Chinrest'), [discoverActionId, ['stroke', ['video']], ['tremolo', ['video']]])
  assert.deepEqual(actionsOf('timpani', 'Anchor_Bridge'), [discoverActionId])
  assert.deepEqual(actionsOf('violin', 'Anchor_Chinrest'), [discoverActionId])

  // Every configured technique exists in the catalog.
  for (const [instrument, parts] of Object.entries(instrumentPartActions)) {
    for (const [part, techniques] of Object.entries(parts)) {
      for (const id of Object.keys(techniques)) assert.ok(techniqueById(id), `${instrument} ${part}: ${id} is in the catalog`)
    }
  }
  // Unknown ids in a custom configuration are skipped, not fatal.
  assert.deepEqual(partActions('violin', 'Anchor_Bow', { violin: { Anchor_Bow: { 'not-a-technique': ['audio'], arco: ['video'] } } }).map(action => action.id), [discoverActionId, 'arco'])

  const sulPonticello = techniqueById('sul-ponticello')
  assert.equal(sulPonticello.title, 'Sul ponticello')
  // Bowing NEAR the bridge, not on it — the one factual distinction the
  // brief calls out explicitly; worth protecting with an assertion.
  assert.match(sulPonticello.description, /near|close to/i)
  assert.doesNotMatch(sulPonticello.description, /\bon the bridge\b/i)
  assert.equal(techniqueById('not-a-technique'), undefined)

  // Demonstrations: the configured media that have a file, in order.
  const arco = partAction('violin', 'Anchor_Bow', 'arco')
  assert.deepEqual(demonstrationsFor('violin', arco).map(demo => [demo.type, demo.title]), [['video', 'Arco']])
  assert.match(demonstrationsFor('violin', arco)[0].src, /videos\/instruments\/violin\/arco\.mp4$/)
  assert.deepEqual(demonstrationsFor('violin', partAction('violin', 'Anchor_Bridge', 'sul-ponticello')), [], 'configured audio without a file is not playable yet')
  assert.deepEqual(demonstrationsFor('violin', partAction('violin', 'Anchor_Bow', discoverActionId)), [], 'Discover has no demonstration')
  assert.deepEqual(demonstrationsFor('violin', undefined), [])
  assert.match(demonstrationsFor('timpani', partAction('timpani', 'Anchor_Chinrest', 'stroke'))[0].src, /timpanist_male_default\.mp4$/)
  assert.match(demonstrationsFor('timpani', partAction('timpani', 'Anchor_Chinrest', 'tremolo'))[0].src, /timpanist_male_tremolo\.mp4$/)
  assert.equal(partAction('violin', 'Anchor_Scroll', 'arco'), undefined, 'actions belong to their part')

  console.log('Passed part actions: Discover default, per-instrument technique/media configuration, catalog integrity, and playable demonstrations.')
}
