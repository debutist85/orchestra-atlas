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
// How many measures of lookback/lookahead padding a rendered page needs on
// either side to avoid alphaTab's tie/slur boundary-rendering bug — an
// empirically-set safety margin, not a value derived from a fully understood
// root cause (see maxTieOrSlurSpan below).
let boundaryPad = 1
// Natural (unstretched) per-bar widths are deterministic for this fixed local
// fixture — same content, same rendered track set, always the same width.
// Cached per scope (joined part IDs) so re-justifying on resize, revisiting a
// scope, or seeking backward never needs a fresh measurement render.
const naturalWidthCache = new Map<string, Map<number, number>>()
const reply = (message: WorkerResponse) => self.postMessage(message)

// A fresh renderer instance, with alphaTab's approximate low-level-worker
// text metrics replaced by real system-font measurement (off-thread, via the
// renderer's own public canvas API).
function createRenderer(): AlphaTab.rendering.ScoreRenderer {
  const instance = new at.rendering.ScoreRenderer(settings)
  const context = new OffscreenCanvas(1, 1).getContext('2d')
  const canvas = instance.canvas
  if (!context || !canvas) throw new Error('Worker text measurement unavailable')
  canvas.measureText = text => {
    context.font = canvas.font.toCssString()
    const metrics = context.measureText(text)
    return { width: metrics.width, height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent }
  }
  return instance
}

// alphaTab has a documented, unresolved issue engraving arbitrary bar
// subsets (see docs/score-runtime-poc.md): a page boundary landing near a
// tie or slur can null-deref in its direction-calculation glyph code
// (`ScoreSlurGlyph.calculateTieDirection`), a one-bar pad on each side
// wasn't enough to avoid it, and empirically neither is padding sized to
// the model's longest explicit tie/slur span (verified against a real
// reproduction case — see boundaryPad below and its `Math.max(8, …)` floor).
// This scan is kept as a lower bound in case some future score has an
// explicit span longer than that empirical floor, not as a proven root-
// cause fix — alphaTab's internal layout evidently needs more surrounding
// context than any single explicit tie/slur relationship reveals, and
// fully explaining why would need alphaTab's unminified internals.
function maxTieOrSlurSpan(): number {
  let max = 0
  for (const track of score.tracks) for (const staff of track.staves) for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) {
    for (const linkedBeat of [beat.effectSlurOrigin, beat.effectSlurDestination]) {
      if (linkedBeat) max = Math.max(max, Math.abs(beat.voice.bar.index - linkedBeat.voice.bar.index))
    }
    for (const note of beat.notes) {
      for (const linked of [note.tieOrigin, note.tieDestination, note.slurOrigin, note.slurDestination, note.effectSlurOrigin, note.effectSlurDestination]) {
        if (linked) max = Math.max(max, Math.abs(note.beat.voice.bar.index - linked.beat.voice.bar.index))
      }
    }
  }
  return max
}

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
  // system — the adapter pages through the window horizontally instead of
  // wrapping bars onto a new line, so the window's measures always stay in
  // a single continuous flow.
  settings.display.layoutMode = at.LayoutMode.Horizontal
  settings.display.scale = 1
  settings.display.startBar = 1
  settings.display.barCount = 6
  // Instrument names must stay visible regardless of horizontal scroll
  // position; alphaTab's own baked-in labels live at the left edge of the
  // single continuous system and scroll away with it (and would be clipped
  // by the lookback-padding crop below on every page but the first). Render
  // them ourselves instead (score-adapter.ts's label overlay, staveBounds).
  settings.notation.elements.set(at.NotationElement.TrackNames, false)
  const parseStart = performance.now()
  performance.mark('score-worker-parse-start')
  // Validate the fixture's part list without constructing a second XML DOM.
  const partList = new TextDecoder().decode(bytes).match(/<part-list\b[^>]*>([\s\S]*?)<\/part-list>/)?.[1] ?? ''
  parts = [...partList.matchAll(/<score-part\s+id="([^"]+)"/g)].map(match => match[1])
  if (parts.join(',') !== Array.from({ length: 19 }, (_, i) => `P${i + 1}`).join(',')) throw new Error('Unexpected fixture part list')
  score = at.importer.ScoreLoader.loadScoreFromBytes(bytes, settings)
  if (score.tracks.length !== 19 || score.masterBars.length !== 278) throw new Error('Unexpected fixture model dimensions')
  boundaryPad = Math.max(8, maxTieOrSlurSpan())
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
  renderer = createRenderer()
  performance.measure('score-worker-timing-setup', 'score-worker-timing-start')
  reply({ type: 'ready', moduleMs, fetchMs, parseMs, timingMs: performance.now() - timingStart,
    bytes: bytes.byteLength, timing, duration: timing.at(-1)?.endSeconds ?? 0, tracks: score.tracks.length, thread: 'worker' })
}

