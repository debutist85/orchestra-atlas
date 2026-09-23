import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { resolveWindow, needsWindow, measureAt, sameWindow } = await server.ssrLoadModule('/src/features/score-poc/score-window.ts')
  const { playheadAt } = await server.ssrLoadModule('/src/features/score-poc/score-playhead.ts')
  const { ScoreRequests } = await server.ssrLoadModule('/src/features/score-poc/score-requests.ts')
  const scopes = [{ level: 'orchestra' }, { level: 'family', familyId: 'strings' }, { level: 'instrument', instrumentId: 'cello' }]
  for (const [index, scope] of scopes.entries()) {
    const budget = [6, 8, 12][index]
    for (let measure = 1; measure <= 278; measure++) {
      const window = resolveWindow(measure, scope, 278)
      assert.equal(window.endMeasure - window.startMeasure + 1, budget)
      assert(window.startMeasure >= 1 && window.endMeasure <= 278)
      assert(window.startMeasure <= measure && window.endMeasure >= measure)
    }
    let window, renders = 0
    for (let measure = 1; measure <= 278; measure++) {
      if (needsWindow(measure, window, 278)) {
        const next = resolveWindow(measure, scope, 278)
        if (!sameWindow(window, next)) { renders++; window = next }
      }
    }
    assert(renders < 140, `No per-measure re-engraving: ${renders}`)
    assert(needsWindow(10, resolveWindow(200, scope, 278), 278), 'Backward seek requests destination')
  }
  assert.deepEqual(resolveWindow(278, scopes[0], 278), { startMeasure: 273, endMeasure: 278 })
  assert.equal(needsWindow(278, { startMeasure: 273, endMeasure: 278 }, 278), false)
  const timing = [{ measure: 1, startSeconds: 0, endSeconds: 2 }, { measure: 2, startSeconds: 2, endSeconds: 3 }, { measure: 3, startSeconds: 3, endSeconds: 7 }]
  assert.equal(measureAt(2, timing), 2)
  assert.equal(measureAt(2.99, timing), 2)
  assert.equal(measureAt(-1, timing), 1)
  assert.equal(measureAt(999, timing), 3)
  const a = (timeSeconds, x, systemId = 0) => ({ timeSeconds, x, systemId, y: systemId * 200, height: 100 })
  const anchors = [a(0, 10), a(1, 50), a(5, 170), a(5, 20, 1), a(7, 100, 1)]
  assert.equal(playheadAt(.5, anchors).x, 30)
  assert.equal(playheadAt(3, anchors).x, 110, 'Rest/sustain interpolates through sparse anchors')
  assert.equal(playheadAt(4.99, anchors).systemId, 0)
  assert.deepEqual(playheadAt(5, anchors), { x: 20, y: 200, height: 100, systemId: 1 })
  assert.equal(playheadAt(6, anchors).x, 60)
  assert.equal(playheadAt(7.1, anchors), null)
  assert.equal(playheadAt(-1, anchors), null)
  assert.equal(playheadAt(0, []), null)
  assert.equal(playheadAt(1, [a(0, 10), a(2, 30, 1)]).x, 10, 'Never interpolate across systems without an end anchor')
  const sent = [], committed = []
  const queue = new ScoreRequests((generation, value) => sent.push({ generation, value }))
  const first = queue.request('strings 100–108')
  const second = queue.request('cello 100–114')
  const third = queue.request('cello 180–194')
  assert.equal(sent.length, 1, 'Only one render may be active')
  const finish = generation => {
    if (queue.isCurrent(generation)) committed.push(generation)
    queue.finish(generation)
  }
  finish(first)
  assert.deepEqual(sent.map(r => r.generation), [first, third], 'Intermediate queued request is dropped')
  finish(second) // even an out-of-order unsolicited result cannot commit or free active work
  assert.deepEqual(committed, [])
  finish(third)
  assert.deepEqual(committed, [third])
  const fourth = queue.request('old size')
  queue.invalidate() // before an eventual request or DOM presentation frame
  assert.equal(queue.isCurrent(fourth), false)
  queue.request('new size')
  finish(fourth)
  assert.equal(sent.at(-1).value, 'new size')
  console.log('Passed bounded windows, overlap cadence, seeks, playhead interpolation, system boundaries, and stale/coalesced requests.')
} finally { await server.close() }
