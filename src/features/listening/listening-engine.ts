import type { OrchestraInstrument } from '../orchestra-map/config'
import { useListeningLoadStore } from '../../store/listening-load-store'
import { usePlaybackStore } from '../../store/playback-store'
import { instrumentCatalog } from '../../store/catalog'
import {
  audioSelection, backgroundGainFor, connectListeningEngine, effectiveAudioSelection, ensembleIntensity,
  focusBoostGain, focusDepth, orchestraAverageIntensity, selectedFocusIntensity, soloIntensityGain,
  type AudioSelection, type FocusDepth,
} from './audio-selection'
import { clampPlaybackPosition, pulseLevels } from './playback'
import { currentExcerpt, fullOrchestraUrl } from './excerpt'
import { mediaUrl } from '../../lib/media-url'
import {
  fetchActivityProfile, instrumentActivityAt, intensityAt, type ActivityProfile,
} from './activity-profile'
import type { InstrumentActivity } from './instrument-activity'
import { createChunkScheduler } from './chunk-scheduler'
import { chunkIndexAt, chunkOffsetAt, originFromStart } from './chunk-playback/transport'
import { playbackPlan } from './playback-plan'
import {
  arrivingStemIds, BACKGROUND_FADE_SECONDS, departingStemIds, FOCUS_ROLLOUT_BATCH_SIZE, HANDOFF_SECONDS,
  keepPriorFocusOnFailure, START_LEAD, takeRolloutBatch, transitionKind,
} from './playback-transition'

export type ListeningDiagnostics = {
  focusMode: FocusDepth
  preparing: boolean
  focusReady: boolean
  transition: string
  transportTime: number
  mediaTime: number
  mediaDrift: number
  selectedIntensity: number
  orchestraAverage: number
  backgroundGain: number
  soloGain: number
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
  lastFailure?: string
}

function createContext() {
  const Ctor = globalThis.AudioContext
  return typeof Ctor === 'function' ? new Ctor() : null
}

function waitSeeked(element: HTMLAudioElement, time: number, isCurrent: () => boolean) {
  return new Promise<void>((resolve, reject) => {
    const finish = () => {
      window.clearTimeout(timer)
      element.removeEventListener('seeked', onSeeked)
      element.removeEventListener('error', onError)
      resolve()
    }
    const onSeeked = () => finish()
    const onError = () => {
      window.clearTimeout(timer)
      element.removeEventListener('seeked', onSeeked)
      element.removeEventListener('error', onError)
      reject(new Error('full-orchestra seek failed'))
    }
    if (Math.abs(element.currentTime - time) < 0.04 && element.readyState >= 2) {
      resolve()
      return
    }
    const timer = window.setTimeout(() => {
      element.removeEventListener('seeked', onSeeked)
      element.removeEventListener('error', onError)
      reject(new Error('full-orchestra seek timed out'))
    }, 4000)
    element.addEventListener('seeked', onSeeked)
    element.addEventListener('error', onError)
    if (!isCurrent()) {
      finish()
      return
    }
    element.currentTime = time
  })
}

