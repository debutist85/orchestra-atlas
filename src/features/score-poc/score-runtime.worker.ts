import type * as AlphaTab from '@coderline/alphatab'
import type { WorkerRequest, WorkerResponse, WindowRequest, ScoreFragment, WindowResult } from './score-protocol'
import type { MeasureTime } from './score-window'
import type { ScoreAnchor } from './score-playhead'

// The high-level worker path parses/serializes on the UI thread and has no request
// identity. Use the documented low-level engine in this worker to retain the model
// here and attach generations; do not copy alphaTab's private message protocol.
let at: typeof AlphaTab
let score: AlphaTab.model.Score
let settings: AlphaTab.Settings
let renderer: AlphaTab.rendering.ScoreRenderer
let lookup: AlphaTab.midi.MidiTickLookup
let timing: MeasureTime[] = []
let parts: string[] = []
let tickToSeconds: (tick: number) => number
const reply = (message: WorkerResponse) => self.postMessage(message)

async function initialize(url: string) {
  if (typeof document !== 'undefined') throw new Error('Score runtime must execute in a dedicated worker')
  const moduleStart = performance.now()
  at = await import('@coderline/alphatab')
  const moduleMs = performance.now() - moduleStart
  const fetchStart = performance.now()
  const response = await fetch(url)
  if (!response.ok) throw new Error(`MusicXML HTTP ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  const fetchMs = performance.now() - fetchStart
  settings = new at.Settings()
  settings.core.engine = 'svg'
  settings.core.useWorkers = true // low-level renderer is already hosted in this worker
  settings.core.enableLazyLoading = false // the entire bounded window is ready before commit
  settings.player.playerMode = at.PlayerMode.Disabled
  // One horizontally endless row per window, never a second (page-style)
  // system — the adapter scrolls the window horizontally instead of
  // wrapping bars onto a new line, so the window's measures always stay in
  // a single continuous flow.
  settings.display.layoutMode = at.LayoutMode.Horizontal
  settings.display.scale = 1
  settings.display.startBar = 1
  settings.display.barCount = 6
  const parseStart = performance.now()
  performance.mark('score-worker-parse-start')
  // Validate the fixture's part list without constructing a second XML DOM.
  const partList = new TextDecoder().decode(bytes).match(/<part-list\b[^>]*>([\s\S]*?)<\/part-list>/)?.[1] ?? ''
  parts = [...partList.matchAll(/<score-part\s+id="([^"]+)"/g)].map(match => match[1])
  if (parts.join(',') !== Array.from({ length: 19 }, (_, i) => `P${i + 1}`).join(',')) throw new Error('Unexpected fixture part list')
  score = at.importer.ScoreLoader.loadScoreFromBytes(bytes, settings)
  if (score.tracks.length !== 19 || score.masterBars.length !== 278) throw new Error('Unexpected fixture model dimensions')
  const parseMs = performance.now() - parseStart
  performance.measure('score-worker-parse-model', 'score-worker-parse-start')
  const timingStart = performance.now()
  performance.mark('score-worker-timing-start')
  const midi = new at.midi.MidiFile()
  const generator = new at.midi.MidiFileGenerator(score, settings, new at.midi.AlphaSynthMidiFileHandler(midi))
  generator.generate() // data only: no player, synth, audio output, or score clock
  lookup = generator.tickLookup
  const changes = lookup.masterBars.flatMap(bar => bar.tempoChanges).sort((a, b) => a.tick - b.tick)
  const tempos: { tick: number; seconds: number; tempo: number }[] = [{ tick: 0, seconds: 0, tempo: score.tempo }]
  for (const change of changes) {
    const previous = tempos[tempos.length - 1]
    const seconds = previous.seconds + (change.tick - previous.tick) * 60 / (previous.tempo * midi.division)
    if (change.tick === previous.tick) previous.tempo = change.tempo
    else tempos.push({ tick: change.tick, seconds, tempo: change.tempo })
  }
  tickToSeconds = tick => {
    let lo = 0, hi = tempos.length
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (tempos[mid].tick <= tick) lo = mid + 1
      else hi = mid
    }
    const t = tempos[Math.max(0, lo - 1)]
    return t.seconds + (tick - t.tick) * 60 / (t.tempo * midi.division)
  }
  timing = lookup.masterBars.map(bar => ({ measure: bar.masterBar.index + 1, startSeconds: tickToSeconds(bar.start), endSeconds: tickToSeconds(bar.end) }))
  // This fixture has no repeated traversal. Do not silently misproject other files.
  if (new Set(timing.map(bar => bar.measure)).size !== timing.length) throw new Error('Repeated measure traversal needs an occurrence-aware window resolver')
  renderer = new at.rendering.ScoreRenderer(settings)
  // alphaTab's low-level worker fallback uses approximate character widths. Supply
  // real system-font metrics through its public canvas API, entirely off-thread.
  const context = new OffscreenCanvas(1, 1).getContext('2d')
  const canvas = renderer.canvas
  if (!context || !canvas) throw new Error('Worker text measurement unavailable')
  canvas.measureText = text => {
    context.font = canvas.font.toCssString()
    const metrics = context.measureText(text)
    return { width: metrics.width, height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent }
  }
  performance.measure('score-worker-timing-setup', 'score-worker-timing-start')
  reply({ type: 'ready', moduleMs, fetchMs, parseMs, timingMs: performance.now() - timingStart,
    bytes: bytes.byteLength, timing, duration: timing.at(-1)?.endSeconds ?? 0, tracks: score.tracks.length, thread: 'worker' })
}

function render(request: WindowRequest) {
  const start = performance.now()
  performance.mark(`score-worker-${request.generation}-start`)
  const indices = request.partIds.map(id => parts.indexOf(id))
  if (indices.some(index => index < 0)) throw new Error('Unknown requested part')
  const fragments: ScoreFragment[] = []
  let width = request.width, height = 0
  let failure: unknown
  const collect = (event: AlphaTab.rendering.RenderFinishedEventArgs) => {
    width = Math.max(width, event.totalWidth)
    height = Math.max(height, event.totalHeight)
    if (typeof event.renderResult === 'string') fragments.push({ svg: event.renderResult,
      x: event.x, y: event.y, width: event.width, height: event.height })
  }
  const onError = (error: unknown) => { failure = error }
  renderer.partialRenderFinished.on(collect)
  renderer.renderFinished.on(collect)
  renderer.error.on(onError)
  // A tie or beam continuing from the immediately preceding measure into
  // this window's first bar makes alphaTab look up that earlier bar's
  // renderer; when it isn't part of this render, the lookup comes back null
  // and alphaTab dereferences it unguarded (no bar-subset boundary check
  // upstream — this only ever surfaces because we render arbitrary measure
  // ranges instead of the whole score). Render one extra measure of
  // invisible lookback context whenever the window doesn't already start at
  // measure 1, so that lookup always resolves; it's cropped back out below.
  const padded = request.window.startMeasure > 1
  const renderStart = padded ? request.window.startMeasure - 1 : request.window.startMeasure
  settings.display.startBar = renderStart
  settings.display.barCount = request.window.endMeasure - renderStart + 1
  renderer.updateSettings(settings)
  renderer.width = request.width
  try { renderer.renderScore(indices.length ? score : null, indices) }
  finally {
    renderer.partialRenderFinished.off(collect)
    renderer.renderFinished.off(collect)
    renderer.error.off(onError)
  }
  if (failure) throw failure
  const renderMs = performance.now() - start
  const anchorStart = performance.now()
  const anchors: ScoreAnchor[] = []
  const regions: WindowResult['regions'] = []
  const renderedMeasures: number[] = []
  renderer.boundsLookup?.finish()
  let cropX = 0
  for (const [systemId, system] of (renderer.boundsLookup?.staffSystems ?? []).entries()) {
    for (const bar of system.bars) {
      const measure = bar.index + 1
      if (measure < renderStart || measure > request.window.endMeasure) throw new Error('Renderer engraved outside requested window')
      if (measure < request.window.startMeasure) {
        // The padding bar itself — never shown, just note where the real
        // (requested) content actually begins so it can be cropped out below.
        const bounds = bar.lineAlignedBounds
        cropX = Math.max(cropX, bounds.x + bounds.w)
        continue
      }
      const time = timing.find(t => t.measure === measure)
      if (!time) continue
      renderedMeasures.push(measure)
      const bounds = bar.lineAlignedBounds
      regions.push({ measure, timeSeconds: time.startSeconds, x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h })
      const beats = new Map<number, number[]>()
      for (const staffBar of bar.bars) for (const beat of staffBar.beats) {
        if (beat.beat.graceType !== at.model.GraceType.None) continue
        const seconds = tickToSeconds(lookup.getBeatStart(beat.beat))
        if (seconds < time.startSeconds || seconds >= time.endSeconds) continue
        const xs = beats.get(seconds) ?? []
        xs.push(beat.onNotesX)
        beats.set(seconds, xs)
      }
      const shape = { y: bounds.y, height: bounds.h, systemId }
      const positions = [...beats].sort((a, b) => a[0] - b[0])
      if (!positions.length || positions[0][0] > time.startSeconds) anchors.push({ ...shape, timeSeconds: time.startSeconds, x: bounds.x })
      for (const [timeSeconds, xs] of positions) {
        xs.sort((a, b) => a - b)
        anchors.push({ ...shape, timeSeconds, x: xs[Math.floor(xs.length / 2)] })
      }
      anchors.push({ ...shape, timeSeconds: time.endSeconds, x: bounds.x + bounds.w })
    }
  }
  anchors.sort((a, b) => a.timeSeconds - b.timeSeconds)
  if (cropX > 0) {
    // Shift the padding bar (and everything after it) left so the requested
    // window's first bar starts at x=0 as if it had been rendered alone;
    // score-adapter.ts's host clips anything left over at negative x.
    for (const region of regions) region.x -= cropX
    for (const anchor of anchors) anchor.x -= cropX
    for (const fragment of fragments) fragment.x -= cropX
    width = Math.max(0, width - cropX)
  }
  if (indices.length && (!anchors.length || !fragments.length)) throw new Error('Window has no usable rendering/anchors')
  const result: WindowResult = { type: 'window', generation: request.generation, window: request.window, fragments, anchors,
    regions, width, height, fontSize: settings.display.resources.engravingSettings.musicFontSize, tracks: indices.map(i => `${parts[i]}: ${score.tracks[i].name}`),
    staves: indices.reduce((sum, i) => sum + score.tracks[i].staves.length, 0), renderedMeasures: [...new Set(renderedMeasures)],
    renderMs, anchorsMs: performance.now() - anchorStart, workerMs: performance.now() - start, thread: 'worker' }
  performance.measure(`score-worker-${request.generation}`, `score-worker-${request.generation}-start`)
  performance.clearMarks(); performance.clearMeasures()
  reply(result)
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  if (request.type === 'initialize') {
    void initialize(request.url).catch(error => reply({ type: 'error', message: error instanceof Error ? (error.stack ?? error.message) : String(error) }))
  } else {
    try { render(request) }
    catch (error) { reply({ type: 'error', generation: request.generation, message: error instanceof Error ? (error.stack ?? error.message) : String(error) }) }
  }
}
