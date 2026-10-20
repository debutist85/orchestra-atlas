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
import { currentExcerpt, fullOrchestraStemId } from './excerpt'
import { localMediaUrl, mediaUrl } from '../../lib/media-url'
import {
  fetchActivityProfile, instrumentActivityAt, intensityAt, sharedIntensityAt, type ActivityProfile,
} from './activity-profile'
import type { InstrumentActivity } from './instrument-activity'
import { createChunkScheduler } from './chunk-scheduler'
import { chunkIndexAt, chunkOffsetAt, originFromStart } from './chunk-playback/transport'
import { instrumentStemId, playbackPlan } from './playback-plan'
import {
  arrivingStemIds, BACKGROUND_FADE_SECONDS, departingStemIds, HANDOFF_SECONDS,
  keepPriorFocusOnFailure, START_LEAD, transitionKind,
} from './playback-transition'

export type ListeningDiagnostics = {
  focusMode: FocusDepth
  preparing: boolean
  focusReady: boolean
  transition: string
  transportTime: number
  outputLatency: number
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
  // Keep focus scope and makeup gain on separate AudioParams for the same
  // reason: the per-frame boost tracker must not cancel a zoom crossfade.
  let focusScope: GainNode | null = null
  let focusBoost: GainNode | null = null
  // The full mix is a chunked stem like the focus stems, so every layer and
  // the visuals share one AudioContext clock.
  const bedStemId = fullOrchestraStemId(currentExcerpt)
  const bedStems = [bedStemId]
  let origin = 0
  let frame = 0
  let lastEpoch = -1
  let lastPublish = 0
  let running = false
  let attached = false
  let mix: AudioSelection = audioSelection({ level: 'orchestra' })
  let desired = playbackPlan(mix, currentExcerpt)
  let activeFocus: readonly string[] = []
  let focusReady = false
  let activityProfile: ActivityProfile | null = null
  let preparing = false
  let lastFailure: string | undefined
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

  // currentTime is when audio is handed to the device, not when it is
  // heard; Bluetooth output can add well over 100 ms. Visuals follow what is
  // heard.
  const outputLatency = () => context ? (context.outputLatency || context.baseLatency || 0) : 0

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
    // Shared/global scale, not the calibrated one below: ensembleIntensity
    // and orchestraAverageIntensity compare ACROSS instruments, which needs
    // one consistent absolute scale — the per-instrument-calibrated series
    // deliberately isn't comparable instrument-to-instrument (see
    // ActivityProfile.instrumentsShared).
    const allIntensities = Object.keys(activityProfile.instrumentsShared).map(id => sharedIntensityAt(activityProfile!, id, time))
    // Calibrated per-instrument scale: this is a single instrument's own
    // dynamics, which per-instrument calibration genuinely improves.
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
    if (typeof gain.gain.cancelAndHoldAtTime === 'function') {
      gain.gain.cancelAndHoldAtTime(start)
    } else {
      const current = gain.gain.value
      gain.gain.cancelScheduledValues(start)
      gain.gain.setValueAtTime(current, start)
    }
    gain.gain.linearRampToValueAtTime(value, start + duration)
  }

  const afterHandoff = (token: number, work: () => void, fadeSeconds = HANDOFF_SECONDS) => {
    window.setTimeout(() => {
      if (!isCurrent(token)) return
      work()
    }, (START_LEAD + fadeSeconds) * 1000)
  }

  // Refreshes both the highlighted stem's boost (focusBoost) and the
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
      // Only compensate for a quiet overall passage when the full mix is
      // the sole layer (orchestra scope, no highlight) — while a family or
      // instrument is focused, targetBackground() is a deliberate quiet
      // duck (see audio-selection.ts), and this boost can reach ~16x during
      // a soft passage; left unconditional, it multiplies straight through
      // that duck and un-mutes the whole orchestra (every other instrument,
      // not just the focused one) right when the music goes quiet.
      const inFocus = focusReady && desired.mode === 'focus'
      const boost = inFocus ? 1 : soloIntensityGain(levels.ensemble)
      lastBackground = targetBackground() * boost
      orchestraBoost.gain.setTargetAtTime(boost, context.currentTime, 0.02)
    }
    if (focusBoost && focusReady && desired.mode === 'focus') {
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
      focusBoost.gain.setTargetAtTime(value, context.currentTime, 0.02)
    }
  }

  const applyLayerGains = (when: number) => {
    const background = targetBackground()
    const levels = mixLevelsAt(clockPosition() + START_LEAD)
    const inFocus = desired.mode === 'focus' && focusReady
    const focus = inFocus ? focusBoostGain(levels.selectedIntensity, levels.ensemble) : 0
    lastBackground = background * (inFocus ? 1 : soloIntensityGain(levels.ensemble))
    lastFocusGain = focus
    // The background duck is a musical "zoom" the listener should hear
    // happen, not an instant cut — see BACKGROUND_FADE_SECONDS. The
    // ensemble-intensity boost (orchestraBoost) is left alone here — it
    // keeps tracking continuously via applyContinuousGains regardless of
    // scope transitions. focusScope ramps over the same window as the
    // orchestra duck so the two layers never briefly stack at full level.
    fadeTo(orchestraGain, background, when, BACKGROUND_FADE_SECONDS)
    fadeTo(focusScope, focus > 0 ? 1 : 0, when, BACKGROUND_FADE_SECONDS)
  }

  // Desired stems plus whatever focus is still audible, so a departing
  // focus keeps its chunks while a swap loads or after it fails.
  const focusCoverage = () => [...new Set([...activeFocus, ...desired.stemIds])]

  const tick = () => {
    frame = 0
    const state = usePlaybackStore.getState()
    if (!running || state.status !== 'playing') return
    if (state.epoch !== lastEpoch) {
      void applyTransport()
      return
    }
    publish()
    applyContinuousGains()
    // Runs regardless of navigation level so the scheduler can maintain its
    // bounded speculative cache. Focus chunks take priority and are the only
    // loads that gate scheduleWindow below.
    const focusedStems = desired.mode === 'focus' ? focusCoverage() : []
    const time = clockPosition()
    const token = commandId
    void scheduler.prepare(focusedStems, time).then(() => {
      if (!isCurrent(token) || usePlaybackStore.getState().status !== 'playing') return
      scheduler.scheduleWindow(bedStems, origin, clockPosition(), true)
      if (desired.mode === 'focus' && focusReady) {
        scheduler.scheduleWindow(activeFocus, origin, clockPosition(), true)
      }
      scheduler.prune(focusedStems, clockPosition())
    }).catch(error => console.error(error))
    if (clockPosition() >= state.duration) {
      publish(true)
      scheduler.stopSources()
      running = false
      focusReady = false
      return
    }
    if (usePlaybackStore.getState().status === 'playing') frame = requestAnimationFrame(tick)
  }

  const reconcile = async (token: number) => {
    if (!attached || !context || !orchestraGain || !focusScope || !focusBoost) return
    const store = usePlaybackStore.getState()
    if (store.status !== 'playing') {
      if (!isCurrent(token)) return
      const pausedFocus = desired.mode === 'focus'
      if (pausedFocus) preparing = true
      try {
        await scheduler.prepare(pausedFocus ? desired.stemIds : [], store.position, 'paused')
      } catch (error) {
        lastFailure = error instanceof Error ? error.message : String(error)
        console.error(error)
      }
      if (isCurrent(token)) preparing = false
      return
    }
    if (!isCurrent(token)) return
    await context.resume()
    const seeked = store.epoch !== lastEpoch
    const keepClock = running && !seeked

    try {
      if (!keepClock) {
        // Play, resume, or seek: the clock stands still at store.position
        // until the bed (and any focus stem) is decoded, then everything
        // starts together at one scheduled instant.
        preparing = true
        running = false
        const start = store.position
        await scheduler.prepare(desired.mode === 'focus' ? desired.stemIds : [], start)
        if (!isCurrent(token) || usePlaybackStore.getState().status !== 'playing') {
          preparing = false
          return
        }
        scheduler.stopSources()
        origin = originFromStart(start, context.currentTime + START_LEAD)
        lastEpoch = usePlaybackStore.getState().epoch
        running = true
        scheduler.scheduleWindow(bedStems, origin, start, true)
        if (!scheduler.hasBed()) lastFailure = `${bedStemId} chunks are missing from the manifest`
      }

      if (desired.mode === 'focus') {
        preparing = true
        const prepareAt = clockPosition() + START_LEAD

        const departing = departingStemIds(activeFocus, desired.stemIds)
        const arriving = arrivingStemIds(activeFocus, desired.stemIds)
        for (const id of arriving) scheduler.setStemGain(id, 0, context.currentTime, 0.001)

        // During a continuous swap, plan the same stems tick() does so the two
        // callers don't alternate between plans and cancel each other's loads.
        const covered = keepClock ? focusCoverage() : desired.stemIds
        await scheduler.prepare(covered, prepareAt)
        if (!isCurrent(token) || usePlaybackStore.getState().status !== 'playing') return

        const when = context.currentTime + START_LEAD
        // Read after the prepare() await: the clock kept running while a
        // swap's chunk loaded.
        const logical = clampPlaybackPosition(clockPosition() + START_LEAD, store.duration)

        const focusSwap = activeFocus.length > 0
        for (const id of departing) scheduler.setStemGain(id, 0, when, BACKGROUND_FADE_SECONDS)
        for (const id of arriving) {
          scheduler.setStemGain(id, 1, when, focusSwap ? BACKGROUND_FADE_SECONDS : HANDOFF_SECONDS)
        }
        for (const id of desired.stemIds.filter(id => !arriving.includes(id))) {
          scheduler.setStemGain(id, 1, when)
        }
        scheduler.scheduleWindow(desired.stemIds, origin, logical, true)
        focusReady = true
        activeFocus = desired.stemIds
        applyLayerGains(when)
        afterHandoff(token, () => {
          scheduler.stopSources(departing)
          scheduler.prune(desired.stemIds, clockPosition())
        }, BACKGROUND_FADE_SECONDS)
        preparing = false
      } else {
        const leaving = activeFocus
        const when = context.currentTime + (leaving.length ? START_LEAD : 0)
        focusReady = false
        lastEpoch = usePlaybackStore.getState().epoch
        applyLayerGains(when)
        // Deselecting back to the orchestra fades the focus bus out over
        // BACKGROUND_FADE_SECONDS (see applyLayerGains) rather than cutting
        // it — match the cleanup delay so sources aren't hard-stopped early.
        // Only the focus stems stop; the bed keeps playing.
        afterHandoff(token, () => {
          scheduler.stopSources(leaving)
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
      // A failed start leaves nothing scheduled; show it as paused rather
      // than a frozen "playing" clock.
      if (!running) usePlaybackStore.getState().pause()
    }

    if (usePlaybackStore.getState().status === 'playing' && !frame) frame = requestAnimationFrame(tick)
  }

  const applyTransport = () => {
    const state = usePlaybackStore.getState()
    if (state.status !== 'playing') {
      if (!running) {
        const seeked = state.epoch !== lastEpoch
        lastEpoch = state.epoch
        // Warm the chunks at the new position so Play starts promptly.
        if (seeked) void reconcile(nextCommand())
        return
      }
      nextCommand()
      publish(true)
      running = false
      lastEpoch = state.epoch
      preparing = false
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
    const catalogReady = instrumentCatalog.filter(group => instrumentStemId(currentExcerpt, group.instrument))
    const catalogMissing = instrumentCatalog.filter(group => !instrumentStemId(currentExcerpt, group.instrument))
    if (!context) {
      useListeningLoadStore.getState().setResult([], instrumentCatalog.map(group => group.instrument))
      return
    }
    master = context.createGain()
    orchestraGain = context.createGain()
    orchestraBoost = context.createGain()
    orchestraBoost.gain.value = 1
    focusScope = context.createGain()
    focusScope.gain.value = 0
    focusBoost = context.createGain()
    focusBoost.gain.value = 1
    orchestraGain.connect(orchestraBoost)
    orchestraBoost.connect(master)
    focusScope.connect(focusBoost)
    focusBoost.connect(master)
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
    scheduler.attach(context, focusScope, { stemId: bedStemId, output: orchestraGain })
    // The dev server reads the profile from public/ even when other media
    // comes from VITE_MEDIA_URL, so a freshly regenerated `npm run
    // audio:activity` is visible without uploading it first.
    const activityUrl = import.meta.env.DEV ? localMediaUrl(currentExcerpt.activityUrl) : mediaUrl(currentExcerpt.activityUrl)
    const profilePromise = fetchActivityProfile(activityUrl).catch(() => null)
    const manifestPromise = scheduler.loadManifest(currentExcerpt).catch(error => {
      console.error(error)
      return null
    })
    activityProfile = await profilePromise
    scheduler.setChunkMask(activityProfile?.chunks ?? null)
    const manifest = await manifestPromise
    useListeningLoadStore.getState().setProgress(1, 2)
    const duration = manifest?.duration ?? activityProfile?.duration
    if (duration) usePlaybackStore.getState().setDuration(duration)
    const orchestraReady = scheduler.hasBed()
    if (!orchestraReady) {
      lastFailure = `${bedStemId} chunks are unavailable`
      console.error(lastFailure)
    } else {
      // Decode the bed chunk under the playhead now, so the first Play only
      // waits for scheduling, not a fetch.
      await scheduler.prepare([], usePlaybackStore.getState().position, 'paused').catch(error => console.error(error))
    }
    const availableIds = new Set(manifest?.stems ?? [])
    const ready = catalogReady.filter(group => !manifest || availableIds.has(instrumentStemId(currentExcerpt, group.instrument)!))
    const missing = [
      ...catalogMissing,
      ...catalogReady.filter(group => !ready.includes(group)),
    ]
    if (!orchestraReady) {
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
      const time = playing ? Math.max(0, clockPosition() - outputLatency()) : clockPosition()
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
        outputLatency: outputLatency(),
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
      scheduler.dispose()
      void context?.close()
      context = null
      master = null
      orchestraGain = null
      orchestraBoost = null
      focusScope = null
      focusBoost = null
      activityProfile = null
    },
  }
}

export const listeningEngine = createListeningEngine()
