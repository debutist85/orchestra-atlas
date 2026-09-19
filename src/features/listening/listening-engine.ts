import type { OrchestraInstrument } from '../orchestra-map/config'
import { useListeningLoadStore } from '../../store/listening-load-store'
import { usePlaybackStore } from '../../store/playback-store'
import { useNavigationStore } from '../../store/navigation-store'
import {
  audioSelection, channelGainDb, connectListeningEngine, linearGainFromDb, orchestraAverageIntensity, type AudioSelection,
} from './audio-selection'
import { clampPlaybackPosition, pulseLevels } from './playback'
import { excerptStems } from './stems'
import { currentExcerpt } from './excerpt'
import {
  fetchActivityProfile, instrumentActivityAt, intensityAt, silentActivity, type ActivityProfile,
} from './activity-profile'
import {
  computeRms, createInstrumentAnalyzer, defaultInstrumentAnalysisConfig, type InstrumentActivity,
} from './instrument-activity'

// Offline activity.json is the normal path. Set true only when comparing
// against the previous AnalyserNode/RMS implementation.
export const useLiveInstrumentAnalysis = false

type Channel = {
  instrument: OrchestraInstrument
  buffers: AudioBuffer[]
  gain: GainNode
  sources: AudioBufferSourceNode[]
  analysers: AnalyserNode[]
  analyserBuffers: Float32Array<ArrayBuffer>[]
  analyzer: ReturnType<typeof createInstrumentAnalyzer<OrchestraInstrument>>
  lastActivity: InstrumentActivity<OrchestraInstrument>
}

function createContext() {
  const Ctor = globalThis.AudioContext
  return typeof Ctor === 'function' ? new Ctor() : null
}

async function decodeStem(context: AudioContext, url: string) {
  const response = await fetch(url)
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
  const isAudio = type.startsWith('audio/') || type === 'application/ogg'
  if (!response.ok || !isAudio) throw new Error(`Missing stem ${url}`)
  const data = await response.arrayBuffer()
  return context.decodeAudioData(data.slice(0))
}

