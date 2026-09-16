import assert from 'node:assert/strict'

export async function verifyNavigationPath(server) {
  const {
    kebabSegment, navigationPath, parseNavigationPath, historyMode,
  } = await server.ssrLoadModule('/src/features/orchestra-installation/navigation-path.ts')
  const orchestra = { level: 'orchestra' }
  const strings = { level: 'family', familyId: 'strings' }
  const cello = { level: 'instrument', familyId: 'strings', instrumentId: 'cello' }
  const bass = { level: 'instrument', familyId: 'strings', instrumentId: 'doubleBass' }
  assert.equal(kebabSegment('doubleBass'), 'double-bass')
  assert.equal(navigationPath(orchestra), '/')
  assert.equal(navigationPath(strings), '/strings')
  assert.equal(navigationPath(cello), '/strings/cello')
  assert.equal(navigationPath(bass), '/strings/double-bass')
  assert.deepEqual(parseNavigationPath('/').navigation, orchestra)
  assert.deepEqual(parseNavigationPath('/strings').navigation, strings)
  assert.deepEqual(parseNavigationPath('/strings/cello').navigation, cello)
  assert.deepEqual(parseNavigationPath('/strings/double-bass').navigation, bass)
  assert.deepEqual(parseNavigationPath('/strings/doubleBass').navigation, bass)
  assert.deepEqual(parseNavigationPath('/woodwinds/cello').navigation, cello)
  assert.equal(parseNavigationPath('/woodwinds/cello').prefix, '/strings/cello')
  const future = parseNavigationPath('/strings/cello/explore/techniques')
  assert.deepEqual(future.navigation, cello)
  assert.deepEqual(future.rest, ['explore', 'techniques'])
  assert.deepEqual(parseNavigationPath('/not-a-family').navigation, orchestra)
  assert.deepEqual(parseNavigationPath('/strings/not-an-instrument').navigation, strings)
  assert.deepEqual(parseNavigationPath('/strings/not-an-instrument').rest, ['not-an-instrument'])
  assert.equal(historyMode(orchestra, strings), 'push')
  assert.equal(historyMode(strings, cello), 'push')
  assert.equal(historyMode(cello, strings), 'replace')
  assert.equal(historyMode(strings, orchestra), 'replace')
  assert.equal(historyMode(strings, { level: 'family', familyId: 'woodwinds' }), 'push')
  assert.equal(historyMode(cello, cello), 'none')
  console.log('Passed spatial path parsing, kebab slugs, future trailing segments, and history mode.')
}
