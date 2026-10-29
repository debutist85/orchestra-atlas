import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { brotliDecompressSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createServer } from 'vite'
import { compactGainActivity } from '../scripts/compact-activity.mjs'

const server = await createServer({
  configFile: false, mode: 'test', optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom',
})
const originals = { fetch, setInterval, clearInterval, requestAnimationFrame: globalThis.requestAnimationFrame, AudioContext: globalThis.AudioContext, window: globalThis.window }
const flush = async () => { for (let i = 0; i < 20; i++) await new Promise(resolve => setImmediate(resolve)) }
const deadline = work => {
  let timer
  return Promise.race([work, new Promise((_, reject) => {
    timer = setTimeout(() => reject(Error('Audio work did not settle')), 1000)
  })]).finally(() => clearTimeout(timer))
}
const manifest = { version: 1, excerptId: 'beethoven-7th-2nd', duration: 90, chunkDuration: 15, chunkCount: 6, stems: ['full_orchestra', 'strings', 'cello'] }
const profile = { version: 2, excerptId: manifest.excerptId, duration: 90, sampleInterval: 15, analysisByKey: {}, instruments: { cello: [.0001, .2, .7, .3, .1, .4] }, instrumentsShared: { cello: [.00001, .1, .4, .2, .05, .3] }, orchestra: [.0001, .4, .8, .6, .1, .5] }
let requests = [], contexts = []
const parameter = () => ({ value: 1, setTargetAtTime() {}, cancelAndHoldAtTime() {}, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime() {} })
class Node {
  gain = parameter(); stopped = false; disconnected = false
  connect() { return this }
  disconnect() { this.disconnected = true }
  stop() { this.stopped = true }
  start(...args) { this.starts = args }
}
class Context {
  currentTime = 0; sampleRate = 48000; destination = new Node(); sources = []; closed = false
  constructor() { contexts.push(this) }
  resume() { return Promise.resolve() }
  close() { this.closed = true; return Promise.resolve() }
  createGain() { return new Node() }
  createDynamicsCompressor() { return Object.assign(new Node(), Object.fromEntries(['threshold', 'knee', 'ratio', 'attack', 'release'].map(key => [key, parameter()]))) }
  createBufferSource() { const source = new Node(); this.sources.push(source); return source }
  async decodeAudioData(bytes) { return { url: new TextDecoder().decode(bytes), length: 720000, numberOfChannels: 2 } }
}
const mockFetch = async url => {
  requests.push(String(url))
  if (String(url).endsWith('manifest.json')) return Response.json(manifest)
  if (String(url).endsWith('.gain.runtime.json')) return Response.json(profile)
  return new Response(String(url), { headers: { 'content-type': 'audio/mp4' } })
}

