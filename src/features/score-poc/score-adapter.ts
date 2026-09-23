import fontUrl from '@coderline/alphatab/font/Bravura.woff2?url'
import { scopeParts, scopeName, type ScoreScope } from './selection'
import { measureAt, needsWindow, resolveWindow, sameWindow, type MeasureTime, type ScoreWindow } from './score-window'
import { playheadAt } from './score-playhead'
import { ScoreRequests } from './score-requests'
import type { WindowRequest, WindowResult, WorkerResponse } from './score-protocol'

export type TransportSnapshot = { position: number; epoch: number; status: 'playing' | 'paused' }
type Request = Omit<WindowRequest, 'generation' | 'type'>
export type RenderMeasurement = {
  generation: number; scope: string; reason: string; window: ScoreWindow; workerMs: number; renderMs: number;
  anchorsMs: number; roundTripMs: number; commitMs: number; visibleMs: number; measures: number; staves: number; nodes: number; svgs: number;
}
export type ScoreDiagnostics = {
  status: string; moduleMs: number; fetchMs: number; parseMs: number; timingMs: number; firstWindowMs: number;
  bytes: number; scoreDuration: number; tracks: string[]; totalTracks: number; bars: number; window?: ScoreWindow;
  requestedWindow?: ScoreWindow; generation: number; committedGeneration: number; staleResults: number; workerMessages: number;
  svgCount: number; domCount: number; anchors: number; staves: number; phase: string; thread: string;
  failures: { generation: number; window?: ScoreWindow; message: string }[];
  transitions: RenderMeasurement[]; playheadFrameMs: number; playheadMaxMs: number; playheadFrames: number;
  logicalSeconds: number; playheadX: number | null; playheadSystem: number | null;
}