// `displayWidth` of 0 means "natural, auto-computed width" in alphaTab's
// Horizontal layout; a positive value forces that exact width. Zeroing a
// range before measuring it guarantees natural geometry, regardless of what
// a previous (differently-stretched) request left behind. Both the
// multi-track (MasterBar) and single-track (Bar) fields are set since which
// one alphaTab actually consults depends on how many tracks are rendered.
function setDisplayWidths(from: number, to: number, indices: number[], width: number) {
  for (let measure = from; measure <= to; measure++) {
    const masterBar = score.masterBars[measure - 1]
    if (!masterBar) continue
    masterBar.displayWidth = width
    for (const index of indices) for (const staff of score.tracks[index].staves) {
      const bar = staff.bars[measure - 1]
      if (bar) bar.displayWidth = width
    }
  }
}

function renderAttempt(request: WindowRequest, maxMeasures: number, pad: number): WindowResult {
  const start = performance.now()
  performance.mark(`score-worker-${request.generation}-start`)
  const indices = request.partIds.map(id => parts.indexOf(id))
  if (indices.some(index => index < 0)) throw new Error('Unknown requested part')
  const scopeKey = request.partIds.join(',')
  let cache = naturalWidthCache.get(scopeKey)
  if (!cache) { cache = new Map(); naturalWidthCache.set(scopeKey, cache) }

  // A tie or slur continuing from the immediately preceding/following
  // measure makes alphaTab look up that neighboring bar's renderer for
  // direction calculations; when it isn't part of this render, the lookup
  // comes back null and alphaTab dereferences it unguarded (no bar-subset
  // boundary check upstream — this only ever surfaces because we render
  // arbitrary measure ranges instead of the whole score). `pad` measures of
  // invisible lookback/lookahead context are rendered on whichever side
  // doesn't already reach the score's true start/end; both are cropped back
  // out below. Callers escalate `pad` on retry (see render() below) since no
  // single fixed amount has proven reliable everywhere in this score.
  const renderStart = Math.max(1, request.startMeasure - pad)
  const pageEnd = Math.min(request.startMeasure + maxMeasures - 1, timing.length)

  const measureStart = performance.now()
  const missing: number[] = []
  for (let measure = request.startMeasure; measure <= pageEnd; measure++) if (!cache.has(measure)) missing.push(measure)
  if (missing.length) {
    const measureRenderEnd = Math.min(timing.length, pageEnd + pad)
    setDisplayWidths(renderStart, measureRenderEnd, indices, 0)
    settings.display.startBar = renderStart
    settings.display.barCount = measureRenderEnd - renderStart + 1
    renderer.updateSettings(settings)
    renderer.width = request.targetWidth
    let failure: unknown
    const onError = (error: unknown) => { failure = error }
    renderer.error.on(onError)
    try { renderer.renderScore(indices.length ? score : null, indices) }
    finally { renderer.error.off(onError) }
    if (failure) throw failure
    renderer.boundsLookup?.finish()
    for (const system of renderer.boundsLookup?.staffSystems ?? []) for (const bar of system.bars) {
      const measure = bar.index + 1
      if (measure >= request.startMeasure && measure <= pageEnd) cache.set(measure, bar.lineAlignedBounds.w)
    }
  }
  const measureMs = performance.now() - measureStart

  // Pick as many measures as fit `targetWidth`, always at least one.
  let sum = 0, endMeasure = request.startMeasure
  for (let measure = request.startMeasure; measure <= pageEnd; measure++) {
    const width = cache.get(measure) ?? 1
    if (sum > 0 && sum + width > request.targetWidth) break
    sum += width
    endMeasure = measure
  }
  const trailing = endMeasure < timing.length
  const realRenderEnd = trailing ? Math.min(timing.length, endMeasure + pad) : endMeasure
  // Stretch (or, for a single measure wider than the viewport, compress) the
  // chosen measures so they fill targetWidth exactly — "measures fill the
  // space horizontally". The pad bars must always be reset to natural width
  // here, even when the measurement pass above was skipped entirely (a full
  // cache hit) — a pad bar's measure can be exactly the same one a PREVIOUS,
  // differently-stretched page rendered as real content (e.g. this page's
  // leading pad is typically the previous page's last real measure), and
  // without an unconditional reset that leftover stretch carries forward and
  // compounds across page turns, which both breaks "measures fill the
  // space" and appears to stress alphaTab's tie/slur layout into the
  // getBeatDirection crash below.
  setDisplayWidths(renderStart, request.startMeasure - 1, indices, 0)
  if (trailing) setDisplayWidths(endMeasure + 1, realRenderEnd, indices, 0)
  const stretchFactor = sum > 0 ? request.targetWidth / sum : 1
  for (let measure = request.startMeasure; measure <= endMeasure; measure++) {
    setDisplayWidths(measure, measure, indices, (cache.get(measure) ?? 1) * stretchFactor)
  }

  const fragments: ScoreFragment[] = []
  let width = request.targetWidth, height = 0
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
  settings.display.startBar = renderStart
  settings.display.barCount = realRenderEnd - renderStart + 1
  renderer.updateSettings(settings)
  renderer.width = request.targetWidth
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
  const staveBounds: WindowResult['staveBounds'] = []
  renderer.boundsLookup?.finish()
  let cropX = 0
  let trailingStartX = Infinity
  for (const [systemId, system] of (renderer.boundsLookup?.staffSystems ?? []).entries()) {
    for (const bar of system.bars) {
      const measure = bar.index + 1
      if (measure < renderStart || measure > realRenderEnd) throw new Error('Renderer engraved outside requested window')
      if (measure < request.startMeasure) {
        // A leading padding bar — never shown, just note where the real
        // (requested) content actually begins so it can be cropped out below.
        const bounds = bar.lineAlignedBounds
        cropX = Math.max(cropX, bounds.x + bounds.w)
        continue
      }
      if (measure > endMeasure) {
        // A trailing padding bar — never shown, just note where the padding
        // region starts so everything from there can be trimmed off below.
        trailingStartX = Math.min(trailingStartX, bar.lineAlignedBounds.x)
        continue
      }
      const time = timing.find(t => t.measure === measure)
      if (!time) continue
      renderedMeasures.push(measure)
      const bounds = bar.lineAlignedBounds
      regions.push({ measure, timeSeconds: time.startSeconds, x: bounds.x, y: bounds.y, width: bounds.w, height: bounds.h })
      if (measure === request.startMeasure) {
        // One label per rendered track, taken from this page's first real
        // bar. Track set (and therefore each stave's vertical position) only
        // changes on scope change, never on a page turn, so this is stable
        // across the whole scope.
        indices.forEach((trackIndex, position) => {
          const barBounds = bar.bars[position]
          if (!barBounds) return
          const track = score.tracks[trackIndex]
          staveBounds.push({ name: track.name, shortName: track.shortName, y: barBounds.realBounds.y, height: barBounds.realBounds.h })
        })
      }
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
    // Shift the leading padding bar (and everything after it) left so the
    // requested page's first bar starts at x=0 as if it had been rendered
    // alone; score-adapter.ts's host clips anything left over at negative x.
    for (const region of regions) region.x -= cropX
    for (const anchor of anchors) anchor.x -= cropX
    for (const fragment of fragments) fragment.x -= cropX
    // staveBounds are y-only (vertical position of each stave); unaffected by a horizontal crop.
  }
  // Trailing padding needs no shifting (nothing sits to its right) — just
  // truncating the reported width at its start excludes it, since
  // score-adapter.ts sizes the host element (and .score-poc__notation clips)
  // to exactly this reported width.
  const trailingWidth = Number.isFinite(trailingStartX) ? Math.max(0, width - trailingStartX) : 0
  width = Math.max(0, width - cropX - trailingWidth)
  if (indices.length && (!anchors.length || !fragments.length)) throw new Error('Window has no usable rendering/anchors')
  const result: WindowResult = { type: 'window', generation: request.generation, window: { startMeasure: request.startMeasure, endMeasure },
    fragments, anchors, regions, width, height, stretchFactor, fontSize: settings.display.resources.engravingSettings.musicFontSize,
    tracks: indices.map(i => `${parts[i]}: ${score.tracks[i].name}`), staveBounds,
    staves: indices.reduce((sum, i) => sum + score.tracks[i].staves.length, 0), renderedMeasures: [...new Set(renderedMeasures)],
    renderMs, anchorsMs: performance.now() - anchorStart, measureMs, workerMs: performance.now() - start, thread: 'worker' }
  performance.measure(`score-worker-${request.generation}`, `score-worker-${request.generation}-start`)
  performance.clearMarks(); performance.clearMeasures()
  return result
}

// alphaTab has a documented, unresolved issue engraving arbitrary bar
// subsets: a tie or slur spanning several measures can reach past whatever
// lookback/lookahead padding a single extra bar provides and null-deref in
// its direction-calculation glyph code. A failed renderScore() call can also
// leave the shared renderer's internal layout caches in a half-updated state
// that visibly corrupts the *next* (otherwise successful) render — so any
// failure here discards and recreates the renderer before doing anything
// else, and retries once with a much smaller page (far less likely to
// contain a multi-measure tie reaching outside it) rather than immediately
// giving up and leaving a stale page on screen.
function render(request: WindowRequest) {
  // No single fixed padding amount has proven reliable everywhere in this
  // score (see maxTieOrSlurSpan's comment) — escalate both the padding and
  // how small a page is attempted across retries rather than giving up
  // after one alternate try.
  const attempts = [
    { maxMeasures: request.maxMeasures, pad: boundaryPad },
    { maxMeasures: Math.min(request.maxMeasures, 2), pad: boundaryPad },
    { maxMeasures: Math.min(request.maxMeasures, 2), pad: boundaryPad * 3 },
  ]
  for (const [index, attempt] of attempts.entries()) {
    try {
      reply(renderAttempt(request, attempt.maxMeasures, attempt.pad))
      return
    } catch (error) {
      renderer = createRenderer()
      if (index === attempts.length - 1) throw error
    }
  }
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
