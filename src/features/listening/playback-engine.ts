import { usePlaybackStore } from '../../store/playback-store'
import { clampPlaybackPosition, pulseLevels } from './playback'

type Clock = { now: () => number; resume: () => void }

function createClock(): Clock {
  const AudioContextCtor = globalThis.AudioContext
  if (typeof AudioContextCtor !== 'function') {
    const zero = performance.now()
    return { now: () => (performance.now() - zero) / 1000, resume: () => {} }
  }
  const context = new AudioContextCtor()
  return {
    now: () => context.currentTime,
    resume: () => { void context.resume() },
  }
}

// Transport clock only. A licensed recording can attach to this later; the
// chrome reads status, position, and pulse from here rather than from media tags.
export function createPlaybackEngine() {
  let clock: Clock | null = null
  let origin = 0
  let frame = 0
  let lastEpoch = -1
  let lastPublish = 0
  let running = false

  const clockPosition = () => {
    const { duration, position } = usePlaybackStore.getState()
    if (!clock) return position
    return clampPlaybackPosition(origin + clock.now(), duration)
  }

  const syncOrigin = () => {
    const state = usePlaybackStore.getState()
    clock ??= createClock()
    origin = state.position - clock.now()
    lastEpoch = state.epoch
  }

  const publish = (force = false) => {
    const time = performance.now()
    if (!force && time - lastPublish < 80) return
    lastPublish = time
    usePlaybackStore.getState().setClock(clockPosition())
  }

  const tick = () => {
    frame = 0
    const state = usePlaybackStore.getState()
    if (!running || state.status !== 'playing') return
    if (state.epoch !== lastEpoch) syncOrigin()
    publish()
    if (usePlaybackStore.getState().status === 'playing') frame = requestAnimationFrame(tick)
  }

  const apply = () => {
    const state = usePlaybackStore.getState()
    if (state.status === 'playing') {
      clock ??= createClock()
      clock.resume()
      if (!running || state.epoch !== lastEpoch) syncOrigin()
      running = true
      if (!frame) frame = requestAnimationFrame(tick)
      return
    }
    if (running) publish(true)
    running = false
    lastEpoch = state.epoch
    cancelAnimationFrame(frame)
    frame = 0
  }

  return {
    connect: () => {
      apply()
      return usePlaybackStore.subscribe(apply)
    },
    position: clockPosition,
    pulseLevels: (reducedMotion = false) => {
      const state = usePlaybackStore.getState()
      return pulseLevels(running ? clockPosition() : state.position, {
        tempoBpm: state.tempoBpm,
        playing: state.status === 'playing',
        reducedMotion,
      })
    },
    dispose: () => {
      running = false
      cancelAnimationFrame(frame)
      frame = 0
    },
  }
}