export class ScoreAdapter {
  private host: HTMLElement
  private scroller: HTMLElement
  private seek: (seconds: number) => void
  private readTransport: () => TransportSnapshot
  private worker?: Worker
  private font?: FontFace
  private requests: ScoreRequests<Request>
  private disposed = false
  private failed = false
  private ready = false
  private timing: MeasureTime[] = []
  private scope: ScoreScope = { level: 'orchestra' }
  private seconds = 0
  private epoch = -1
  private offset = 0
  private width = 760
  private viewport = { width: 760, height: 500 }
  // Uniform CSS scale currently applied to the sheet so its fixed-size
  // window (score-window.ts) fills the visible viewport on both axes,
  // shrinking or expanding as needed. Click/region matching needs this to
  // map visual pixels back to the natural coordinate space the worker's
  // regions/anchors are expressed in.
  private scale = 1
  private requestedWindow?: ScoreWindow
  private visible?: WindowResult
  private playhead: HTMLDivElement
  private frame = 0
  private commitFrame = 0
  private visibleFrame = 0
  private requestTimer = 0
  private resizeTimer = 0
  private timeout = 0
  private observer?: ResizeObserver
  private started = performance.now()
  private phases = [{ at: this.started, phase: 'initial' }]
  private sent = new Map<number, { at: number; scope: string; reason: string; window: ScoreWindow }>()
  private lastSystem = ''
  private frameTotal = 0
  private diagnostics: ScoreDiagnostics = {
    status: 'Starting score worker', moduleMs: 0, fetchMs: 0, parseMs: 0, timingMs: 0, firstWindowMs: 0,
    bytes: 0, scoreDuration: 0, tracks: [], totalTracks: 0, bars: 0, generation: 0, committedGeneration: 0,
    staleResults: 0, workerMessages: 0, svgCount: 0, domCount: 0, anchors: 0, staves: 0,
    phase: 'initial', thread: 'initializing', failures: [], transitions: [], playheadFrameMs: 0, playheadMaxMs: 0, playheadFrames: 0,
    logicalSeconds: 0, playheadX: null, playheadSystem: null,
  }
  constructor(host: HTMLElement, scroller: HTMLElement, seek: (seconds: number) => void, readTransport: () => TransportSnapshot) {
    this.host = host; this.scroller = scroller; this.seek = seek; this.readTransport = readTransport
    this.playhead = document.createElement('div')
    this.playhead.className = 'score-poc__playhead'
    this.playhead.setAttribute('aria-hidden', 'true')
    this.playhead.hidden = true
    this.requests = new ScoreRequests((generation, request) => {
      this.sent.set(generation, { at: performance.now(), scope: scopeName(this.scope), reason: request.reason, window: request.window })
      this.phases.push({ at: performance.now(), phase: request.reason })
      this.phases = this.phases.slice(-100)
      this.diagnostics.phase = request.reason
      this.diagnostics.workerMessages++
      // alphaTab's module also installs listeners expecting a cmd string; our
      // namespace lets those listeners ignore the coordinator's messages.
      this.worker?.postMessage({ ...request, cmd: 'atlasScore.render', type: 'render', generation })
      this.armTimeout()
    })
  }
  async initialize() {
    try {
      // Vite bundles this native module worker; alphaTab itself is imported only there.
      this.worker = new Worker(new URL('./score-runtime.worker.ts', import.meta.url), { type: 'module', name: 'atlas-score-runtime' })
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.receive(event.data)
      this.worker.onerror = event => { this.fail(`Score worker failed: ${event.message}`); this.worker?.terminate() }
      this.worker.onmessageerror = () => { this.fail('Score worker response could not be decoded'); this.worker?.terminate() }
      const font = new FontFace('AtlasScoreBravura', `url(${fontUrl})`)
      this.font = font
      await font.load()
      if (this.disposed || this.failed) return
      document.fonts.add(font)
      this.worker.postMessage({ cmd: 'atlasScore.initialize', type: 'initialize', url: new URL(`${import.meta.env.BASE_URL}audio/beethoven-7th-2nd/score/Beethoven_Op.92_2.musicxml`, location.origin).href })
      this.armTimeout()
      this.observer = new ResizeObserver(entries => {
        const bounds = entries[0].contentRect
        this.viewport.width = bounds.width; this.viewport.height = bounds.height
        // Rescale the already-committed sheet to the new viewport straight
        // away, independent of whether the request width below changes —
        // a height-only resize (e.g. rotating a device) has no effect on
        // the clamped request width but should still refit immediately.
        this.applyFit()
        const width = Math.max(760, Math.round(bounds.width))
        if (width === this.width) return
        this.width = width
        this.requests.invalidate()
        window.clearTimeout(this.resizeTimer)
        this.resizeTimer = window.setTimeout(() => {
          this.resizeTimer = 0
          this.requestWindow('resize', true)
        }, 180)
      })
      this.observer.observe(this.scroller)
      this.host.addEventListener('click', this.onScoreClick)
      this.frame = requestAnimationFrame(this.draw)
    } catch (error) { if (!this.disposed) this.fail(String(error)) }
  }
  private armTimeout() {
    window.clearTimeout(this.timeout)
    this.timeout = window.setTimeout(() => {
      this.fail('Score worker timed out. Reload the POC to retry; Atlas remains available.')
      this.worker?.terminate()
    }, 30000)
  }
  private fail(message: string) {
    this.failed = true
    window.clearTimeout(this.timeout)
    this.requests.invalidate()
    this.worker?.terminate()
    this.sent.clear()
    this.ready = false
    this.diagnostics.status = message
    this.diagnostics.phase = 'error'
  }
  private receive(message: WorkerResponse) {
    if (this.disposed) return
    window.clearTimeout(this.timeout)
    if (message.type === 'ready') {
      this.ready = true
      this.timing = message.timing
      Object.assign(this.diagnostics, { moduleMs: message.moduleMs, fetchMs: message.fetchMs, parseMs: message.parseMs,
        timingMs: message.timingMs, bytes: message.bytes, bars: message.timing.length,
        totalTracks: message.tracks, scoreDuration: message.duration, thread: message.thread })
      this.requestWindow('initial', true)
    } else if (message.type === 'error') {
      if (message.generation === undefined) this.fail(message.message)
      else {
        this.diagnostics.failures.push({ generation: message.generation, window: this.sent.get(message.generation)?.window, message: message.message })
        this.diagnostics.failures = this.diagnostics.failures.slice(-10)
        if (this.requests.isCurrent(message.generation)) {
          this.diagnostics.status = `Window failed: ${message.message.split('\n')[0]}`
          this.diagnostics.phase = 'error'
        } else this.diagnostics.staleResults++
        this.sent.delete(message.generation)
        this.requests.finish(message.generation)
      }
    } else {
      const sent = this.sent.get(message.generation)
      this.sent.delete(message.generation)
      const current = this.requests.isCurrent(message.generation)
      this.requests.finish(message.generation)
      if (!current || !sent) { this.diagnostics.staleResults++; return }
      const received = performance.now()
      // Build no DOM at all for stale results. Recheck when the presentation frame runs.
      cancelAnimationFrame(this.commitFrame)
      this.commitFrame = requestAnimationFrame(() => {
        if (this.disposed || !this.requests.isCurrent(message.generation)) { this.diagnostics.staleResults++; return }
        try {
          const start = performance.now()
          performance.mark('score-dom-commit-start')
          const sheet = document.createElement('div')
          sheet.className = 'score-poc__sheet'
          sheet.style.setProperty('--score-music-font-size', `${message.fontSize}px`)
          sheet.style.width = `${message.width}px`
          sheet.style.height = `${Math.max(100, message.height)}px`
          for (const fragment of message.fragments) {
            const part = document.createElement('div')
            part.style.cssText = `position:absolute;left:${fragment.x}px;top:${fragment.y}px;width:${fragment.width}px;height:${fragment.height}px`
            part.innerHTML = fragment.svg // renderer output from the fixed local fixture
            sheet.append(part)
          }
          sheet.append(this.playhead)
          this.host.replaceChildren(sheet)
          this.visible = message
          this.applyFit()
          this.lastSystem = ''
          Object.assign(this.diagnostics, { window: message.window, tracks: message.tracks, staves: message.staves,
            anchors: message.anchors.length, committedGeneration: message.generation,
            svgCount: sheet.querySelectorAll('svg').length, domCount: sheet.querySelectorAll('*').length,
            status: message.tracks.length ? 'Ready' : 'No score parts for this navigation scope', phase: 'idle' })
          this.phases.push({ at: performance.now(), phase: 'idle' })
          this.drawPlayhead()
          const measurement: RenderMeasurement = {
            generation: message.generation, scope: sent.scope, reason: sent.reason, window: message.window,
            workerMs: message.workerMs, renderMs: message.renderMs, anchorsMs: message.anchorsMs,
            roundTripMs: received - sent.at, commitMs: performance.now() - start, visibleMs: 0,
            measures: message.renderedMeasures.length, staves: message.staves,
            nodes: this.diagnostics.domCount, svgs: this.diagnostics.svgCount,
          }
          performance.measure('score-dom-commit', 'score-dom-commit-start')
          performance.clearMarks('score-dom-commit-start')
          performance.clearMeasures('score-dom-commit')
          this.diagnostics.transitions.push(measurement)
          this.diagnostics.transitions = this.diagnostics.transitions.slice(-30)
          cancelAnimationFrame(this.visibleFrame)
          this.visibleFrame = requestAnimationFrame(() => {
            measurement.visibleMs = performance.now() - sent.at
            if (!this.diagnostics.firstWindowMs) this.diagnostics.firstWindowMs = performance.now() - this.started
          })
        } catch (error) { this.fail(`Score presentation failed: ${String(error)}`) }
      })
    }
  }
  setScope(scope: ScoreScope) {
    if (scopeName(this.scope) === scopeName(scope)) return
    this.scope = scope
    this.requests.invalidate() // navigation invalidates immediately, dispatch follows map input
    this.requestedWindow = undefined
    this.scheduleRequest('scope')
  }
  setOffset(seconds: number) {
    if (this.offset === seconds) return
    this.offset = seconds
    this.requests.invalidate()
    this.requestedWindow = undefined
    this.scheduleRequest('offset')
  }
  setPosition(seconds: number, epoch: number) {
    this.seconds = seconds
    if (this.epoch !== epoch) {
      const initial = this.epoch < 0
      this.epoch = epoch
      if (!initial) {
        this.requests.invalidate()
        this.requestedWindow = undefined
        this.lastSystem = ''
        this.scheduleRequest('seek')
        return
      }
    }
    this.requestWindow('window')
  }
  private scheduleRequest(reason: string) {
    if (this.failed || this.disposed) return
    window.clearTimeout(this.requestTimer)
    this.diagnostics.status = 'Preparing score window; transport continues'
    this.requestTimer = window.setTimeout(() => {
      this.requestTimer = 0
      this.requestWindow(reason, true)
    }, reason === 'scope' ? 80 : 0)
  }
  private requestWindow(reason: string, force = false) {
    if (!this.ready || this.disposed || (!force && (this.requestTimer || this.resizeTimer))) return
    if (reason === 'resize') this.resizeTimer = 0
    const measure = measureAt(Math.max(0, this.seconds - this.offset), this.timing)
    if (!force && !needsWindow(measure, this.requestedWindow, this.timing.length)) return
    // Ordinary forward playback ("turning pages" once the cursor nears the
    // end of the rendered window) must never reveal already-passed measures
    // behind the cursor — the new window should start exactly at the
    // current measure. Deliberate seeks/scope changes keep the scope's
    // normal look-back budget, so the target measure isn't always pinned to
    // the window's very first column.
    const window = resolveWindow(measure, this.scope, this.timing.length, reason === 'window' ? 0 : undefined)
    if (!force && sameWindow(this.requestedWindow, window)) return
    this.requestedWindow = window
    this.diagnostics.requestedWindow = window
    this.diagnostics.status = 'Preparing score window; previous window retained'
    this.requests.request({ window, partIds: scopeParts(this.scope), width: this.width, reason })
  }
  // Each window renders a fixed, small number of measures (score-window.ts)
  // laid out in one horizontal row (settings.display.layoutMode = Horizontal
  // in the worker), rather than a large scrollable span. So instead of only
  // shrinking to fit height, scale uniformly by whichever axis is tighter —
  // shrinking or expanding as needed — so the window always fills the
  // container on both axes with no scrolling required. Re-runs on every
  // resize (not just new worker windows), so e.g. a height-only resize
  // rescales the current sheet immediately rather than waiting on a fresh
  // render.
  private applyFit() {
    const sheet = this.host.firstElementChild as HTMLElement | null
    if (!this.visible || !sheet) return
    const naturalWidth = Math.max(1, this.visible.width)
    const naturalHeight = Math.max(100, this.visible.height)
    this.scale = Math.min(
      this.viewport.width > 0 ? this.viewport.width / naturalWidth : 1,
      this.viewport.height > 0 ? this.viewport.height / naturalHeight : 1,
    )
    sheet.style.transformOrigin = 'top left'
    sheet.style.transform = this.scale !== 1 ? `scale(${this.scale})` : ''
    this.host.style.width = `${naturalWidth * this.scale}px`
    this.host.style.height = `${naturalHeight * this.scale}px`
  }
  private onScoreClick = (event: MouseEvent) => {
    if (!this.visible) return
    const rect = this.host.getBoundingClientRect() // input-only read, never animation frame
    // Regions are in the sheet's natural (unscaled) coordinate space; the
    // click lands in visual/scaled pixels, so convert back before matching.
    const x = (event.clientX - rect.left) / this.scale, y = (event.clientY - rect.top) / this.scale
    const region = this.visible.regions.find(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height)
    if (region) this.seek(Math.max(0, region.timeSeconds + this.offset))
  }
  private drawPlayhead() {
    const transport = this.readTransport()
    this.diagnostics.logicalSeconds = transport.position
    const point = this.visible ? playheadAt(Math.min(this.diagnostics.scoreDuration, Math.max(0, transport.position - this.offset)), this.visible.anchors) : null
    this.playhead.hidden = !point
    this.diagnostics.playheadX = point?.x ?? null
    this.diagnostics.playheadSystem = point?.systemId ?? null
    if (!point) return
    this.playhead.style.transform = `translate3d(${point.x}px, ${point.y}px, 0)`
    // Every window now fits entirely inside the viewport on both axes
    // (applyFit), so there's nothing to scroll to — just keep the
    // playhead's own height in sync when the current system changes.
    const system = `${this.visible!.generation}:${point.systemId}`
    if (system !== this.lastSystem) {
      this.playhead.style.height = `${point.height}px`
      this.lastSystem = system
    }
  }
  private draw = () => {
    if (this.disposed) return
    const start = performance.now()
    this.drawPlayhead()
    const cost = performance.now() - start
    this.diagnostics.playheadFrames++
    this.frameTotal += cost
    this.diagnostics.playheadFrameMs = this.frameTotal / this.diagnostics.playheadFrames
    this.diagnostics.playheadMaxMs = Math.max(this.diagnostics.playheadMaxMs, cost)
    this.frame = requestAnimationFrame(this.draw)
  }
  phaseAt(at: number) { return this.phases.findLast(mark => mark.at <= at)?.phase ?? 'initial' }
  snapshot(): ScoreDiagnostics {
    return { ...this.diagnostics, generation: this.requests.generation, failures: [...this.diagnostics.failures], transitions: [...this.diagnostics.transitions] }
  }
  dispose() {
    this.disposed = true
    this.requests.invalidate()
    this.worker?.terminate()
    if (this.font) document.fonts.delete(this.font)
    this.observer?.disconnect()
    window.clearTimeout(this.timeout); window.clearTimeout(this.requestTimer); window.clearTimeout(this.resizeTimer)
    cancelAnimationFrame(this.frame); cancelAnimationFrame(this.commitFrame); cancelAnimationFrame(this.visibleFrame)
    this.host.removeEventListener('click', this.onScoreClick)
    this.host.replaceChildren()
  }
}
