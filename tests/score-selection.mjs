import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { scopeParts, navigationScope, partMap, allPartIds } = await server.ssrLoadModule('/src/features/score-poc/selection.ts')
  assert.equal(new Set(Object.values(partMap).flat()).size, 19)
  assert.deepEqual(scopeParts({ level: 'orchestra' }), allPartIds)
  assert.deepEqual(scopeParts({ level: 'family', familyId: 'strings' }), ['P14','P15','P16','P17','P18','P19'])
  assert.deepEqual(scopeParts(navigationScope({ level: 'instrument', familyId: 'strings', instrumentId: 'cello' })), ['P17','P18'])
  assert.deepEqual(scopeParts({ level: 'instrument', instrumentId: 'doubleBass' }), ['P19'])
  assert.deepEqual(scopeParts({ level: 'family', familyId: 'woodwinds' }), ['P1','P2','P3','P4','P5','P6','P7','P8'])
  assert.deepEqual(scopeParts({ level: 'family', familyId: 'other' }), [])
  assert.deepEqual(scopeParts({ level: 'instrument', instrumentId: 'trombone' }), [])
  console.log('Passed score parts, catalog families, navigation scopes, and absent-instrument mapping.')
} finally { await server.close() }
