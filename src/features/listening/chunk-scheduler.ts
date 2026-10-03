import type { ExcerptDefinition } from './excerpt'
import { chunkIsAudible, type ActivityChunkMask } from './activity-profile'
import { speculativeStemIds } from './playback-plan'
import { bufferBytes, chunkUrl, fetchChunkManifest } from './chunk-playback/assets'
import {
  chunkIndexAt, chunkLogicalDuration, chunkOffsetAt, chunkStartTime,
  contextTimeForLogical, preloadWindow, type ChunkManifest,
} from './chunk-playback/transport'
import { HANDOFF_SECONDS } from './playback-transition'

export { HANDOFF_SECONDS, START_LEAD } from './playback-transition'

type LoadEntry = { buffer: AudioBuffer; fetchMs: number; decodeMs: number }
type LoadSlot = { key: string; priority: number; resolve: (active: boolean) => void }

const MAX_CONCURRENT_LOADS = 4
const MAX_BACKGROUND_PCM_BYTES = 24 * 1024 * 1024
// Opus chunks decode to 48 kHz stereo. A nominal 15 s chunk is the unit the
// background budget can hold, so speculation is planned in whole chunks.
const DECODED_CHUNK_BYTES = 15 * 48_000 * 2 * 4
const MAX_BACKGROUND_STEMS = 8
const FOCUS_FULL_WINDOW_STEM_LIMIT = 2
// The following chunk joins the playback gate only when the playhead is this
// close to it. Farther away, it keeps loading without holding up the fade.
export const NEXT_CHUNK_GATE_SECONDS = 2
const lightWindow = (index: number, chunkCount: number) => index + 1 < chunkCount ? [index, index + 1] : [index]
// Every focused stem is audible, so unlike background rotation none can be
// dropped from coverage. A solo/duo focus (an instrument) keeps the full
// current-1..+2 margin for smooth scrubbing. A family focus can hold up to
// eight stems (this excerpt's woodwinds) — four decoded chunks per stem at
// ~5.6MB each would be tens of MB beyond what mobile Safari reliably holds
// alongside the WebGL scene, so it narrows to the same current+next window
// background stems use, trading scrub margin for a bounded memory footprint.
const focusWindow = (index: number, chunkCount: number, focusedStemCount: number) =>
  focusedStemCount <= FOCUS_FULL_WINDOW_STEM_LIMIT
    ? preloadWindow(index, chunkCount)
    : lightWindow(index, chunkCount)

type ChunkPair = { stemId: string; chunk: number }

export function scheduledChunkIsExpired(chunk: number, currentIndex: number) {
  return chunk < currentIndex - 1
}

// Awaited focus chunks stay resident and are not counted. Everything else
// shares the background budget. Speculation is dropped before the rest of
// the focus window, and older buffers go before newer ones within each tier.
export function retainedCacheKeys(
  entries: readonly { key: string; bytes: number }[],
  protectedKeys: ReadonlySet<string>,
  preferredKeys: ReadonlySet<string>,
  budgetBytes: number,
) {
  const retained = new Set<string>()
  const preferred: { key: string; bytes: number }[] = []
  const other: { key: string; bytes: number }[] = []
  for (const entry of entries) {
    if (protectedKeys.has(entry.key)) retained.add(entry.key)
    else if (preferredKeys.has(entry.key)) preferred.push(entry)
    else other.push(entry)
  }
  let bytes = 0
  const evictable = [...other, ...preferred]
  for (const entry of evictable) bytes += entry.bytes
  for (const entry of evictable) {
    if (bytes <= budgetBytes) retained.add(entry.key)
    else bytes -= entry.bytes
  }
  return retained
}

export function backgroundChunkCapacity(lookaheadChunks: number) {
  const capacity = Math.floor(MAX_BACKGROUND_PCM_BYTES / DECODED_CHUNK_BYTES)
  return Math.max(0, capacity - Math.max(0, lookaheadChunks))
}

function budgetedBackgroundPairs(pairs: readonly ChunkPair[], index: number, slots: number) {
  if (slots <= 0) return []
  const current = pairs.filter(pair => pair.chunk === index)
  const later = pairs.filter(pair => pair.chunk !== index)
  return [...current, ...later].slice(0, slots)
}