export function createListeningEngine() {
  let context: AudioContext | null = null
  let master: GainNode | null = null
  const channels = new Map<OrchestraInstrument, Channel>()
  let origin = 0
  let frame = 0
  let lastEpoch = -1
  let lastPublish = 0
  let lastActivityTime = 0
  let running = false
  let mix: AudioSelection = audioSelection({ level: 'orchestra' })
  let activityProfile: ActivityProfile | null = null

  const clockNow = () => context?.currentTime ?? performance.now() / 1000

  const clockPosition = () => {
    const { duration, position, status } = usePlaybackStore.getState()
    if (!running || status !== 'playing' || !context) return position
    return clampPlaybackPosition(origin + clockNow(), duration)
  }

  const syncOrigin = () => {
    const state = usePlaybackStore.getState()
    origin = state.position - clockNow()
    lastEpoch = state.epoch
  }

  const publish = (force = false) => {
    const time = performance.now()
    if (!force && time - lastPublish < 80) return
    lastPublish = time
    usePlaybackStore.getState().setClock(clockPosition())
  }

  const mixLevels = (instrument: OrchestraInstrument) => {
    if (!activityProfile || mix.selectedInstrumentIds.length !== 1) return undefined
    const time = clockPosition()
    const intensities = [...channels.keys()].map(id => intensityAt(activityProfile!, id, time))
    return {
      instrumentIntensity: intensityAt(activityProfile, instrument, time),
      orchestraAverage: orchestraAverageIntensity(intensities),
    }
  }

  const applyGains = () => {
    if (!context) return
    const now = context.currentTime
    for (const channel of channels.values()) {
      const gain = linearGainFromDb(channelGainDb(channel.instrument, mix, undefined, mixLevels(channel.instrument)))
      channel.gain.gain.setTargetAtTime(gain, now, 0.05)
    }
  }

  const applyMix = (selection: AudioSelection) => {
    mix = selection
    applyGains()
  }

  const stopSources = () => {
    for (const channel of channels.values()) {
      for (const source of channel.sources) {
        try { source.stop() } catch { /* already stopped */ }
      }
      channel.sources = []
    }
  }

  const startSources = (offset: number) => {
    if (!context || !master) return
    stopSources()
    const when = context.currentTime
    for (const channel of channels.values()) {
      channel.sources = channel.buffers.flatMap((buffer, index) => {
        if (offset >= buffer.duration) return []
        const source = context!.createBufferSource()
        source.buffer = buffer
        source.connect(useLiveInstrumentAnalysis ? channel.analysers[index] : channel.gain)
        source.start(when, offset)
        return [source]
      })
    }
    // clockPosition() reads back (origin + clockNow()); this must invert to
    // offset - when, matching syncOrigin()'s formula, so it evaluates to
    // `offset` right as playback starts rather than jumping to some unrelated
    // value derived from how long the AudioContext has been alive.
    origin = offset - when
  }

  const updateLiveActivity = () => {
    const now = performance.now()
    const dt = lastActivityTime === 0 ? 0 : Math.min((now - lastActivityTime) / 1000, 0.1)
    lastActivityTime = now
    for (const channel of channels.values()) {
      const rms = Math.max(0, ...channel.analysers.map((analyser, index) => {
        const buffer = channel.analyserBuffers[index]
        analyser.getFloatTimeDomainData(buffer)
        return computeRms(buffer)
      }))
      channel.lastActivity = channel.analyzer.update(rms, dt)
    }
  }

  const tick = () => {
    frame = 0
    const state = usePlaybackStore.getState()
    if (!running || state.status !== 'playing') return
    if (state.epoch !== lastEpoch) {
      syncOrigin()
      startSources(state.position)
    }
    publish()
    if (mix.selectedInstrumentIds.length === 1) applyGains()
    if (useLiveInstrumentAnalysis) updateLiveActivity()
    if (usePlaybackStore.getState().status === 'playing') frame = requestAnimationFrame(tick)
  }

  const applyTransport = () => {
    const state = usePlaybackStore.getState()
    if (state.status === 'playing' && channels.size) {
      void context?.resume()
      if (!running || state.epoch !== lastEpoch) {
        startSources(state.position)
        lastEpoch = state.epoch
      }
      running = true
      if (!frame) frame = requestAnimationFrame(tick)
      return
    }
    if (running) {
      publish(true)
      stopSources()
      for (const channel of channels.values()) channel.lastActivity = channel.analyzer.reset()
      lastActivityTime = 0
    }
    running = false
    lastEpoch = state.epoch
    cancelAnimationFrame(frame)
    frame = 0
  }

  const load = async () => {
    const stems = excerptStems
    useListeningLoadStore.getState().setProgress(0, stems.length)
    context = createContext()
    if (!context) {
      useListeningLoadStore.getState().setResult([], stems.map(stem => stem.instrument))
      return
    }
    master = context.createGain()
    master.connect(context.destination)
    const profilePromise = fetchActivityProfile(currentExcerpt.activityUrl).catch(() => null)
    const ready: OrchestraInstrument[] = []
    const missing: OrchestraInstrument[] = []
    let loaded = 0
    await Promise.all(stems.map(async stem => {
      const buffers = (await Promise.all(stem.urls.map(url => decodeStem(context!, url).catch(() => null))))
        .filter((buffer): buffer is AudioBuffer => buffer !== null)
      if (buffers.length) {
        const gain = context!.createGain()
        gain.connect(master!)
        const analysers = useLiveInstrumentAnalysis
          ? buffers.map(() => {
            const analyser = context!.createAnalyser()
            analyser.fftSize = defaultInstrumentAnalysisConfig.fftSize
            analyser.connect(gain)
            return analyser
          })
          : []
        const analyserBuffers = analysers.map(analyser => new Float32Array(analyser.fftSize))
        const analyzer = createInstrumentAnalyzer<OrchestraInstrument>(stem.instrument)
        channels.set(stem.instrument, {
          instrument: stem.instrument, buffers, gain, sources: [],
          analysers, analyserBuffers, analyzer, lastActivity: analyzer.reset(),
        })
        ready.push(stem.instrument)
      } else {
        missing.push(stem.instrument)
      }
      loaded += 1
      useListeningLoadStore.getState().setProgress(loaded, stems.length)
    }))
    activityProfile = await profilePromise
    const duration = [...channels.values()].reduce((shortest, channel) => (
      Math.min(shortest, ...channel.buffers.map(buffer => buffer.duration))
    ), Number.POSITIVE_INFINITY)
    if (Number.isFinite(duration)) usePlaybackStore.getState().setDuration(duration)
    applyMix(audioSelection(useNavigationStore.getState().navigation))
    useListeningLoadStore.getState().setResult(ready, missing)
    applyTransport()
  }

  return {
    load,
    applySelection: applyMix,
    connect() {
      void load()
      const stopMix = connectListeningEngine({ applySelection: applyMix })
      const stopTransport = usePlaybackStore.subscribe(applyTransport)
      applyTransport()
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
      for (const channel of channels.values()) {
        if (useLiveInstrumentAnalysis) {
          result.set(channel.instrument, playing ? channel.lastActivity : silentActivity(channel.instrument))
          continue
        }
        result.set(channel.instrument, instrumentActivityAt(activityProfile, channel.instrument, time, playing))
      }
      return result
    },
    dispose() {
      running = false
      cancelAnimationFrame(frame)
      frame = 0
      stopSources()
      void context?.close()
      context = null
      master = null
      activityProfile = null
      channels.clear()
    },
  }
}

export const listeningEngine = createListeningEngine()
