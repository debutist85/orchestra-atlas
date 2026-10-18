import { pauseMainPlaybackForDemo, resumeMainPlaybackAfterDemo } from '../demonstration/demo-playback-coordination'

export type NodeAudioState = { id: string | null; playing: boolean; error: string | null }
type Media = Pick<HTMLAudioElement, 'src' | 'preload' | 'currentTime' | 'duration' | 'ended' | 'paused' | 'play' | 'pause' | 'load' | 'addEventListener' | 'removeEventListener' | 'removeAttribute'>

/** A single user-activated player; progress writes do not re-render the scene. */
export function createNodeAudio({
  createMedia = () => new Audio(),
  onState,
  onProgress,
  requestFrame = requestAnimationFrame,
  cancelFrame = cancelAnimationFrame,
}: {
  createMedia?: () => Media
  onState: (state: NodeAudioState) => void
  onProgress: (id: string, progress: number) => void
  requestFrame?: (callback: FrameRequestCallback) => number
  cancelFrame?: (frame: number) => void
}) {
  let media: Media | undefined
  let id: string | null = null
  let frame = 0
  let detach = () => {}
  const haltFrames = () => { cancelFrame(frame); frame = 0 }
  const progress = () => {
    if (media && id) onProgress(id, Number.isFinite(media.duration) && media.duration > 0 ? Math.min(1, media.currentTime / media.duration) : 0)
  }
  const tick = () => {
    progress()
    if (media && !media.paused && !media.ended) frame = requestFrame(tick)
    else frame = 0
  }
  const stop = () => {
    haltFrames()
    detach()
    if (media) {
      media.pause()
      media.removeAttribute('src')
      media.load()
    }
    if (id) onProgress(id, 0)
    media = undefined
    id = null
    resumeMainPlaybackAfterDemo()
    onState({ id: null, playing: false, error: null })
  }
  const toggle = (nextId: string, src: string) => {
    if (id !== nextId || !media) {
      stop()
      id = nextId
      media = createMedia()
      media.preload = 'none'
      media.src = src
      const current = media
      const playing = () => {
        pauseMainPlaybackForDemo()
        onState({ id: nextId, playing: true, error: null })
        haltFrames()
        tick()
      }
      const paused = () => {
        haltFrames()
        progress()
        resumeMainPlaybackAfterDemo()
        onState({ id: nextId, playing: false, error: null })
      }
      const ended = () => { paused(); onProgress(nextId, 1) }
      const failed = () => {
        haltFrames()
        current.pause()
        resumeMainPlaybackAfterDemo()
        onState({ id: nextId, playing: false, error: 'Audio could not be played. Try again.' })
      }
      const events = { play: playing, pause: paused, ended, error: failed, timeupdate: progress, loadedmetadata: progress }
      for (const [event, listener] of Object.entries(events)) current.addEventListener(event, listener)
      detach = () => {
        for (const [event, listener] of Object.entries(events)) current.removeEventListener(event, listener)
      }
      onState({ id: nextId, playing: false, error: null })
    }
    if (!media.paused && !media.ended) { media.pause(); return }
    if (media.ended) { media.currentTime = 0; progress() }
    const current = media
    void current.play().catch(() => {
      if (media !== current) return
      haltFrames()
      resumeMainPlaybackAfterDemo()
      onState({ id: nextId, playing: false, error: 'Audio could not be played. Try again.' })
    })
  }
  return { toggle, stop }
}
