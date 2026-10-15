import assert from 'node:assert/strict'

export async function verifyTechnique(server) {
  const { techniqueById, demonstrationById, techniquesForAnatomyPart, anatomyPartHasMedia } = await server.ssrLoadModule('/src/features/instrument-explorer/technique.ts')
  assert.equal(anatomyPartHasMedia('Anchor_Bridge', 'violin'), true)
  assert.equal(anatomyPartHasMedia('Anchor_Chinrest', 'violin'), false)
  assert.equal(anatomyPartHasMedia('Anchor_Chinrest', 'timpani'), true)
  assert.equal(anatomyPartHasMedia('Anchor_Bridge', 'timpani'), false)
  assert.equal(anatomyPartHasMedia('unknown', 'violin'), false)

  const sulPonticello = techniqueById('sul-ponticello')
  assert.ok(sulPonticello, 'sul-ponticello is a known technique')
  assert.equal(sulPonticello.title, 'Sul ponticello')
  // Bowing NEAR the bridge, not on it — the one factual distinction the
  // brief calls out explicitly; worth protecting with an assertion.
  assert.match(sulPonticello.description, /near|close to/i)
  assert.doesNotMatch(sulPonticello.description, /\bon the bridge\b/i)
  assert.deepEqual(sulPonticello.demonstrationIds, ['sul-ponticello-video'])
  const demonstration = demonstrationById('sul-ponticello-video')
  assert.equal(demonstration?.type, 'video')
  assert.match(demonstration?.src ?? '', /videos\/instruments\/violin\/arco\.mp4$/)
  assert.equal(techniqueById('not-a-technique'), undefined)
  assert.equal(demonstrationById('not-a-demonstration'), undefined)

  assert.deepEqual(techniquesForAnatomyPart('Anchor_Bridge').map(technique => technique.id), ['sul-ponticello'])
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Chinrest', 'violin'), [], 'violin chinrest stays description-only')
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Chinrest', 'timpani').map(technique => technique.id), ['stroke', 'tremolo'])
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Bridge', 'timpani'), [], 'the timpani placeholder does not inherit violin techniques')
  const stroke = techniqueById('stroke')
  const tremolo = techniqueById('tremolo')
  assert.equal(stroke?.title, 'Stroke')
  assert.equal(tremolo?.title, 'Tremolo')
  assert.match(demonstrationById('timpani-stroke-video')?.src ?? '', /videos\/instruments\/timpani\/stroke\.mp4$/)
  assert.match(demonstrationById('timpani-tremolo-video')?.src ?? '', /videos\/instruments\/timpani\/tremolo\.mp4$/)
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Scroll'), [], 'a part with no linked techniques resolves to an empty list, not an error')
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Unknown'), [])

  console.log('Passed technique lookup, anatomy-part linking, and the sul ponticello content check.')
}