export type ChunkLoadScope = 'playback' | 'paused'

export function focusGateNext(scope: ChunkLoadScope, time: number, manifest: ChunkManifest) {
  return scope === 'playback' && nextChunkGatesPlayback(time, manifest)
}

export function scopedLoadPlan<Plan extends {
  criticalPairs: ChunkPair[]
  lookaheadPairs: ChunkPair[]
  focusPairs: ChunkPair[]
  backgroundPairs: ChunkPair[]
}>(plan: Plan, scope: ChunkLoadScope): Plan {
  if (scope !== 'paused') return plan
  return {
    ...plan,
    lookaheadPairs: [],
    focusPairs: plan.criticalPairs,
    backgroundPairs: [],
  }
}

export function nextChunkGatesPlayback(time: number, manifest: ChunkManifest) {
  const index = chunkIndexAt(time, manifest)
  if (index + 1 >= manifest.chunkCount) return false
  const remaining = chunkLogicalDuration(index, manifest) - chunkOffsetAt(time, manifest)
  return remaining <= NEXT_CHUNK_GATE_SECONDS
}

export function chunkPreloadPlan(
  stems: readonly string[],
  focusedStems: readonly string[],
  index: number,
  chunkCount: number,
  isAudible: (stemId: string, chunk: number) => boolean = () => true,
  gateNext = false,
): { criticalPairs: ChunkPair[]; lookaheadPairs: ChunkPair[]; focusPairs: ChunkPair[]; backgroundPairs: ChunkPair[] } {
  const focusSet = new Set(focusedStems)
  const window = focusWindow(index, chunkCount, focusedStems.length)
  const audibleWindow = (stemId: string, indices: readonly number[]) =>
    indices.filter(chunk => isAudible(stemId, chunk))
  const focusPairs = focusedStems.flatMap(stemId =>
    audibleWindow(stemId, window).map(chunk => ({ stemId, chunk })))
  const criticalChunks = new Set([index])
  if (gateNext && index + 1 < chunkCount) criticalChunks.add(index + 1)
  const criticalPairs = focusPairs.filter(pair => criticalChunks.has(pair.chunk))
  const lookaheadPairs = focusPairs.filter(pair => !criticalChunks.has(pair.chunk))
  const backgroundStems = stems.filter(stemId => !focusSet.has(stemId))
  const offset = backgroundStems.length ? (index * MAX_BACKGROUND_STEMS) % backgroundStems.length : 0
  const rotated = [...backgroundStems.slice(offset), ...backgroundStems.slice(0, offset)]
  const backgroundCandidates = rotated.slice(0, MAX_BACKGROUND_STEMS).flatMap(stemId =>
    audibleWindow(stemId, lightWindow(index, chunkCount)).map(chunk => ({ stemId, chunk })))
  const backgroundPairs = budgetedBackgroundPairs(
    backgroundCandidates,
    index,
    backgroundChunkCapacity(lookaheadPairs.length),
  )
  return { criticalPairs, lookaheadPairs, focusPairs, backgroundPairs }
}

