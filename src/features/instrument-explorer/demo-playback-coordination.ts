import { usePlaybackStore } from '../../store/playback-store'

// A technique demonstration and the main orchestral playback must not
// compete. `epoch` (the store's own "a real reposition happened" counter)
// only bumps on seek, not on pause/play — it can't tell us "did the user
// touch the transport while we were holding it paused." A subscription can:
// if status changes for any reason other than our own call below while the
// demo holds it, that's an explicit user decision, and resuming on close
// would override it.
let resumeOnClose = false
let unsubscribeUserOverride: (() => void) | undefined

function stopWatchingForOverride() {
  unsubscribeUserOverride?.()
  unsubscribeUserOverride = undefined
}

export function pauseMainPlaybackForDemo() {
  const store = usePlaybackStore
  if (store.getState().status !== 'playing') return
  resumeOnClose = true
  store.getState().pause()
  stopWatchingForOverride()
  unsubscribeUserOverride = store.subscribe((next, previous) => {
    if (next.status === previous.status) return
    resumeOnClose = false
    stopWatchingForOverride()
  })
}

export function resumeMainPlaybackAfterDemo() {
  stopWatchingForOverride()
  if (resumeOnClose) usePlaybackStore.getState().play()
  resumeOnClose = false
}
