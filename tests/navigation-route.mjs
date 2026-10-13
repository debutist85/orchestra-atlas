import assert from 'node:assert/strict'

export async function verifyNavigationRoute(server) {
  const { exploreRoutePath } = await server.ssrLoadModule('/src/store/navigation-route.ts')
  const orchestra = { level: 'orchestra' }
  const strings = { level: 'family', familyId: 'strings' }
  const violin = { level: 'instrument', familyId: 'strings', instrumentId: 'violin' }

  assert.equal(exploreRoutePath(violin, 'explore'), '/strings/violin/explore')
  assert.equal(exploreRoutePath(violin, 'map'), '/strings/violin')
  // Explore only ever attaches to an instrument in practice (enterExplore
  // requires instrument level), but the segment math itself is level-agnostic.
  assert.equal(exploreRoutePath(strings, 'explore'), '/strings/explore')
  assert.equal(exploreRoutePath(orchestra, 'explore'), '/explore')
  assert.equal(exploreRoutePath(orchestra, 'map'), '/')

  console.log('Passed explore-segment URL projection.')
}
