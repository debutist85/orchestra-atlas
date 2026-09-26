import assert from 'node:assert/strict'
import { createServer } from 'vite'
const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { resolveStart, needsWindow, measureAt } = await server.ssrLoadModule('/src/features/score-poc/score-window.ts')
  const { playheadAt } = await server.ssrLoadModule('/src/features/score-poc/score-playhead.ts')
  const { ScoreRequests } = await server.ssrLoadModule('/src/features/score-poc/score-requests.ts')
  // Page size (how many measures actually fit) is now decided by the worker
  // from container width (score-runtime.worker.ts's justification pass), so
  // score-window.ts only owns where a page starts and whether the currently
  // committed page has been exhausted — tested directly here against
  // synthetic committed windows rather than a fixed measure count.
  const scopes = [{ level: 'orchestra' }, { level: 'family', familyId: 'strings' }, { level: 'instrument', instrumentId: 'cello' }]
  for (const scope of scopes) {
    for (let measure = 1; measure <= 278; measure++) {
      const start = resolveStart(measure, scope, 278)
      assert(start >= 1 && start <= 278)
      assert(start <= measure, 'A page never starts after the measure it\'s meant to show')
    }
    // Ordinary forward playback (score-adapter.ts's reason==='window') asks
    // for behindOverride: 0 so a page turn never re-shows already-passed
    // measures behind the cursor; deliberate seeks/scope changes keep the
    // scope's normal look-back budget.
    assert.equal(resolveStart(100, scope, 278, 0), 100, 'behindOverride 0 starts exactly at the current measure')
    assert.equal(resolveStart(100, scope, 278), 98, 'omitting the override keeps the scope\'s default 2-measure look-back')
    assert.equal(resolveStart(1, scope, 278, 0), 1, 'clamped to the first measure, never below it')
    assert.equal(resolveStart(278, scope, 278), 276, 'look-back near the end still clamps to >=1, not past total')
  }
  // A page is never abandoned before the cursor has genuinely reached its
  // true last measure — this is what previously caused shifts to happen
  // noticeably before the visible measures were used up.
  assert.equal(needsWindow(50, undefined, 278), true, 'No committed page yet always needs one')
  assert.equal(needsWindow(50, { startMeasure: 40, endMeasure: 60 }, 278), false, 'Still inside the committed page')
  assert.equal(needsWindow(39, { startMeasure: 40, endMeasure: 60 }, 278), true, 'Backward seek requests destination')
  assert.equal(needsWindow(59, { startMeasure: 40, endMeasure: 60 }, 278), false, 'Not exhausted one measure before the page\'s end')
  assert.equal(needsWindow(60, { startMeasure: 40, endMeasure: 60 }, 278), true, 'Exhausted exactly at the page\'s true last measure')
  assert.equal(needsWindow(278, { startMeasure: 275, endMeasure: 278 }, 278), false, 'Never exhausted at the very last measure of the whole score')
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