try {
  const { createChunkScheduler } = await server.ssrLoadModule('/src/features/listening/chunk-scheduler.ts')
  const { currentExcerpt } = await server.ssrLoadModule('/src/features/listening/excerpt.ts')
  const { createListeningEngine } = await server.ssrLoadModule('/src/features/listening/listening-engine.ts')
  const { usePlaybackStore } = await server.ssrLoadModule('/src/store/playback-store.ts')
  const { intensityAt, sharedIntensityAt } = await server.ssrLoadModule('/src/features/listening/activity-profile.ts')
  globalThis.fetch = mockFetch

  // Granted slots used to escape finally when a newer plan won this race.
  const scheduler = createChunkScheduler()
  scheduler.attach(new Context(), new Node())
  await scheduler.loadManifest(currentExcerpt)
  for (let i = 0; i < 8; i++) {
    const obsolete = scheduler.prepare(['cello'], (i % 5) * 15, 'paused')
    const cancellation = scheduler.prepare([], (i % 5) * 15, 'paused')
    await deadline(Promise.all([obsolete, cancellation]))
  }
  await deadline(scheduler.prepare(['cello'], 75, 'paused'))
  assert.equal(scheduler.diagnostics().bufferCount, 1, 'cancelled grants do not exhaust fetch slots')
  scheduler.dispose()

  // An obsolete decode cannot overwrite a new scheduler generation's data.
  const reused = createChunkScheduler(), oldContext = new Context()
  let finishDecode
  oldContext.decodeAudioData = () => new Promise(resolve => { finishDecode = resolve })
  reused.attach(oldContext, new Node()); await reused.loadManifest(currentExcerpt)
  const oldLoad = reused.prepare(['cello'], 0, 'paused'); await flush()
  assert.ok(finishDecode)
  reused.dispose()
  const newContext = new Context()
  reused.attach(newContext, new Node()); await reused.loadManifest(currentExcerpt)
  await deadline(reused.prepare(['cello'], 0, 'paused'))
  finishDecode({ url: 'stale', length: 1, numberOfChannels: 1 }); await oldLoad
  reused.scheduleWindow(['cello'], 0, 0, true)
  assert.notEqual(newContext.sources[0].buffer.url, 'stale')
  newContext.currentTime = 1
  reused.scheduleWindow(['cello'], 0, 0, true)
  assert.equal(reused.diagnostics().lateSchedules, 0, 'polling existing sources does not report a late start')
  assert.equal(reused.diagnostics().bufferCount, 1)
  reused.dispose()

  const timers = new Map(); let timerId = 0
  globalThis.setInterval = callback => { const id = ++timerId; timers.set(id, callback); return id }
  globalThis.clearInterval = id => timers.delete(id)
  globalThis.requestAnimationFrame = () => { throw Error('Audio must not depend on animation frames') }
  globalThis.window = { setTimeout: () => 0 }
  globalThis.AudioContext = Context
  usePlaybackStore.setState({ status: 'paused', position: 0, duration: 90, epoch: 0 })
  const engine = createListeningEngine(), disconnect = engine.connect()
  const wake = async () => { for (const callback of [...timers.values()]) callback(); await flush() }
  await engine.load()
  const context = contexts.at(-1)
  assert.ok(requests.some(url => url.endsWith(currentExcerpt.gainActivityUrl)))
  assert.ok(!requests.some(url => url.endsWith('/beethoven-7th-2nd.json')), 'startup does not fetch detailed analysis')
  assert.equal(timers.size, 0, 'paused audio does not poll')
  usePlaybackStore.getState().play(); await flush()
  assert.equal(timers.size, 1)
  for (const time of [1, 14, 16, 29, 31]) { context.currentTime = time; await wake() }
  await wake() // Noncritical lookahead may finish between timer wakeups.
  assert.ok(context.sources.some(source => source.buffer.url.endsWith('/full_orchestra/003.m4a')), 'timer advances beyond two chunk boundaries without any rAF: ' + JSON.stringify({ sources: context.sources.map(source => source.buffer?.url), diagnostics: engine.diagnostics(), requests }))
  engine.applySelection({ selectedInstrumentIds: ['cello'], effectiveListeningMode: 'highlight' }); await flush()
  assert.deepEqual([...engine.diagnostics().stems], ['cello'])
  assert.equal(timers.size, 1, 'selection cannot create a second ticker')
  usePlaybackStore.getState().seek(45); await flush()
  assert.ok(Math.abs(engine.position() - 44.92) < .001, 'seek retains the shared scheduling lead')
  usePlaybackStore.getState().pause(); await flush()
  assert.equal(timers.size, 0)
  assert.ok(context.sources.every(source => source.stopped))
  usePlaybackStore.getState().play(); await flush()
  assert.equal(timers.size, 1)
  context.currentTime = 150; await wake()
  assert.equal(timers.size, 0, 'end of excerpt releases the timer')
  assert.equal(usePlaybackStore.getState().status, 'paused')
  disconnect(); engine.dispose()
  assert.equal(timers.size, 0)
  assert.equal(context.closed, true)

  let finishProfile
  globalThis.fetch = async url => String(url).endsWith('.gain.runtime.json')
    ? new Promise(resolve => { finishProfile = resolve }) : mockFetch(url)
  const cancelled = createListeningEngine()
  const pendingLoad = cancelled.load(); await flush()
  const loadingContext = contexts.at(-1)
  cancelled.dispose()
  finishProfile(Response.json(profile)); await pendingLoad
  assert.equal(cancelled.activityProfile(), null, 'late initial load cannot revive a disposed engine')
  assert.equal(loadingContext.closed, true)
  assert.equal(timers.size, 0)
  globalThis.fetch = mockFetch

  // Lossless gain compaction preserves both scales even near silence.
  const gain = compactGainActivity(profile)
  for (let time = 0; time < 90; time += .037) {
    assert.equal(intensityAt(gain, 'cello', time), intensityAt(profile, 'cello', time))
    assert.equal(sharedIntensityAt(gain, 'cello', time), sharedIntensityAt(profile, 'cello', time))
  }
  const source = await readFile('public/' + currentExcerpt.activityUrl)
  const generated = JSON.parse(await readFile('public/' + currentExcerpt.gainActivityUrl))
  const compressed = await readFile('public/' + currentExcerpt.gainActivityUrl + '.br')
  assert.deepEqual(JSON.parse(brotliDecompressSync(compressed)), generated)
  assert.equal(generated.runtime.sourceSha256, createHash('sha256').update(source).digest('hex'))
  const analysis = JSON.parse(source)
  for (const key of ['instruments', 'instrumentsShared', 'orchestra', 'gates', 'chunks', 'sampleInterval']) assert.deepEqual(generated[key], analysis[key], key + ' matches analysis exactly')
  console.log('Passed cancellation-slot reuse, stale decode isolation, render-independent chunk scheduling, seek/pause/end cleanup, and lossless compressed gain-profile parity.')
} finally {
  for (const [key, value] of Object.entries(originals)) {
    if (value === undefined) delete globalThis[key]
    else globalThis[key] = value
  }
  await server.close()
}
