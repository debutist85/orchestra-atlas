import assert from 'node:assert/strict'

export async function verifyTechnique(server) {
  const { techniqueById, demonstrationById, techniquesForAnatomyPart } = await server.ssrLoadModule('/src/features/instrument-explorer/technique.ts')

  const sulPonticello = techniqueById('sul-ponticello')
  assert.ok(sulPonticello, 'sul-ponticello is a known technique')
  assert.equal(sulPonticello.title, 'Sul ponticello')
  // Bowing NEAR the bridge, not on it — the one factual distinction the
  // brief calls out explicitly; worth protecting with an assertion.
  assert.match(sulPonticello.description, /near|close to/i)
  assert.doesNotMatch(sulPonticello.description, /\bon the bridge\b/i)
  // No recording exists yet — an empty list, not a fabricated entry.
  assert.deepEqual(sulPonticello.demonstrationIds, [])
  assert.equal(techniqueById('not-a-technique'), undefined)
  assert.equal(demonstrationById('not-a-demonstration'), undefined)

  assert.deepEqual(techniquesForAnatomyPart('Anchor_Bridge').map(technique => technique.id), ['sul-ponticello'])
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Scroll'), [], 'a part with no linked techniques resolves to an empty list, not an error')
  assert.deepEqual(techniquesForAnatomyPart('Anchor_Unknown'), [])

  console.log('Passed technique lookup, anatomy-part linking, and the sul ponticello content check.')
}
