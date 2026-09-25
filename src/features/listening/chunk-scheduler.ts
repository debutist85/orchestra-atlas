import type { ExcerptDefinition } from './excerpt'
import { bufferBytes, chunkUrl, fetchChunkManifest } from './chunk-playback/assets'
import {
  chunkIndexAt, chunkLogicalDuration, chunkStartTime,
  contextTimeForLogical, preloadWindow, type ChunkManifest,
} from './chunk-playback/transport'
import { HANDOFF_SECONDS } from './playback-transition'

export { HANDOFF_SECONDS, START_LEAD } from './playback-transition'

type LoadEntry = { buffer: AudioBuffer; fetchMs: number; decodeMs: number }

export function createChunkScheduler() {
  let context: AudioContext | undefined
  let output: AudioNode | undefined
  let excerpt: ExcerptDefinition | undefined
  let manifest: ChunkManifest | null = null
  const buffers = new Map<string, LoadEntry>()
  const inflight = new Map<string, Promise<LoadEntry>>()
  const sources = new Map<string, AudioBufferSourceNode>()
  const stemGains = new Map<string, GainNode>()
  const wanted = new Set<string>()
  let lastFetchMs = 0
  let lastDecodeMs = 0
  let lateSchedules = 0
  let lastReadyKey: string | null = null
  let lastPrunedKey: string | null = null

  const bufferKey = (stemId: string, index: number) => `${stemId}:${index}`
  // Non-focused stems still get "current + next chunk" kept warm — a cheap
  // ongoing runway so zooming into any family finds its start already
  // loaded, without pulling in as much as the full preloadWindow a focused
  // selection gets.
  const lightWindow = (index: number, chunkCount: number) => index + 1 < chunkCount ? [index, index + 1] : [index]

  // Without this, a navigation burst fires every wanted (stem, chunk) pair's
  // fetch+decode at once — up to chunks × stems, e.g. 32 for an 8-stem
  // family — and their near-simultaneous completions drive a synchronous
  // burst of AudioBufferSourceNode creation that can blow a frame budget.
  // Capping concurrency here staggers when they resolve instead.
  const MAX_CONCURRENT_LOADS = 4
  let activeLoads = 0
  const loadQueue: (() => void)[] = []
  const acquireSlot = () => new Promise<void>(resolve => {
    if (activeLoads < MAX_CONCURRENT_LOADS) { activeLoads += 1; resolve() }
    else loadQueue.push(() => { activeLoads += 1; resolve() })
  })
  const releaseSlot = () => {
    activeLoads -= 1
    loadQueue.shift()?.()
  }

  const stemGain = (stemId: string) => {
    let gain = stemGains.get(stemId)
    if (!gain && context && output) {
      gain = context.createGain()
      gain.gain.value = 0
      gain.connect(output)
      stemGains.set(stemId, gain)
    }
    return gain
  }

  const loadOne = (stemId: string, index: number) => {
    if (!excerpt || !manifest || !context) throw new Error('Chunk scheduler is not attached')
    const key = bufferKey(stemId, index)
    const have = buffers.get(key)
    if (have) return Promise.resolve(have)
    const pending = inflight.get(key)
    if (pending) return pending
    const ctx = context
    const work = (async () => {
      await acquireSlot()
      try {
        const url = chunkUrl(excerpt!, stemId, index)
        const fetchStart = performance.now()
        const response = await fetch(url)
        const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
        const isAudio = type.startsWith('audio/') || type === 'application/ogg'
        if (!response.ok || !isAudio) throw new Error(`Missing chunk ${url}`)
        const data = await response.arrayBuffer()
        const fetchMs = performance.now() - fetchStart
        const decodeStart = performance.now()
        const buffer = await ctx.decodeAudioData(data.slice(0))
        const decodeMs = performance.now() - decodeStart
        lastFetchMs = fetchMs
        lastDecodeMs = decodeMs
        const entry = { buffer, fetchMs, decodeMs }
        if (wanted.has(key)) buffers.set(key, entry)
        return entry
      } finally {
        releaseSlot()
      }
    })()
    inflight.set(key, work)
    return work.finally(() => {
      if (inflight.get(key) === work) inflight.delete(key)
    })
  }

  return {
    attach(nextContext: AudioContext, nextOutput: AudioNode) {
      context = nextContext
      output = nextOutput
    },
    async loadManifest(nextExcerpt: ExcerptDefinition) {
      excerpt = nextExcerpt
      manifest = await fetchChunkManifest(nextExcerpt)
      return manifest
    },
    manifest: () => manifest,
    // Continuous, mode-independent preload: every stem in the catalog stays
    // at least lightly warm (current + next chunk), while whichever stems
    // are actually focused get the full look-ahead preloadWindow. Called
    // every animation frame while playing (see listening-engine's tick()),
    // regardless of navigation level, so once a window is fully decoded,
    // skip re-flatMapping and re-awaiting already-resolved promises on every
    // one of those frames — a plain cache check is far cheaper than
    // reconstructing that work.
    async prepare(focusedStems: readonly string[], time: number) {
      if (!manifest) return
      const index = chunkIndexAt(time, manifest)
      const focusSet = new Set(focusedStems)
      const pairs = manifest.stems.flatMap(stemId => {
        const chunks = focusSet.has(stemId)
          ? preloadWindow(index, manifest!.chunkCount)
          : lightWindow(index, manifest!.chunkCount)
        return chunks.map(chunk => ({ stemId, chunk }))
      })
      for (const { stemId, chunk } of pairs) wanted.add(bufferKey(stemId, chunk))
      const signature = `${index}|${focusedStems.join(',')}`
      const satisfied = () => pairs.every(({ stemId, chunk }) => buffers.has(bufferKey(stemId, chunk)))
      if (signature === lastReadyKey && satisfied()) return
      await Promise.all(pairs.map(({ stemId, chunk }) => loadOne(stemId, chunk)))
      lastReadyKey = satisfied() ? signature : null
    },
    scheduleChunk(
      stems: readonly string[],
      index: number,
      origin: number,
      logicalTime: number,
      playing: boolean,
    ) {
      if (!context || !manifest || !playing) return
      const startLogical = chunkStartTime(index, manifest)
      const logicalDuration = chunkLogicalDuration(index, manifest)
      if (logicalDuration <= 0) return
      const offset = Math.max(0, logicalTime - startLogical)
      if (offset >= logicalDuration) return
      let when = contextTimeForLogical(startLogical + offset, origin)
      let sourceOffset = offset
      if (when < context.currentTime) {
        const late = context.currentTime - when
        lateSchedules += 1
        when = context.currentTime
        sourceOffset += late
        if (sourceOffset >= logicalDuration) return
      }
      for (const stemId of stems) {
        const key = bufferKey(stemId, index)
        if (sources.has(key)) continue
        const entry = buffers.get(key)
        const gain = stemGain(stemId)
        if (!entry || !gain) continue
        const source = context.createBufferSource()
        source.buffer = entry.buffer
        source.connect(gain)
        // Without an explicit duration, a source plays its whole decoded
        // buffer — but Opus's own frame/pre-skip handling means a chunk's
        // decoded length isn't guaranteed to exactly match its nominal
        // logicalDuration slot. Any mismatch left adjacent chunks either
        // overlapping (summing to a sudden loudness spike) or gapped (a
        // sudden drop) at every chunk boundary, audible as erratic,
        // "random" volume jumps. Clipping to the chunk's own slot makes
        // consecutive chunks meet exactly, with neither gap nor overlap.
        source.start(when, sourceOffset, logicalDuration - sourceOffset)
        sources.set(key, source)
      }
    },
    scheduleWindow(stems: readonly string[], origin: number, logicalTime: number, playing: boolean) {
      if (!manifest || !playing) return
      const index = chunkIndexAt(logicalTime, manifest)
      this.scheduleChunk(stems, index, origin, logicalTime, playing)
      if (index + 1 < manifest.chunkCount) {
        this.scheduleChunk(stems, index + 1, origin, logicalTime, playing)
      }
    },
    hasScheduled(stemId: string, index: number) {
      return sources.has(bufferKey(stemId, index))
    },
    stopSources(stemIds?: readonly string[]) {
      const allow = stemIds ? new Set(stemIds) : undefined
      for (const [key, source] of sources) {
        const stemId = key.slice(0, key.lastIndexOf(':'))
        if (allow && !allow.has(stemId)) continue
        try { source.stop() } catch { /* already stopped */ }
        sources.delete(key)
      }
    },
    prune(focusedStems: readonly string[], time: number) {
      if (!manifest) return
      const index = chunkIndexAt(time, manifest)
      // Runs every animation frame now (see listening-engine's tick()), same
      // as prepare() — skip the rebuild/scan when the window hasn't actually
      // moved. `wanted` stays correct either way: prepare() repopulates it
      // for the current window on every call regardless of its own fast
      // path, so there's nothing left for an unchanged prune() to evict.
      const signature = `${index}|${focusedStems.join(',')}`
      if (signature === lastPrunedKey) return
      lastPrunedKey = signature
      const focusSet = new Set(focusedStems)
      const focusChunks = new Set(preloadWindow(index, manifest.chunkCount))
      const lightChunks = new Set(lightWindow(index, manifest.chunkCount))
      wanted.clear()
      for (const stemId of manifest.stems) {
        for (const chunk of focusSet.has(stemId) ? focusChunks : lightChunks) wanted.add(bufferKey(stemId, chunk))
      }
      for (const key of buffers.keys()) {
        const split = key.lastIndexOf(':')
        const stemId = key.slice(0, split)
        const chunk = Number(key.slice(split + 1))
        const keep = focusSet.has(stemId) ? focusChunks : lightChunks
        if (!keep.has(chunk)) buffers.delete(key)
      }
      // Only focused stems ever have scheduled sources in the first place,
      // so stopping/evicting sources still only concerns them.
      for (const [key, source] of sources) {
        const split = key.lastIndexOf(':')
        const stemId = key.slice(0, split)
        const chunk = Number(key.slice(split + 1))
        if (!focusSet.has(stemId) || chunk < index - 1) {
          try { source.stop() } catch { /* already stopped */ }
          sources.delete(key)
        }
      }
    },
    setStemGain(stemId: string, value: number, when: number, seconds = HANDOFF_SECONDS) {
      const gain = stemGain(stemId)
      if (!gain || !context) return
      const start = Math.max(when, context.currentTime)
      gain.gain.cancelScheduledValues(start)
      gain.gain.setValueAtTime(gain.gain.value, start)
      gain.gain.linearRampToValueAtTime(value, start + seconds)
    },
    diagnostics() {
      const loaded = new Set<number>()
      let pcmBytes = 0
      for (const [key, entry] of buffers) {
        loaded.add(Number(key.slice(key.lastIndexOf(':') + 1)))
        pcmBytes += bufferBytes(entry.buffer)
      }
      const scheduled = [...new Set([...sources.keys()].map(key => Number(key.slice(key.lastIndexOf(':') + 1))))]
        .sort((a, b) => a - b)
      return {
        loadedChunks: [...loaded].sort((a, b) => a - b),
        scheduledChunks: scheduled,
        bufferCount: buffers.size,
        pcmBytes,
        lastFetchMs,
        lastDecodeMs,
        lateSchedules,
      }
    },
    dispose() {
      this.stopSources()
      buffers.clear()
      inflight.clear()
      wanted.clear()
      stemGains.clear()
      context = undefined
      output = undefined
    },
  }
}

export type ChunkScheduler = ReturnType<typeof createChunkScheduler>
