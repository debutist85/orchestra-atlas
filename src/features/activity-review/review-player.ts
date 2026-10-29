// The source and onset clicks are scheduled on one AudioContext, never by media-element timers.
export class ReviewPlayer {
  private context: AudioContext | null = null
  private source: AudioBufferSourceNode | null = null
  private gain: GainNode | null = null
  private clicks = new Set<AudioBufferSourceNode>()
  private timer: ReturnType<typeof setInterval> | null = null
  private origin = 0
  private held = 0
  private end = 0
  private range: [number, number] | null = null
  private events: number[] = []
  private cursor = 0
  private cycle = 0
  private clickBuffer: AudioBuffer | null = null
  private token = 0
  running = false

  get position() {
    if (!this.running || !this.context) return this.held
    const elapsed = Math.max(0, this.context.currentTime - this.origin - (this.context.outputLatency || this.context.baseLatency || 0))
    if (this.range) return this.range[0] + elapsed % (this.range[1] - this.range[0])
    return Math.min(this.end, elapsed)
  }

  async play(buffer: AudioBuffer, events: number[], offset: number, loop: [number, number] | null, markers: boolean, markersOnly: boolean) {
    this.pause()
    const token = ++this.token
    this.context ??= new AudioContext()
    const context = this.context
    await context.resume()
    if (token !== this.token) return
    this.range = loop; this.end = buffer.duration
    const from = loop ? Math.max(loop[0], Math.min(offset, loop[1] - .001)) : Math.min(offset, Math.max(0, buffer.duration - .001))
    const when = context.currentTime + .04
    this.origin = when - (loop ? from - loop[0] : from)
    this.source = context.createBufferSource(); this.source.buffer = buffer
    this.gain = context.createGain(); this.gain.gain.value = markersOnly ? 0 : .8
    this.source.connect(this.gain).connect(context.destination)
    if (loop) { this.source.loop = true; this.source.loopStart = loop[0]; this.source.loopEnd = loop[1] }
    this.source.onended = () => { if (!loop && this.running) { this.held = buffer.duration; this.running = false; this.stopNodes() } }
    this.source.start(when, from)
    this.running = true
    this.events = markers ? events.filter(time => time >= (loop?.[0] ?? 0) && time < (loop?.[1] ?? buffer.duration)).sort((a, b) => a - b) : []
    const first = this.events.findIndex(time => time >= from)
    this.cursor = first < 0 ? this.events.length : first; this.cycle = 0
    if (!this.clickBuffer || this.clickBuffer.sampleRate !== context.sampleRate) {
      this.clickBuffer = context.createBuffer(1, Math.round(context.sampleRate * .018), context.sampleRate)
      const samples = this.clickBuffer.getChannelData(0)
      for (let i = 0; i < samples.length; i++) samples[i] = Math.sin(2 * Math.PI * 1500 * i / context.sampleRate) * .12 * Math.exp(-i / (context.sampleRate * .003))
    }
    const schedule = () => {
      if (!this.running || !this.events.length) return
      const horizon = context.currentTime + .2
      for (let guard = 0; guard < 1000; guard++) {
        if (this.cursor >= this.events.length) {
          if (!loop) return
          this.cursor = 0; this.cycle++
        }
        const eventTime = this.origin + (this.events[this.cursor] - (loop?.[0] ?? 0)) + this.cycle * (loop ? loop[1] - loop[0] : 0)
        if (eventTime > horizon) return
        this.cursor++
        if (eventTime < when || eventTime < context.currentTime) continue
        const click = context.createBufferSource(); click.buffer = this.clickBuffer
        click.connect(context.destination); this.clicks.add(click)
        click.onended = () => { click.disconnect(); this.clicks.delete(click) }
        click.start(eventTime)
      }
    }
    schedule(); this.timer = setInterval(schedule, 25)
  }

  private stopNodes() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    if (this.source) { this.source.onended = null; try { this.source.stop() } catch { /* Already ended. */ } this.source.disconnect() }
    this.source = null; this.gain?.disconnect(); this.gain = null
    for (const click of this.clicks) { try { click.stop() } catch { /* Already ended. */ } click.disconnect() }
    this.clicks.clear()
  }
  pause() { this.token++; this.held = this.position; this.running = false; this.stopNodes() }
  seek(position: number) { this.pause(); this.held = Math.max(0, position) }
  dispose() { this.pause(); void this.context?.close(); this.context = null }
}
