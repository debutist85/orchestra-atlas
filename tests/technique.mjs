import assert from 'node:assert/strict'

export async function verifyTechnique(server) {
  const { partActions, partAction, demonstrationsFor, instrumentPartActions, playablePartActions, radialPartActions, hasPartAudio } = await server.ssrLoadModule('/src/features/instrument-explorer/content/technique.ts')

  // Only configured techniques are returned, in order with their media.
  const actionsOf = (instrument, part) => partActions(instrument, part).map(action => action.kind === 'technique' ? [action.id, [...action.media]] : action.id)
  assert.deepEqual(actionsOf('violin', 'Anchor_Bow'), [['col-legno', ['audio']]])
  assert.deepEqual(actionsOf('violin', 'Anchor_Bridge'), [['sul-ponticello', ['audio']], ['chords', ['audio']]])
  assert.deepEqual(actionsOf('violin', 'Anchor_Fingerboard'), [['harmonics', ['audio']]])
  for (const part of ['Anchor_Chinrest', 'Anchor_FHole_Right', 'Anchor_Pegbox', 'Anchor_Scroll', 'Anchor_Tailpiece']) {
    assert.deepEqual(actionsOf('violin', part), [], `${part}: no technique actions`)
  }
  assert.deepEqual(actionsOf('violin', 'Anchor_Unknown'), [], 'an unconfigured part has no actions')
  assert.deepEqual(actionsOf('cello', 'Anchor_Bridge'), [], 'an unconfigured instrument has no actions')
  assert.equal(partAction('violin', 'Anchor_Bow', 'discover'), undefined)

  // Configuration is per instrument: the timpani stand-in (which shows the
  // violin model) does not inherit the violin's techniques.
  assert.deepEqual(actionsOf('timpani', 'Anchor_Chinrest'), [])
  assert.deepEqual(actionsOf('timpani', 'Anchor_Bridge'), [])
  assert.deepEqual(actionsOf('violin', 'Anchor_Chinrest'), [])

  // Techniques are listened to only: an instrument's one video is its
  // performance, so no configured technique has a video.
  for (const parts of Object.values(instrumentPartActions)) {
    for (const techniques of Object.values(parts)) {
      for (const media of Object.values(techniques)) assert.ok(!media.includes('video'), 'no technique video')
    }
  }

  // Every configured technique exists in the catalog (unknown ids would be
  // skipped, leaving fewer actions than configured).
  for (const [instrument, parts] of Object.entries(instrumentPartActions)) {
    for (const [part, techniques] of Object.entries(parts)) {
      const resolved = partActions(instrument, part).filter(action => action.kind === 'technique').map(action => action.id)
      assert.deepEqual(resolved, Object.keys(techniques), `${instrument} ${part}: every technique is in the catalog`)
    }
  }
  // Unknown ids in a custom configuration are skipped, not fatal.
  assert.deepEqual(partActions('violin', 'Anchor_Bow', { violin: { Anchor_Bow: { 'not-a-technique': ['audio'], arco: ['video'] } } }).map(action => action.id), ['arco'])

  const sulPonticello = partAction('violin', 'Anchor_Bridge', 'sul-ponticello').technique
  assert.equal(sulPonticello.title, 'Sul ponticello')
  // Bowing NEAR the bridge, not on it — the one factual distinction the
  // brief calls out explicitly; worth protecting with an assertion.
  assert.match(sulPonticello.description, /near|close to/i)
  assert.doesNotMatch(sulPonticello.description, /\bon the bridge\b/i)
  assert.equal(partAction('violin', 'Anchor_Bridge', 'not-a-technique'), undefined)

  // Demonstrations: the configured media that have a file, in order. The
  // video path is kept, exercised here through a custom configuration.
  const arco = partActions('violin', 'Anchor_Bow', { violin: { Anchor_Bow: { arco: ['video'] } } })[0]
  assert.deepEqual(demonstrationsFor('violin', arco).map(demo => [demo.type, demo.title]), [['video', 'Arco']])
  assert.match(demonstrationsFor('violin', arco)[0].src, /videos\/instruments\/violin\/arco\.mp4$/)
  assert.match(demonstrationsFor('violin', partAction('violin', 'Anchor_Bridge', 'sul-ponticello'))[0].src, /audio\/instruments\/violin\/chords\.ogg$/)
  assert.deepEqual(demonstrationsFor('violin', partAction('violin', 'Anchor_Bow', 'discover')), [], 'removed Discover has no demonstration')
  assert.deepEqual(demonstrationsFor('violin', undefined), [])
  assert.equal(partAction('violin', 'Anchor_Scroll', 'arco'), undefined, 'actions belong to their part')

  assert.deepEqual(playablePartActions('violin', 'Anchor_Bow').map(({ action, demonstration }) => [action.id, demonstration.type]), [['col-legno', 'audio']])
  assert.equal(playablePartActions('violin', 'Anchor_Bridge').length, 2, 'all configured media have placeholders')
  assert.equal(playablePartActions('timpani', 'Anchor_Chinrest').length, 0)
  for (const [instrument, parts] of Object.entries(instrumentPartActions)) {
    for (const part of Object.keys(parts)) {
      for (const { demonstration } of playablePartActions(instrument, part)) {
        assert.ok(demonstration.src.endsWith(demonstration.type === 'audio'
          ? 'audio/instruments/violin/chords.ogg' : 'videos/instruments/violin/arco.mp4'))
      }
    }
  }

  // Only parts with a technique to listen to get a hotspot.
  assert.deepEqual(['Anchor_Bow', 'Anchor_Bridge', 'Anchor_Fingerboard', 'Anchor_Scroll', 'Anchor_Chinrest'].filter(part => hasPartAudio('violin', part)),
    ['Anchor_Bow', 'Anchor_Bridge', 'Anchor_Fingerboard'])
  assert.equal(hasPartAudio('horn', 'hotspot-1'), false, 'no techniques, no hotspot')

  const bowNodes = radialPartActions('violin', 'Anchor_Bow')
  assert.deepEqual(bowNodes.map(node => node.media), ['discover', 'audio'], 'listening nodes only, no Watch node')
  assert.equal(bowNodes[0].actionId, null, 'Discover restores default selection')
  assert.deepEqual(radialPartActions('violin', 'Anchor_Scroll'), [], 'Discover alone is redundant')
  assert.deepEqual(radialPartActions('cello', 'Anchor_Bow'), [], 'no Discover without media actions')

  console.log('Passed part actions: no Discover, per-instrument technique/media configuration, catalog integrity, and playable demonstrations.')
}