export function createListeningEngine() {
  const scheduler = createChunkScheduler()
  let commandId = 0
  let context: AudioContext | null = null
  let master: GainNode | null = null
  let orchestraGain: GainNode | null = null
  // Separate node so the continuous, fast-tracking ensemble-intensity boost
  // (applyContinuousGains, every frame) never fights the slow, scope-change
  // fade on orchestraGain itself (fadeTo, BACKGROUND_FADE_SECONDS) — a
  // second setTargetAtTime on the SAME param mid-ramp would cut the ramp
  // short (Web Audio automation events supersede what came before them on
  // that param), silently turning the 0.6s fade back into a near-instant one.
  let orchestraBoost: GainNode | null = null
  let focusBus: GainNode | null = null
  let media: HTMLAudioElement | null = null
  let mediaSource: MediaElementAudioSourceNode | null = null
  let origin = 0
  let frame = 0
  let lastEpoch = -1
  let lastPublish = 0
  let lastDriftLog = 0
  let running = false
  let attached = false
  let mix: AudioSelection = audioSelection({ level: 'orchestra' })
  let desired = playbackPlan(mix, currentExcerpt)
  let activeFocus: readonly string[] = []
  let focusReady = false
  // Stems still waiting for their AudioBufferSourceNode to be scheduled,
  // rolled out a batch per animation frame by tick() below. Seeded from the
  // full desired stem list (not just newly-arriving ones) every time focus
  // is (re-)established, so a transport discontinuity that wipes sources via
  // stopSources() without changing the selection (pause/resume, seek) still
  // gets everything rescheduled — scheduleChunk's own skip-check makes
  // reprocessing already-scheduled stems free.
  let pendingRolloutStems: readonly string[] = []
  let focusRolloutLogical = 0
  let activityProfile: ActivityProfile | null = null
  let preparing = false
  let lastFailure: string | undefined
  let lastMediaDrift = 0
  let lastBackground = 1
  let lastFocusGain = 0
  let lastSelectedIntensity = 0
  let lastOrchestraAverage = 0

  const nextCommand = () => {
    commandId += 1
    return commandId
  }

  const isCurrent = (token: number) => token === commandId
  const clockNow = () => context?.currentTime ?? 0

  const clockPosition = () => {
    const { duration, position, status } = usePlaybackStore.getState()
    if (!running || status !== 'playing' || !context) return position
    return clampPlaybackPosition(origin + clockNow(), duration)
  }

  const publish = (force = false) => {
    const time = performance.now()
    if (!force && time - lastPublish < 80) return
    lastPublish = time
    usePlaybackStore.getState().setClock(clockPosition())
  }

  const mixLevelsAt = (time: number) => {
    if (!activityProfile) {
      lastSelectedIntensity = 0
      lastOrchestraAverage = 0
      return { selectedIntensity: 0, orchestraAverage: 0, ensemble: 0 }
    }
    const allIntensities = Object.keys(activityProfile.instruments).map(id => intensityAt(activityProfile!, id, time))
    const selected = selectedFocusIntensity(
      mix.selectedInstrumentIds.map(id => intensityAt(activityProfile!, id, time)),
    )
    const orchestraAverage = orchestraAverageIntensity(allIntensities)
    const ensemble = ensembleIntensity(allIntensities)
    lastSelectedIntensity = selected
    lastOrchestraAverage = orchestraAverage
    return { selectedIntensity: selected, orchestraAverage, ensemble }
  }

  // The scope-level target only — how much of the full mix should be
  // audible for the current navigation depth. Deliberately NOT multiplied
  // by the ensemble-intensity boost here; that's applied on a separate node
  // (orchestraBoost) by applyContinuousGains so the two can be re-targeted
  // independently without one's automation cutting the other's short (see
  // orchestraBoost's declaration).
  const targetBackground = () => backgroundGainFor(mix, undefined, focusReady && desired.mode === 'focus')

  const fadeTo = (gain: GainNode | null, value: number, when: number, duration = HANDOFF_SECONDS) => {
    if (!gain || !context) return
    const start = Math.max(when, context.currentTime)
    gain.gain.cancelScheduledValues(start)
    gain.gain.setValueAtTime(gain.gain.value, start)
    gain.gain.linearRampToValueAtTime(value, start + duration)
  }

  const afterHandoff = (token: number, work: () => void, fadeSeconds = HANDOFF_SECONDS) => {
    window.setTimeout(() => {
      if (!isCurrent(token)) return
      work()
    }, (START_LEAD + fadeSeconds) * 1000)
  }

  // Refreshes both the highlighted stem's boost (focusBus) and the
  // full-orchestra layer's boost (orchestraBoost) every animation frame,
  // from a single mix-level snapshot — replaces what used to be two
  // separate functions that each independently called mixLevelsAt with the
  // same clock position. The ensemble-relative boost that used
  // orchestraAverageIntensity stays disabled (see audio-selection.ts): that
  // average is recomputed from ALL instruments every frame, and any
  // instrument elsewhere crossing in/out of "sounding" jumps it
  // discontinuously, which is what made the old boost sound erratic.
  // soloIntensityGain/focusBoostGain instead react only to smooth inputs
  // (an instrument's own intensity, or the ensemble's loudest part, or a
  // blend of the two), so there's nothing discontinuous for them to jump
  // against. Only touches orchestraBoost, never orchestraGain itself — see
  // orchestraBoost's declaration for why.
  const applyContinuousGains = () => {
    if (!context) return
    const levels = mixLevelsAt(clockPosition())
    if (orchestraBoost) {
      const boost = soloIntensityGain(levels.ensemble)
      lastBackground = targetBackground() * boost
      orchestraBoost.gain.setTargetAtTime(boost, context.currentTime, 0.02)
    }
    if (focusBus && focusReady && desired.mode === 'focus') {
      const value = focusBoostGain(levels.selectedIntensity, levels.ensemble)
      lastFocusGain = value
      // Re-issued every animation frame, this is a second attack/release
      // smoother stacked on top of instrument-activity.ts's own — at 0.05s
      // it was the dominant bottleneck for short notes even after
      // shortening that one, since 3 time constants (~150ms) alone rivals a
      // typical staccato note's duration. 0.02s keeps the ramp
      // declick-smooth (this is still an exponential approach, never a
      // hard step) while tracking the already-smoothed target closely
      // enough to stay audible on short notes.
      focusBus.gain.setTargetAtTime(value, context.currentTime, 0.02)
    }
  }

  const applyLayerGains = (when: number) => {
    const background = targetBackground()
    const levels = mixLevelsAt(clockPosition() + START_LEAD)
    const focus = desired.mode === 'focus' && focusReady ? focusBoostGain(levels.selectedIntensity, levels.ensemble) : 0
    lastBackground = background * soloIntensityGain(levels.ensemble)
    lastFocusGain = focus
    // The background duck is a musical "zoom" the listener should hear
    // happen, not an instant cut — see BACKGROUND_FADE_SECONDS. The
    // ensemble-intensity boost (orchestraBoost) is left alone here — it
    // keeps tracking continuously via applyContinuousGains regardless of
    // scope transitions. The focus bus stays on the fast handoff duration
    // while entering/staying in focus (responsive engagement), but when
    // deselecting back to the orchestra (focus target 0) it gets the same
    // slow fade as the background duck, instead of cutting the previously
    // highlighted instrument off abruptly.
    fadeTo(orchestraGain, background, when, BACKGROUND_FADE_SECONDS)
    fadeTo(focusBus, focus, when, focus > 0 ? HANDOFF_SECONDS : BACKGROUND_FADE_SECONDS)
  }

  const noteDrift = () => {
    if (!media || media.paused || !running) return
    lastMediaDrift = media.currentTime - clockPosition()
    if (Math.abs(lastMediaDrift) < 0.08) return
    const now = performance.now()
    if (now - lastDriftLog < 2000) return
    lastDriftLog = now
    console.warn(`full-orchestra media drift ${lastMediaDrift.toFixed(3)}s at transport ${clockPosition().toFixed(3)}s`)
  }

  const startOrchestraNow = async (position: number, token: number) => {
    if (!media || !context) throw new Error('full-orchestra layer is not attached')
    await waitSeeked(media, position, () => isCurrent(token))
    if (!isCurrent(token) || usePlaybackStore.getState().status !== 'playing') return
    if (media.paused) await media.play()
    origin = originFromStart(media.currentTime, context.currentTime)
    lastEpoch = usePlaybackStore.getState().epoch
  }

  const tick = () => {
    frame = 0
    const state = usePlaybackStore.getState()
    if (!running || state.status !== 'playing') return
    if (state.epoch !== lastEpoch) {
      void applyTransport()
      return
    }
    publish()
    noteDrift()
    applyContinuousGains()
    // Runs regardless of navigation level so the scheduler can maintain its
    // bounded speculative cache. Focus chunks take priority and are the only
    // loads that gate scheduleWindow below.
    const focusedStems = desired.mode === 'focus' ? desired.stemIds : []
    const time = clockPosition()
    const token = commandId
    void scheduler.prepare(focusedStems, time).then(() => {
      if (!isCurrent(token) || usePlaybackStore.getState().status !== 'playing') return
      if (desired.mode === 'focus' && focusReady) {
        if (pendingRolloutStems.length) {
          const { batch, remaining } = takeRolloutBatch(pendingRolloutStems, FOCUS_ROLLOUT_BATCH_SIZE)
          pendingRolloutStems = remaining
          scheduler.scheduleWindow(batch, origin, focusRolloutLogical, true)
        } else {
          scheduler.scheduleWindow(desired.stemIds, origin, clockPosition(), true)
        }
      }
      scheduler.prune(focusedStems, clockPosition())
    }).catch(error => console.error(error))
    if (clockPosition() >= state.duration) {
      publish(true)
      media?.pause()
      scheduler.stopSources()
      running = false
      focusReady = false
      return
    }
    if (usePlaybackStore.getState().status === 'playing') frame = requestAnimationFrame(tick)
  }

  const reconcile = async (token: number) => {
    if (!attached || !context || !orchestraGain || !focusBus) return
    const store = usePlaybackStore.getState()
    if (store.status !== 'playing') {
      if (desired.mode === 'focus' && isCurrent(token)) {
        preparing = true
        try {
          await scheduler.prepare(desired.stemIds, store.position)
        } catch (error) {
          lastFailure = error instanceof Error ? error.message : String(error)
          console.error(error)
        }
        if (isCurrent(token)) preparing = false
      }
      return
    }
    if (!isCurrent(token)) return
    await context.resume()
    const seeked = store.epoch !== lastEpoch
    const wasRunning = running
    const mediaPlaying = Boolean(media && !media.paused)
    const keepClock = wasRunning && mediaPlaying && !seeked
    running = true

    try {
      if (!mediaPlaying || seeked || !wasRunning) {
        await startOrchestraNow(seeked || !wasRunning ? store.position : clockPosition(), token)
        if (!isCurrent(token) || usePlaybackStore.getState().status !== 'playing') return
      }

      if (desired.mode === 'focus') {
        preparing = true
        const prepareAt = (keepClock ? clockPosition() : store.position) + START_LEAD

        // Muting stems that are leaving the selection doesn't depend on the
        // newly-focused stems' audio being loaded, so do this before the
        // await below rather than after it — gating it behind the awaited
        // prepare() left the outgoing selection audible for as long as the
        // new one took to fetch+decode, very noticeable on a slow
        // connection. Instruments dropping out (e.g. narrowing a family
        // down to one instrument) fade out over the same duration as the
        // background duck, rather than cutting off abruptly — afterHandoff
        // below is stretched to match, so the underlying source isn't
        // hard-stopped before the fade is actually inaudible.
        const departing = departingStemIds(activeFocus, desired.stemIds)
        const arriving = arrivingStemIds(activeFocus, desired.stemIds)
        for (const id of arriving) scheduler.setStemGain(id, 0, context.currentTime, 0.001)
        for (const id of departing) scheduler.setStemGain(id, 0, context.currentTime, BACKGROUND_FADE_SECONDS)

        await scheduler.prepare(desired.stemIds, prepareAt)
        if (!isCurrent(token) || usePlaybackStore.getState().status !== 'playing') return

        const when = context.currentTime + START_LEAD
        if (!keepClock) {
          const logical = clampPlaybackPosition(
            (seeked ? store.position : clockPosition()) + START_LEAD,
            store.duration,
          )
          origin = originFromStart(logical, when)
          lastEpoch = usePlaybackStore.getState().epoch
          scheduler.stopSources()
        }

        for (const id of desired.stemIds) scheduler.setStemGain(id, 1, when)
        focusRolloutLogical = keepClock
          ? clockPosition() + START_LEAD
          : clampPlaybackPosition(store.position + START_LEAD, store.duration)
        const firstBatch = takeRolloutBatch(desired.stemIds, FOCUS_ROLLOUT_BATCH_SIZE)
        pendingRolloutStems = firstBatch.remaining
        scheduler.scheduleWindow(firstBatch.batch, origin, focusRolloutLogical, true)
        focusReady = true
        activeFocus = desired.stemIds
        applyLayerGains(when)
        afterHandoff(token, () => {
          scheduler.stopSources(departing)
          scheduler.prune(desired.stemIds, clockPosition())
        }, BACKGROUND_FADE_SECONDS)
        preparing = false
      } else {
        const when = context.currentTime + (activeFocus.length ? START_LEAD : 0)
        focusReady = false
        lastEpoch = usePlaybackStore.getState().epoch
        applyLayerGains(when)
        // Deselecting back to the orchestra fades the focus bus out over
        // BACKGROUND_FADE_SECONDS (see applyLayerGains) rather than cutting
        // it — match the cleanup delay so sources aren't hard-stopped early.
        afterHandoff(token, () => {
          scheduler.stopSources()
          // With no focused stems the scheduler retains only its bounded,
          // low-priority speculative window.
          scheduler.prune([], clockPosition())
          activeFocus = []
        }, BACKGROUND_FADE_SECONDS)
        preparing = false
      }
    } catch (error) {
      preparing = false
      focusReady = keepPriorFocusOnFailure(focusReady, false)
      lastFailure = error instanceof Error ? error.message : String(error)
      console.error(error)
      if (!focusReady) fadeTo(orchestraGain, 1, context.currentTime)
    }

    if (usePlaybackStore.getState().status === 'playing' && !frame) frame = requestAnimationFrame(tick)
  }

  const applyTransport = () => {
    const state = usePlaybackStore.getState()
    if (state.status !== 'playing') {
      if (!running) {
        const seeked = state.epoch !== lastEpoch
        lastEpoch = state.epoch
        if (seeked && desired.mode === 'focus') void reconcile(nextCommand())
        return
      }
      nextCommand()
      publish(true)
      running = false
      lastEpoch = state.epoch
      preparing = false
      media?.pause()
      if (media) {
        try { media.currentTime = usePlaybackStore.getState().position } catch { /* ignore */ }
      }
      scheduler.stopSources()
      cancelAnimationFrame(frame)
      frame = 0
      return
    }
    const token = nextCommand()
    if (state.epoch !== lastEpoch) scheduler.stopSources()
    void reconcile(token)
  }

  const applySelection = (selection: AudioSelection) => {
    mix = selection
    desired = playbackPlan(selection, currentExcerpt, scheduler.manifest()?.stems)
    if (!attached) return
    const currentPlan = activeFocus.length
      ? { mode: 'focus' as const, stemIds: activeFocus }
      : playbackPlan({ selectedInstrumentIds: [], effectiveListeningMode: 'normal' }, currentExcerpt)
    if (transitionKind(currentPlan, desired) === 'none') {
      applyContinuousGains()
      return
    }
    void reconcile(nextCommand())
  }

  const load = async () => {
    useListeningLoadStore.getState().setProgress(0, 2)
    context = createContext()
    const catalogReady = instrumentCatalog.filter(group => (currentExcerpt.stems[group.instrument] ?? []).length)
    const catalogMissing = instrumentCatalog.filter(group => !(currentExcerpt.stems[group.instrument] ?? []).length)
    if (!context || typeof Audio === 'undefined') {
      useListeningLoadStore.getState().setResult([], instrumentCatalog.map(group => group.instrument))
      return
    }
    master = context.createGain()
    orchestraGain = context.createGain()
    orchestraBoost = context.createGain()
    orchestraBoost.gain.value = 1
    focusBus = context.createGain()
    focusBus.gain.value = 0
    orchestraGain.connect(orchestraBoost)
    orchestraBoost.connect(master)
    focusBus.connect(master)
    // Nothing else in this graph limits the sum of the always-present
    // full-orchestra layer and the boosted focus layer, so a peak in both at
    // once can clip at the output — audible as distortion, not just a
    // loudness swing. A fast, high-ratio limiter just under 0dBFS catches
    // that without audibly coloring normal, non-overlapping playback. Back
    // in the signal path now that the full-orchestra layer is reconnected —
    // soloIntensityGain can boost the focus layer up to ~16x, so the two
    // layers peaking together is a real risk again.
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -1
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    master.connect(limiter)
    limiter.connect(context.destination)
    scheduler.attach(context, focusBus)
    media = new Audio()
    media.preload = 'auto'
    media.crossOrigin = 'anonymous'
    media.addEventListener('ended', () => {
      usePlaybackStore.getState().setClock(usePlaybackStore.getState().duration)
    })
    mediaSource = context.createMediaElementSource(media)
    mediaSource.connect(orchestraGain)
    const profilePromise = fetchActivityProfile(mediaUrl(currentExcerpt.activityUrl)).catch(() => null)
    const manifestPromise = scheduler.loadManifest(currentExcerpt).catch(error => {
      console.error(error)
      return null
    })
    let orchestraReady = false
    await new Promise<void>(resolve => {
      if (!media) {
        resolve()
        return
      }
      const done = () => {
        media?.removeEventListener('canplay', ok)
        media?.removeEventListener('error', fail)
        resolve()
      }
      const ok = () => {
        orchestraReady = true
        done()
      }
      const fail = () => {
        lastFailure = 'full-orchestra.opus is unavailable'
        console.error(lastFailure)
        done()
      }
      media.addEventListener('canplay', ok)
      media.addEventListener('error', fail)
      // Assigning `src` (rather than passing it to `new Audio()`, or calling
      // `.load()` afterward) triggers the browser's resource-selection
      // algorithm exactly once, now that the listeners above are already
      // attached to catch it. Doing both used to fire two fetches for the
      // same file — one from the constructor, one from the explicit reload.
      media.src = fullOrchestraUrl(currentExcerpt)
    })
    useListeningLoadStore.getState().setProgress(1, 2)
    activityProfile = await profilePromise
    const manifest = await manifestPromise
    const duration = manifest?.duration ?? activityProfile?.duration
    if (duration) usePlaybackStore.getState().setDuration(duration)
    const availableIds = new Set(manifest?.stems ?? [])
    const ready = catalogReady.filter(group => {
      const ids = (currentExcerpt.stems[group.instrument] ?? []).map(name => name.replace(/\.wav$/i, ''))
      return !manifest || ids.some(id => availableIds.has(id))
    })
    const missing = [
      ...catalogMissing,
      ...catalogReady.filter(group => !ready.includes(group)),
    ]
    if (!orchestraReady && !manifest) {
      useListeningLoadStore.getState().setResult([], instrumentCatalog.map(group => group.instrument))
    } else {
      useListeningLoadStore.getState().setResult(
        ready.map(group => group.instrument),
        missing.map(group => group.instrument),
      )
    }
    attached = true
    applySelection(effectiveAudioSelection())
    applyTransport()
  }

  return {
    load,
    applySelection,
    connect() {
      void load()
      const stopMix = connectListeningEngine({ applySelection })
      const stopTransport = usePlaybackStore.subscribe((state, prev) => {
        if (state.status === prev.status && state.epoch === prev.epoch) return
        applyTransport()
      })
      return () => {
        stopMix()
        stopTransport()
      }
    },
    position: clockPosition,
    pulseLevels(reducedMotion = false) {
      const state = usePlaybackStore.getState()
      return pulseLevels(running ? clockPosition() : state.position, {
        tempoBpm: state.tempoBpm,
        playing: state.status === 'playing',
        reducedMotion,
      })
    },
    activityProfile: () => activityProfile,
    instrumentActivity(): ReadonlyMap<OrchestraInstrument, InstrumentActivity<OrchestraInstrument>> {
      const result = new Map<OrchestraInstrument, InstrumentActivity<OrchestraInstrument>>()
      const playing = running && usePlaybackStore.getState().status === 'playing'
      const time = clockPosition()
      const ids = activityProfile
        ? Object.keys(activityProfile.instruments)
        : instrumentCatalog.map(group => group.instrument)
      for (const id of ids) {
        const instrument = id as OrchestraInstrument
        result.set(instrument, instrumentActivityAt(activityProfile, instrument, time, playing))
      }
      return result
    },
    diagnostics(): ListeningDiagnostics {
      const manifest = scheduler.manifest()
      const time = clockPosition()
      const currentPlan = activeFocus.length
        ? { mode: 'focus' as const, stemIds: activeFocus }
        : { mode: 'orchestra' as const, stemIds: [] as const }
      mixLevelsAt(time)
      return {
        focusMode: focusDepth(mix),
        preparing,
        focusReady,
        transition: transitionKind(currentPlan, desired),
        transportTime: time,
        mediaTime: media?.currentTime ?? 0,
        mediaDrift: lastMediaDrift,
        selectedIntensity: lastSelectedIntensity,
        orchestraAverage: lastOrchestraAverage,
        backgroundGain: lastBackground,
        soloGain: lastFocusGain,
        chunkIndex: manifest ? chunkIndexAt(time, manifest) : 0,
        chunkOffset: manifest ? chunkOffsetAt(time, manifest) : 0,
        stemCount: desired.stemIds.length,
        stems: desired.stemIds,
        lastFailure,
        ...scheduler.diagnostics(),
      }
    },
    dispose() {
      running = false
      attached = false
      nextCommand()
      cancelAnimationFrame(frame)
      frame = 0
      media?.pause()
      if (media) media.src = ''
      media = null
      mediaSource = null
      scheduler.dispose()
      void context?.close()
      context = null
      master = null
      orchestraGain = null
      orchestraBoost = null
      focusBus = null
      activityProfile = null
    },
  }
}

export const listeningEngine = createListeningEngine()
