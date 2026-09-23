import type { OrchestraInstrument } from '../orchestra-map/config'
import { useListeningLoadStore } from '../../store/listening-load-store'
import { usePlaybackStore } from '../../store/playback-store'
import { useNavigationStore } from '../../store/navigation-store'
import { instrumentCatalog } from '../../store/catalog'
import {
  audioSelection, backgroundGainFor, connectListeningEngine, dynamicFocusGain, focusDepth,
  orchestraAverageIntensity, selectedFocusIntensity, type AudioSelection, type FocusDepth,
} from './audio-selection'
import { clampPlaybackPosition, pulseLevels } from './playback'
import { currentExcerpt, fullOrchestraUrl } from './excerpt'
import {
  fetchActivityProfile, instrumentActivityAt, intensityAt, type ActivityProfile,
} from './activity-profile'
import type { InstrumentActivity } from './instrument-activity'
import { createChunkScheduler } from './chunk-scheduler'
import { chunkIndexAt, chunkOffsetAt, originFromStart } from './chunk-playback/transport'
import { playbackPlan } from './playback-plan'
import {
  arrivingStemIds, departingStemIds, HANDOFF_SECONDS, keepPriorFocusOnFailure, START_LEAD, transitionKind,
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
  dynamicFocusGain: number
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
      return { selectedIntensity: 0, orchestraAverage: 0 }
    }
    const selected = selectedFocusIntensity(
      mix.selectedInstrumentIds.map(id => intensityAt(activityProfile!, id, time)),
    )
    const orchestraAverage = orchestraAverageIntensity(
      Object.keys(activityProfile.instruments).map(id => intensityAt(activityProfile!, id, time)),
    )
    lastSelectedIntensity = selected
    lastOrchestraAverage = orchestraAverage
    return { selectedIntensity: selected, orchestraAverage }
  }

  const focusGainAt = (time: number) => {
    if (desired.mode !== 'focus' || !focusReady) return 0
    const { selectedIntensity, orchestraAverage } = mixLevelsAt(time)
    return dynamicFocusGain(selectedIntensity, orchestraAverage)
  }

  const targetBackground = () => backgroundGainFor(mix, undefined, focusReady && desired.mode === 'focus')

  const fadeTo = (gain: GainNode | null, value: number, when: number) => {
    if (!gain || !context) return
    const start = Math.max(when, context.currentTime)
    gain.gain.cancelScheduledValues(start)
    gain.gain.setValueAtTime(gain.gain.value, start)
    gain.gain.linearRampToValueAtTime(value, start + HANDOFF_SECONDS)
  }

  const afterHandoff = (token: number, work: () => void) => {
    window.setTimeout(() => {
      if (!isCurrent(token)) return
      work()
    }, (START_LEAD + HANDOFF_SECONDS) * 1000)
  }

  const applyDynamicFocus = () => {
    if (!focusBus || !context || !focusReady || desired.mode !== 'focus') return
    const value = focusGainAt(clockPosition())
    lastFocusGain = value
    lastBackground = targetBackground()
    // Re-issued every animation frame, this is a second attack/release
    // smoother stacked on top of instrument-activity.ts's own — at 0.05s it
    // was the dominant bottleneck for short notes even after shortening
    // that one, since 3 time constants (~150ms) alone rivals a typical
    // staccato note's duration. 0.02s keeps the ramp declick-smooth (this is
    // still an exponential approach, never a hard step) while tracking the
    // already-smoothed target closely enough to stay audible on short notes.
    focusBus.gain.setTargetAtTime(value, context.currentTime, 0.02)
  }

  const applyLayerGains = (when: number) => {
    const background = targetBackground()
    const focus = focusGainAt(clockPosition() + START_LEAD)
    lastBackground = background
    lastFocusGain = focus
    fadeTo(orchestraGain, background, when)
    fadeTo(focusBus, focus, when)
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
    if (desired.mode === 'focus' && focusReady) {
      const time = clockPosition()
      void scheduler.prepare(desired.stemIds, time).then(() => {
        if (!isCurrent(commandId) || usePlaybackStore.getState().status !== 'playing') return
        scheduler.scheduleWindow(desired.stemIds, origin, clockPosition(), true)
        scheduler.prune(desired.stemIds, clockPosition())
      }).catch(error => console.error(error))
      applyDynamicFocus()
    }
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

        const departing = departingStemIds(activeFocus, desired.stemIds)
        const arriving = arrivingStemIds(activeFocus, desired.stemIds)
        for (const id of arriving) scheduler.setStemGain(id, 0, context.currentTime, 0.001)
        for (const id of desired.stemIds) scheduler.setStemGain(id, 1, when)
        for (const id of departing) scheduler.setStemGain(id, 0, when)
        scheduler.scheduleWindow(
          desired.stemIds,
          origin,
          keepClock ? clockPosition() + START_LEAD : clampPlaybackPosition(store.position + START_LEAD, store.duration),
          true,
        )
        focusReady = true
        activeFocus = desired.stemIds
        applyLayerGains(when)
        afterHandoff(token, () => {
          scheduler.stopSources(departing)
          scheduler.prune(desired.stemIds, clockPosition())
        })
        preparing = false
      } else {
        const when = context.currentTime + (activeFocus.length ? START_LEAD : 0)
        focusReady = false
        lastEpoch = usePlaybackStore.getState().epoch
        applyLayerGains(when)
        afterHandoff(token, () => {
          scheduler.stopSources()
          scheduler.prune([], clockPosition())
          activeFocus = []
        })
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
      if (desired.mode === 'focus' && focusReady) applyDynamicFocus()
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
    focusBus = context.createGain()
    focusBus.gain.value = 0
    orchestraGain.connect(master)
    focusBus.connect(master)
    // Nothing else in this graph limits the sum of the always-present
    // full-orchestra layer and the boosted focus layer, so a peak in both at
    // once can clip at the output — audible as distortion, not just a
    // loudness swing. A fast, high-ratio limiter just under 0dBFS catches
    // that without audibly coloring normal, non-overlapping playback.
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.value = -1
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.003
    limiter.release.value = 0.25
    master.connect(limiter)
    limiter.connect(context.destination)
    scheduler.attach(context, focusBus)
    media = new Audio(fullOrchestraUrl(currentExcerpt))
    media.preload = 'auto'
    media.crossOrigin = 'anonymous'
    media.addEventListener('ended', () => {
      usePlaybackStore.getState().setClock(usePlaybackStore.getState().duration)
    })
    mediaSource = context.createMediaElementSource(media)
    mediaSource.connect(orchestraGain)
    const profilePromise = fetchActivityProfile(currentExcerpt.activityUrl).catch(() => null)
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
      media.load()
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
    applySelection(audioSelection(useNavigationStore.getState().navigation))
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
        dynamicFocusGain: lastFocusGain,
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
      focusBus = null
      activityProfile = null
    },
  }
}

export const listeningEngine = createListeningEngine()