export function createChunkScheduler() {
  let context: AudioContext | undefined
  let output: AudioNode | undefined
  let excerpt: ExcerptDefinition | undefined
  let manifest: ChunkManifest | null = null
  const buffers = new Map<string, LoadEntry>()
  const inflight = new Map<string, Promise<LoadEntry | undefined>>()
  const controllers = new Map<string, AbortController>()
  const sources = new Map<string, AudioBufferSourceNode>()
  const stemGains = new Map<string, GainNode>()
  const wanted = new Set<string>()
  let lastFetchMs = 0
  let lastDecodeMs = 0
  let lateSchedules = 0
  let lastReadyKey: string | null = null
  let lastPrunedKey: string | null = null
  let lastLookaheadKey: string | null = null
  let lastBackgroundKey: string | null = null
  let protectedKeys = new Set<string>()
  let preferredKeys = new Set<string>()
  let backgroundStemIds: readonly string[] = []
  let chunkMask: ActivityChunkMask | null = null

  const bufferKey = (stemId: string, index: number) => `${stemId}:${index}`
  const audibleAt = (stemId: string, index: number) =>
    chunkIsAudible(chunkMask, stemId, index, manifest?.chunkDuration)
  const planSignature = (index: number, focusedStems: readonly string[]) =>
    `${index}|${focusedStems.join(',')}|${chunkMask ? chunkMask.duration : 'all'}`
  // Focus playback is one pre-mixed stem. Speculation warms only the next
  // navigation choices, and concurrency stays capped so their decode does not
  // land in one frame.
  let activeLoads = 0
  const loadQueue: LoadSlot[] = []
  const queuedSlots = new Map<string, LoadSlot>()
  const acquireSlot = (key: string, priority: number) => new Promise<boolean>(resolve => {
    if (activeLoads < MAX_CONCURRENT_LOADS) { activeLoads += 1; resolve(true); return }
    const slot = { key, priority, resolve }
    queuedSlots.set(key, slot)
    loadQueue.push(slot)
    loadQueue.sort((a, b) => b.priority - a.priority)
  })
  const releaseSlot = () => {
    activeLoads -= 1
    const next = loadQueue.shift()
    if (!next) return
    queuedSlots.delete(next.key)
    activeLoads += 1
    next.resolve(true)
  }

  const cancelObsoleteLoads = () => {
    for (let index = loadQueue.length - 1; index >= 0; index -= 1) {
      const slot = loadQueue[index]
      if (wanted.has(slot.key)) continue
      loadQueue.splice(index, 1)
      queuedSlots.delete(slot.key)
      slot.resolve(false)
    }
    for (const [key, controller] of controllers) {
      if (!wanted.has(key)) controller.abort()
    }
  }

  const trimBackgroundCache = () => {
    const retained = retainedCacheKeys(
      [...buffers].map(([key, entry]) => ({ key, bytes: bufferBytes(entry.buffer) })),
      protectedKeys,
      preferredKeys,
      MAX_BACKGROUND_PCM_BYTES,
    )
    for (const key of [...buffers.keys()]) {
      if (!retained.has(key)) buffers.delete(key)
    }
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

  const loadOne = (stemId: string, index: number, priority: number) => {
    if (!excerpt || !manifest || !context) throw new Error('Chunk scheduler is not attached')
    const key = bufferKey(stemId, index)
    const have = buffers.get(key)
    if (have) return Promise.resolve(have)
    const pending = inflight.get(key)
    if (pending) {
      const slot = queuedSlots.get(key)
      if (slot && priority > slot.priority) {
        slot.priority = priority
        loadQueue.sort((a, b) => b.priority - a.priority)
      }
      return pending
    }
    const ctx = context
    const work = (async () => {
      const active = await acquireSlot(key, priority)
      if (!active || !wanted.has(key)) return undefined
      const controller = new AbortController()
      controllers.set(key, controller)
      try {
        const url = chunkUrl(excerpt!, stemId, index)
        const fetchStart = performance.now()
        const response = await fetch(url, { signal: controller.signal })
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
        if (wanted.has(key)) {
          buffers.delete(key)
          buffers.set(key, entry)
          trimBackgroundCache()
        }
        return entry
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return undefined
        throw error
      } finally {
        controllers.delete(key)
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
    setChunkMask(mask: ActivityChunkMask | null) {
      chunkMask = mask
    },
    // While playback is running, only the chunk under the playhead — plus the
    // next one within NEXT_CHUNK_GATE_SECONDS of the boundary — is awaited.
    // The rest of the focus window still loads ahead of speculation. While
    // paused, only that current audible chunk is fetched.
    async prepare(focusedStems: readonly string[], time: number, scope: ChunkLoadScope = 'playback') {
      if (!manifest) return
      const index = chunkIndexAt(time, manifest)
      const gateNext = focusGateNext(scope, time, manifest)
      backgroundStemIds = scope === 'playback' && excerpt
        ? speculativeStemIds(excerpt, manifest.stems, focusedStems)
        : []
      const planned = chunkPreloadPlan(
        backgroundStemIds, focusedStems, index, manifest.chunkCount, audibleAt, gateNext,
      )
      const { criticalPairs, lookaheadPairs, focusPairs, backgroundPairs } = scopedLoadPlan(planned, scope)
      const pairs = [...focusPairs, ...backgroundPairs]
      wanted.clear()
      for (const { stemId, chunk } of pairs) wanted.add(bufferKey(stemId, chunk))
      protectedKeys = new Set(criticalPairs.map(({ stemId, chunk }) => bufferKey(stemId, chunk)))
      preferredKeys = new Set(lookaheadPairs.map(({ stemId, chunk }) => bufferKey(stemId, chunk)))
      cancelObsoleteLoads()
      trimBackgroundCache()
      const signature = `${scope}|${planSignature(index, focusedStems)}|${gateNext ? 'next' : 'current'}`
      const satisfied = () => criticalPairs.every(({ stemId, chunk }) => buffers.has(bufferKey(stemId, chunk)))
      if (signature === lastReadyKey && satisfied()) return
      // Claim available slots for playback-critical work before the rest of
      // the focus window, and before speculation. Queue priority covers
      // whatever does not get a slot immediately.
      const focusReady = Promise.all(criticalPairs.map(({ stemId, chunk }) => loadOne(stemId, chunk, 2)))
      const lookaheadKey = `${index}|${lookaheadPairs.map(pair => `${pair.stemId}:${pair.chunk}`).join(',')}`
      if (lookaheadKey !== lastLookaheadKey) {
        lastLookaheadKey = lookaheadKey
        void Promise.all(lookaheadPairs.map(({ stemId, chunk }) => loadOne(stemId, chunk, 1)))
          .catch(error => console.error(error))
      }
      const backgroundKey = `${index}|${backgroundPairs.map(pair => pair.stemId).join(',')}`
      if (backgroundKey !== lastBackgroundKey) {
        lastBackgroundKey = backgroundKey
        void Promise.all(backgroundPairs.map(({ stemId, chunk }) => loadOne(stemId, chunk, 0)))
          .catch(error => console.error(error))
      }
      await focusReady
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
      const signature = planSignature(index, focusedStems)
      if (signature === lastPrunedKey) return
      lastPrunedKey = signature
      const focusSet = new Set(focusedStems)
      const focusChunks = new Set(focusWindow(index, manifest.chunkCount, focusedStems.length))
      const lightChunks = new Set(lightWindow(index, manifest.chunkCount))
      const retained = new Set([...focusedStems, ...backgroundStemIds])
      const keepChunk = (stemId: string, chunk: number) => {
        const window = focusSet.has(stemId) ? focusChunks : lightChunks
        return retained.has(stemId) && window.has(chunk) && audibleAt(stemId, chunk)
      }
      wanted.clear()
      for (const stemId of retained) {
        for (const chunk of focusSet.has(stemId) ? focusChunks : lightChunks) {
          if (audibleAt(stemId, chunk)) wanted.add(bufferKey(stemId, chunk))
        }
      }
      for (const key of buffers.keys()) {
        const split = key.lastIndexOf(':')
        const stemId = key.slice(0, split)
        const chunk = Number(key.slice(split + 1))
        if (!keepChunk(stemId, chunk)) buffers.delete(key)
      }
      trimBackgroundCache()
      // Selection changes own their source lifetime through stopSources()
      // after the audible handoff. Pruning must not stop a departing selection
      // merely because it is absent from focusedStems: during a focus-to-
      // orchestra transition that would cut the old layer immediately while
      // the orchestra gain is still ramping up. Only retire chunks that are
      // genuinely behind the playhead here.
      for (const [key, source] of sources) {
        const split = key.lastIndexOf(':')
        const chunk = Number(key.slice(split + 1))
        if (scheduledChunkIsExpired(chunk, index)) {
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
      for (const controller of controllers.values()) controller.abort()
      controllers.clear()
      for (const slot of loadQueue.splice(0)) slot.resolve(false)
      queuedSlots.clear()
      wanted.clear()
      stemGains.clear()
      context = undefined
      output = undefined
    },
  }
}

export type ChunkScheduler = ReturnType<typeof createChunkScheduler>
