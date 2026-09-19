import type { ExcerptDefinition } from '../excerpt'
import { createChunkScheduler } from '../chunk-scheduler'
import { START_LEAD } from '../playback-transition'
import {
  chunkIndexAt, chunkOffsetAt, clampLogicalTime, createGeneration,
  logicalFromOrigin, originFromStart, type ChunkManifest,
} from './transport'

export type ChunkPlaybackSnapshot = {
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
  playing: boolean
  position: number
  duration: number
  chunkIndex: number
  chunkOffset: number
  stemCount: number
  stems: readonly string[]
  loadedChunks: number[]
  scheduledChunks: number[]
  bufferCount: number
  pcmBytes: number
  lastFetchMs: number
  lastDecodeMs: number
  lateSchedules: number
}

export function createChunkPlaybackEngine() {
  const scheduler = createChunkScheduler()
  const generation = createGeneration()
  const listeners = new Set<() => void>()

  let context: AudioContext | null = null
  let master: GainNode | null = null
  let manifest: ChunkManifest | null = null
  let stems: string[] = []
  let status: ChunkPlaybackSnapshot['status'] = 'idle'
  let error: string | undefined
  let playing = false
  let position = 0
  let origin = 0
  let seekHold: number | null = null
  let frame = 0

  const emit = () => {
    for (const listener of listeners) listener()
  }

  const duration = () => manifest?.duration ?? 0

  const logicalTime = () => {
    if (seekHold !== null) return seekHold
    if (!playing || !context || !manifest) return position
    return logicalFromOrigin(context.currentTime, origin, manifest.duration)
  }

  const ensureContext = () => {
    if (context) return context
    const Ctor = globalThis.AudioContext
    if (typeof Ctor === 'function') {
      context = new Ctor()
    } else {
      throw new Error('AudioContext is unavailable')
    }
    master = context.createGain()
    master.connect(context.destination)
    scheduler.attach(context, master)
    return context
  }

  const ensureWindow = async (time: number, token: number) => {
    await scheduler.prepare(stems, time)
    if (!generation.isCurrent(token)) return
    scheduler.prune(stems, logicalTime())
  }

  const tick = () => {
    frame = 0
    if (!playing || !manifest) return
    const token = generation.current()
    const time = logicalTime()
    position = time
    if (time >= manifest.duration) {
      playing = false
      position = manifest.duration
      scheduler.stopSources()
      emit()
      return
    }
    void ensureWindow(time, token).then(() => {
      if (!generation.isCurrent(token) || !playing) return
      for (const stemId of stems) scheduler.setStemGain(stemId, 1, context?.currentTime ?? 0, 0.001)
      scheduler.scheduleWindow(stems, origin, logicalTime(), true)
    }).then(emit)
    emit()
    frame = requestAnimationFrame(tick)
  }

  const begin = async (token: number) => {
    if (!manifest) return
    const ctx = ensureContext()
    await ctx.resume()
    if (!generation.isCurrent(token)) return
    await ensureWindow(position, token)
    if (!generation.isCurrent(token) || !playing) return
    const startAt = ctx.currentTime + START_LEAD
    origin = originFromStart(position, startAt)
    seekHold = null
    scheduler.stopSources()
    for (const stemId of stems) scheduler.setStemGain(stemId, 1, startAt, 0.001)
    scheduler.scheduleWindow(stems, origin, position, true)
    if (!frame) frame = requestAnimationFrame(tick)
    emit()
  }

  return {
    async load(nextExcerpt: ExcerptDefinition) {
      status = 'loading'
      error = undefined
      emit()
      try {
        ensureContext()
        manifest = await scheduler.loadManifest(nextExcerpt)
        status = 'ready'
        position = 0
      } catch (caught) {
        status = 'error'
        error = caught instanceof Error ? caught.message : String(caught)
      }
      emit()
    },
    setStems(next: readonly string[]) {
      const token = generation.next()
      stems = [...next]
      scheduler.stopSources()
      if (playing) void begin(token)
      emit()
    },
    play() {
      if (status !== 'ready' || !manifest) return
      if (position >= manifest.duration) position = 0
      playing = true
      void begin(generation.next())
    },
    pause() {
      if (!playing) return
      position = logicalTime()
      playing = false
      generation.next()
      scheduler.stopSources()
      cancelAnimationFrame(frame)
      frame = 0
      emit()
    },
    seek(next: number) {
      if (!manifest) return
      const token = generation.next()
      position = clampLogicalTime(next, manifest.duration)
      seekHold = playing ? position : null
      scheduler.stopSources()
      cancelAnimationFrame(frame)
      frame = 0
      emit()
      if (playing) void begin(token)
      else void ensureWindow(position, token)
    },
    snapshot(): ChunkPlaybackSnapshot {
      const time = logicalTime()
      return {
        status,
        error,
        playing,
        position: time,
        duration: duration(),
        chunkIndex: manifest ? chunkIndexAt(time, manifest) : 0,
        chunkOffset: manifest ? chunkOffsetAt(time, manifest) : 0,
        stemCount: stems.length,
        stems,
        ...scheduler.diagnostics(),
      }
    },
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    dispose() {
      playing = false
      generation.next()
      cancelAnimationFrame(frame)
      frame = 0
      scheduler.dispose()
      listeners.clear()
      void context?.close()
      context = null
      master = null
    },
  }
}

export type ChunkPlaybackEngine = ReturnType<typeof createChunkPlaybackEngine>
