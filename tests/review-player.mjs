import assert from 'node:assert/strict'
import { ReviewPlayer } from '../src/features/activity-review/review-player.ts'
const original = { AudioContext: globalThis.AudioContext, setInterval, clearInterval }
let context, tick
class Node {
  starts = []; stopped = false; disconnected = false; loop = false
  connect() { return this }
  disconnect() { this.disconnected = true }
  start(...args) { this.starts.push(args) }
  stop() { this.stopped = true }
}
class Context {
  currentTime = 0; outputLatency = .01; sampleRate = 16000; destination = {}; nodes = []
  constructor() { context = this }
  resume() { return Promise.resolve() }
  close() { return Promise.resolve() }
  createBufferSource() { const node = new Node(); this.nodes.push(node); return node }
  createGain() { return { gain: { value: 1 }, connect() {}, disconnect() {} } }
  createBuffer(channels, size, rate) { return { sampleRate: rate, getChannelData: () => new Float32Array(size) } }
}
globalThis.AudioContext = Context
globalThis.setInterval = callback => { tick = callback; return 1 }
globalThis.clearInterval = () => { tick = null }
try {
  const player = new ReviewPlayer(), audio = { duration: 4 }
  await player.play(audio, [.1, .6, .8], .5, null, true, false)
  assert.deepEqual(context.nodes[0].starts, [[.04, .5]], 'source gets an exact clock start and seek offset')
  assert.ok(Math.abs(context.nodes[1].starts[0][0] - .14) < 1e-12, 'onset click uses the same clock origin')
  context.currentTime = .2; tick()
  assert.ok(Math.abs(context.nodes[2].starts[0][0] - .34) < 1e-12, 'lookahead schedules the next click without timer-time jitter')
  context.currentTime = .3
  assert.ok(Math.abs(player.position - .75) < 1e-12, 'cursor accounts for output latency')
  player.pause()
  assert.equal(player.running, false)
  assert.ok(context.nodes.every(node => node.stopped && node.disconnected), 'pause cancels source and scheduled marker nodes')
  context.currentTime = 0
  await player.play(audio, [1.6], 1.5, [1, 2], true, false)
  const loopSource = context.nodes.at(-2)
  assert.equal(loopSource.loop, true)
  context.currentTime = 1.1; tick()
  assert.ok(Math.abs(context.nodes.at(-1).starts[0][0] - 1.14) < 1e-12, 'clicks repeat exactly on the loop timeline')
  player.seek(2.5)
  assert.equal(player.position, 2.5)
  assert.equal(player.running, false)
  player.dispose()
} finally { Object.assign(globalThis, original) }
console.log('Passed review player shared source/click clock, seeks, scheduling lookahead, output-latency cursor, loop timing and node cleanup.')
