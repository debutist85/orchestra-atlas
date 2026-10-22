import { useEffect, useRef, useState } from 'react'

import { useAnatomyStore } from '../../../store/anatomy-store'
import { performanceEmbedOrigin, performanceEmbedUrl, type InstrumentPerformance } from '../content/explorable-instruments'
import { pauseMainPlaybackForDemo, resumeMainPlaybackAfterDemo } from './demo-playback-coordination'

// Reveal the picture when it is actually moving: the iframe's load event
// comes while the player is still black, so a fade then would be invisible.
// Fallback for a blocked autoplay, which leaves the player waiting for a tap.
const REVEAL_FALLBACK_MS = 3000

// The embed's postMessage protocol (what the YouTube IFrame API wraps):
// after a "listening" handshake the player sends its state.
const PLAYER_ENDED = 0
const PLAYER_PLAYING = 1
const PLAYER_BUFFERING = 3

function playerState(data: unknown) {
  if (typeof data !== 'string') return undefined
  try {
    const message = JSON.parse(data) as { event?: string; info?: unknown }
    if (message.event === 'onStateChange' && typeof message.info === 'number') return message.info
    if (message.event === 'infoDelivery' && typeof message.info === 'object' && message.info) {
      const state = (message.info as { playerState?: unknown }).playerState
      return typeof state === 'number' ? state : undefined
    }
  } catch {
    // Other frames' messages need not be JSON.
  }
  return undefined
}

function PerformanceVideo({ performance, instrumentName }: { performance: InstrumentPerformance; instrumentName: string }) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [ready, setReady] = useState(false)
  // The player's state is only used for the reveal and captions below; the orchestra
  // simply yields for as long as the video is on screen.
  useEffect(() => {
    pauseMainPlaybackForDemo()
    return resumeMainPlaybackAfterDemo
  }, [])

  useEffect(() => {
    if (!loaded) return
    const frame = frameRef.current?.contentWindow
    if (!frame) return
    const send = (message: object) => frame.postMessage(JSON.stringify({ ...message, id: 'performance', channel: 'widget' }), performanceEmbedOrigin)
    let answered = false
    let ended = false
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== performanceEmbedOrigin || event.source !== frame) return
      answered = true
      const state = playerState(event.data)
      if (state === PLAYER_ENDED) ended = true
      // `start` only applies to the first load; YouTube's replay restarts at
      // 0:00, so return to the instrument's passage as soon as it does.
      if (ended && (state === PLAYER_PLAYING || state === PLAYER_BUFFERING)) {
        ended = false
        send({ event: 'command', func: 'seekTo', args: [performance.startSeconds, true] })
      }
      if (state !== PLAYER_PLAYING) return
      setReady(true)
      // Captions (the visitor's YouTube preference or the video's own
      // default) load with playback, and there is no URL parameter that
      // keeps them off, so unload the module each time playback (re)starts.
      // "cc" is the module's older name.
      for (const module of ['captions', 'cc']) send({ event: 'command', func: 'unloadModule', args: [module] })
    }
    window.addEventListener('message', onMessage)
    // The player may not be listening yet when the frame loads; repeat the
    // handshake until it answers, as the official API does.
    const listen = () => { if (!answered) send({ event: 'listening' }) }
    listen()
    const handshake = window.setInterval(listen, 250)
    const fallback = window.setTimeout(() => setReady(true), REVEAL_FALLBACK_MS)
    return () => {
      window.removeEventListener('message', onMessage)
      window.clearInterval(handshake)
      window.clearTimeout(fallback)
    }
  }, [loaded, performance.startSeconds])

  return (
    <figure className="absolute inset-0 m-0 flex flex-col justify-center gap-[0.75rem] px-4">
      <div className="relative aspect-video w-full">
        {!ready && <span className="instrument-demo__loader absolute top-1/2 left-1/2 z-[1] size-5 rounded-full border border-ivory border-r-transparent" role="status" aria-label="Loading performance" />}
        <iframe
          ref={frameRef}
          className={`instrument-performance__media absolute inset-0 block size-full border-0 opacity-0${ready ? ' is-ready' : ''}`}
          src={performanceEmbedUrl(performance, window.location.origin)}
          title={`${performance.performer}, ${instrumentName}, ${performance.ensemble}`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
        />
      </div>
      <figcaption className={`instrument-performance__caption opacity-0${ready ? ' is-ready' : ''} text-[clamp(0.62rem,0.52rem+0.2vw,0.75rem)] leading-[1.5] tracking-[0.2em] text-dust uppercase`}>
        {performance.ensemble} · {performance.performer}
      </figcaption>
    </figure>
  )
}

// Off-canvas panel beside DemonstrationStage, sharing its slide and push.
// It stays mounted so it can slide both ways; the embed mounts only while
// open, so nothing loads or plays off-screen. Closing it is the header Back
// button (OrchestraMap.tsx).
export function PerformanceStage({ performance, instrumentName }: { performance: InstrumentPerformance; instrumentName: string }) {
  const open = useAnatomyStore(state => state.performanceOpen)
  return (
    <div
      id="instrument-performance"
      className="instrument-demo absolute top-0 right-0 z-[4] h-full w-(--demo-panel-width) overflow-hidden bg-(--stage-background)"
      role="region"
      aria-label={`${instrumentName} performance`}
      data-open={open}
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      {open && <PerformanceVideo performance={performance} instrumentName={instrumentName} />}
    </div>
  )
}
