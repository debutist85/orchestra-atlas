import type { OrchestraInstrument } from '../orchestra-map/config'
import { useListeningLoadStore } from '../../store/listening-load-store'
import { usePlaybackStore } from '../../store/playback-store'
import { useNavigationStore } from '../../store/navigation-store'
import {
  audioSelection, channelGainDb, connectListeningEngine, linearGainFromDb, type AudioSelection,
} from './audio-selection'
import { clampPlaybackPosition, pulseLevels } from './playback'
import { excerptStems } from './stems'

type Channel = {
  instrument: OrchestraInstrument
  buffers: AudioBuffer[]
  gain: GainNode
  sources: AudioBufferSourceNode[]
}

function createContext() {
  const Ctor = globalThis.AudioContext
  return typeof Ctor === 'function' ? new Ctor() : null
}

async function decodeStem(context: AudioContext, url: string) {
  const response = await fetch(url)
  const type = response.headers.get('content-type') ?? ''
  if (!response.ok || !type.startsWith('audio/')) throw new Error(`Missing stem ${url}`)
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
  let running = false
  let mix: AudioSelection = audioSelection({ level: 'orchestra' })

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

  const applyMix = (selection: AudioSelection) => {
    mix = selection
    if (!context) return
    const now = context.currentTime
    for (const channel of channels.values()) {
      const gain = linearGainFromDb(channelGainDb(channel.instrument, mix))
      channel.gain.gain.setTargetAtTime(gain, now, 0.05)
    }
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
      channel.sources = channel.buffers.flatMap(buffer => {
        if (offset >= buffer.duration) return []
        const source = context!.createBufferSource()
        source.buffer = buffer
        source.connect(channel.gain)
        source.start(when, offset)
        return [source]
      })
    }
    origin = when - offset
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
    const ready: OrchestraInstrument[] = []
    const missing: OrchestraInstrument[] = []
    let loaded = 0
    await Promise.all(stems.map(async stem => {
      const buffers = (await Promise.all(stem.urls.map(url => decodeStem(context!, url).catch(() => null))))
        .filter((buffer): buffer is AudioBuffer => buffer !== null)
      if (buffers.length) {
        const gain = context!.createGain()
        gain.connect(master!)
        channels.set(stem.instrument, { instrument: stem.instrument, buffers, gain, sources: [] })
        ready.push(stem.instrument)
      } else {
        missing.push(stem.instrument)
      }
      loaded += 1
      useListeningLoadStore.getState().setProgress(loaded, stems.length)
    }))
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
    dispose() {
      running = false
      cancelAnimationFrame(frame)
      frame = 0
      stopSources()
      void context?.close()
      context = null
      master = null
      channels.clear()
    },
  }
}

export const listeningEngine = createListeningEngine()
