import type * as AlphaTab from '@coderline/alphatab'
import fontUrl from '@coderline/alphatab/font/Bravura.woff2?url'
import { allPartIds, scopeParts, scopeName, type ScoreScope } from './selection'

const scoreUrl = `${import.meta.env.BASE_URL}audio/beethoven-7th-2nd/score/Beethoven_Op.92_2.musicxml`
export type ScoreDiagnostics = {
  version: string; status: string; moduleMs: number; fetchMs: number; bytes: number;
  firstRenderMs: number; fullRenderMs: number; tracks: string[]; totalTracks: number; bars: number;
  scoreSeconds: number; logicalSeconds: number; scoreDuration: number; svgCount: number; domCount: number;
  transitions: { from: string; to: string; ms: number }[];
}
export class ScoreAdapter {
  private api?: AlphaTab.AlphaTabApi
  private disposed = false
  private parts: string[] = []
  private scope: ScoreScope = { level: 'orchestra' }
  private offset = 0
  private seconds = 0
  private started = performance.now()
  private renderStarted = this.started
  private renderFrom = 'Initial'
  private initial = true
  private scopeRenderPending = false
  private division = 960
  private follow = true
  private scrollModes?: typeof AlphaTab.ScrollMode
  private diagnostics: ScoreDiagnostics = {
    version: '1.8.4', status: 'Loading alphaTab', moduleMs: 0, fetchMs: 0, bytes: 0,
    firstRenderMs: 0, fullRenderMs: 0, tracks: [], totalTracks: 0, bars: 0,
    scoreSeconds: 0, logicalSeconds: 0, scoreDuration: 0, svgCount: 0, domCount: 0, transitions: [],
  }
  private host: HTMLElement
  private scroller: HTMLElement
  private report: (data: ScoreDiagnostics) => void
  private seek: (seconds: number) => void
  constructor(host: HTMLElement, scroller: HTMLElement,
    report: (data: ScoreDiagnostics) => void, seek: (seconds: number) => void) {
    this.host = host; this.scroller = scroller; this.report = report; this.seek = seek
  }
  private publish() { this.report({ ...this.diagnostics, transitions: [...this.diagnostics.transitions] }) }
  async initialize(signal: AbortSignal) {
    const started = performance.now()
    const at = await import('@coderline/alphatab')
    this.scrollModes = at.ScrollMode
    this.diagnostics.moduleMs = performance.now() - started
    if (this.disposed) return
    this.diagnostics.status = 'Fetching MusicXML'
    this.publish()
    const fetchStart = performance.now()
    const response = await fetch(scoreUrl, { signal })
    if (!response.ok) throw new Error(`MusicXML HTTP ${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    this.diagnostics.fetchMs = performance.now() - fetchStart
    this.diagnostics.bytes = bytes.byteLength
    if (this.disposed) return
    const xml = new DOMParser().parseFromString(new TextDecoder().decode(bytes), 'application/xml')
    this.parts = [...xml.querySelectorAll('part-list > score-part')].map(part => part.id)
    if (this.parts.join(',') !== allPartIds.join(',')) throw new Error('Unexpected MusicXML part IDs/order; review explicit mapping.')
    const api = new at.AlphaTabApi(this.host, {
      core: { useWorkers: false, engine: 'svg', enableLazyLoading: true,
        smuflFontSources: new Map([[at.FontFileFormat.Woff2, fontUrl]]) },
      display: { scale: 1, layoutMode: at.LayoutMode.Page },
      player: { playerMode: at.PlayerMode.EnabledExternalMedia, enableCursor: true,
        enableUserInteraction: false, enableAnimatedBeatCursor: false, scrollElement: this.scroller,
        scrollMode: this.follow ? at.ScrollMode.OffScreen : at.ScrollMode.Off, scrollSpeed: 0, nativeBrowserSmoothScroll: false },
    })
    this.api = api
    api.error.on(error => { this.diagnostics.status = String(error); this.publish() })
    api.scoreLoaded.on(score => {
      if (score.tracks.length !== this.parts.length) throw new Error('alphaTab track count differs from MusicXML part list.')
      // alphaTab 1.8.4 creates tracks in score-part order but does not expose XML IDs.
      this.diagnostics.totalTracks = score.tracks.length
      this.diagnostics.bars = score.masterBars.length
    })
    api.midiLoad.on(file => { this.division = file.division })
    api.midiLoaded.on(event => {
      this.diagnostics.scoreDuration = event.endTime / 1000
      // Explicit identity mapping: no automatic duration stretching to the recording.
      api.player?.updateSyncPoints([])
      this.setPosition(this.seconds)
    })
    api.renderer.partialRenderFinished.on(() => {
      if (!this.diagnostics.firstRenderMs) {
        this.diagnostics.firstRenderMs = performance.now() - this.started
        this.publish()
      }
    })
    api.postRenderFinished.on(() => {
      if (this.disposed) return
      const elapsed = performance.now() - this.renderStarted
      if (this.initial) {
        this.diagnostics.fullRenderMs = performance.now() - this.started
        this.initial = false
      } else if (this.scopeRenderPending) {
        this.diagnostics.transitions.push({ from: this.renderFrom, to: scopeName(this.scope), ms: elapsed })
        this.diagnostics.transitions = this.diagnostics.transitions.slice(-20)
      }
      this.scopeRenderPending = false
      const empty = scopeParts(this.scope).length === 0
      this.host.hidden = empty
      this.diagnostics.status = empty ? 'No parts for this navigation scope in this score' : 'Ready (layout complete; visible pages rendered lazily)'
      this.diagnostics.svgCount = this.host.querySelectorAll('svg').length
      this.diagnostics.domCount = this.host.querySelectorAll('*').length
      this.diagnostics.tracks = empty ? [] : api.tracks.map(track => `${this.parts[track.index]}: ${track.name}`)
      this.setPosition(this.seconds)
      this.publish()
    })
    api.beatMouseDown.on(beat => {
      const lookup = api.tickCache
      if (!lookup) return
      // Measure-level seek: first occurrence if a measure is repeated.
      const target = lookup.getMasterBarStart(beat.voice.bar.masterBar)
      let tick = 0, seconds = 0, tempo = api.score?.tempo ?? 120
      for (const bar of lookup.masterBars) {
        for (const change of bar.tempoChanges) {
          if (change.tick > target) break
          seconds += (change.tick - tick) * 60 / (tempo * this.division)
          tick = change.tick
          tempo = change.tempo
        }
        if (bar.end >= target) break
      }
      seconds += (target - tick) * 60 / (tempo * this.division)
      this.seek(Math.max(0, seconds + this.offset))
    })
    this.diagnostics.status = 'Importing and rendering'
    this.publish()
    api.load(bytes, scopeParts(this.scope).map(id => this.parts.indexOf(id)))
  }
  setScope(scope: ScoreScope) {
    this.renderFrom = scopeName(this.scope)
    this.scope = scope
    const api = this.api
    if (!api?.score) return
    const indices = scopeParts(scope).map(id => this.parts.indexOf(id))
    if (!indices.length) {
      this.host.hidden = true
      this.diagnostics.tracks = []
      this.diagnostics.status = 'No parts for this navigation scope in this score'
      this.publish()
      return
    }
    this.host.hidden = false
    this.scopeRenderPending = true
    this.renderStarted = performance.now()
    this.diagnostics.status = 'Rendering scope'
    this.publish()
    api.renderTracks(indices.map(index => api.score!.tracks[index]))
  }
  setOffset(seconds: number) { this.offset = seconds; this.setPosition(this.seconds) }
  setFollow(follow: boolean) {
    this.follow = follow
    if (this.api && this.scrollModes) {
      this.api.settings.player.scrollMode = follow ? this.scrollModes.OffScreen : this.scrollModes.Off
      this.api.updateSettings()
    }
  }
  setPosition(seconds: number) {
    this.seconds = seconds
    const api = this.api
    if (!api?.player?.isReadyForPlayback) return
    const ms = Math.min(this.diagnostics.scoreDuration, Math.max(0, seconds - this.offset)) * 1000
    // External output takes milliseconds and creates no audio output or clock.
    const output = api.player.output as AlphaTab.synth.IExternalMediaSynthOutput
    if (ms < api.timePosition || Math.abs(ms - api.timePosition) > 1000) api.timePosition = ms
    output.updatePosition(ms)
    this.diagnostics.logicalSeconds = seconds
    this.diagnostics.scoreSeconds = api.timePosition / 1000
    if (this.follow) api.scrollToCursor()
  }
  snapshot() {
    this.diagnostics.svgCount = this.host.querySelectorAll('svg').length
    this.diagnostics.domCount = this.host.querySelectorAll('*').length
    return { ...this.diagnostics }
  }
  dispose() { this.disposed = true; this.api?.destroy(); this.host.replaceChildren() }
}
