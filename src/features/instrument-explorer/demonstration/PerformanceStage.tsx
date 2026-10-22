import { useEffect, useLayoutEffect, useRef, useState } from 'react'

import { useAnatomyStore } from '../../../store/anatomy-store'
import { useExploreLayoutStore } from '../../../store/explore-layout-store'
import { performanceEmbedOrigin, performanceEmbedUrl, type InstrumentPerformance } from '../content/explorable-instruments'
import { pauseMainPlaybackForDemo, resumeMainPlaybackAfterDemo } from './demo-playback-coordination'
import { minimapClearance } from './performance-layout'

// Space kept between the minimap and the video, and the panel's own margin.
const MINIMAP_GAP = 16
const PANEL_MARGIN = 16

type FullscreenFrame = HTMLIFrameElement & { webkitRequestFullscreen?: () => void }

// iPhone Safari cannot put an element (an iframe) into fullscreen; the
// button is left out there rather than offered and failing.
function canFullscreen() {
  const doc = document as Document & { webkitFullscreenEnabled?: boolean }
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled)
}

function requestFrameFullscreen(frame: FullscreenFrame | null) {
  if (!frame) return
  if (frame.requestFullscreen) void frame.requestFullscreen().catch(() => {})
  else frame.webkitRequestFullscreen?.()
}

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

type VideoProps = { performance: InstrumentPerformance; instrumentName: string; clearance: number }

function PerformanceVideo({ performance, instrumentName, clearance }: VideoProps) {
  const frameRef = useRef<HTMLIFrameElement>(null)
  const [fullscreen] = useState(canFullscreen)
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

  return <>
    {/* Centered on the panel itself, not on the (offset) video frame. */}
    {!ready && <span className="instrument-demo__loader absolute top-1/2 left-1/2 z-[1] size-5 rounded-full border border-ivory border-r-transparent" role="status" aria-label="Loading performance" />}
    {/* Width-bound in a narrow panel, height-bound on a landscape phone, where a
        full-width 16:9 frame would be taller than the screen: the header and
        a matching bottom margin plus the credit line stay clear. */}
    <figure className="absolute inset-0 m-0 flex items-center justify-center px-4"
      style={{ paddingLeft: Math.max(PANEL_MARGIN, clearance) }}>
      <div className="flex w-[min(100%,calc((100dvh-2*var(--map-chrome-height)-3rem)*16/9))] flex-col gap-[0.75rem]">
        <div className="relative aspect-video w-full">
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
        <figcaption className={`instrument-performance__caption flex items-center justify-between gap-4 opacity-0${ready ? ' is-ready' : ''} text-[clamp(0.62rem,0.52rem+0.2vw,0.75rem)] leading-[1.5] tracking-[0.2em] text-dust uppercase`}>
          <span>{performance.ensemble} · {performance.performer}</span>
          {fullscreen && (
            <button type="button"
              className="-mr-[12px] grid size-[44px] shrink-0 cursor-pointer place-items-center border-0 bg-transparent p-0 text-dust hover:text-ivory focus-visible:text-ivory focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-focus focus-visible:-outline-offset-2"
              aria-label="Watch fullscreen"
              onClick={() => requestFrameFullscreen(frameRef.current)}>
              {/* Lucide Maximize. Provenance and license: public/licenses/lucide.txt. */}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            </button>
          )}
        </figcaption>
      </div>
    </figure>
  </>
}

// Off-canvas panel beside DemonstrationStage, sharing its slide; unlike the
// demonstration it is full screen on every screen size, with a matching push
// (demonstration.css).
// It stays mounted so it can slide both ways; the embed mounts only while
// open, so nothing loads or plays off-screen. Closing it is the header Back
// button (OrchestraMap.tsx).
export function PerformanceStage({ performance, instrumentName }: { performance: InstrumentPerformance; instrumentName: string }) {
  const open = useAnatomyStore(state => state.performanceOpen)
  const minimap = useExploreLayoutStore(state => state.contextualMap)
  const panelRef = useRef<HTMLDivElement>(null)
  const [clearance, setClearance] = useState(0)

  // Measured where the panel rests when open. Its slide is a transform, so
  // layout size plus the (untransformed) explore stage's edges give that
  // rest position even mid-slide; the minimap is published in viewport px.
  useLayoutEffect(() => {
    const panel = panelRef.current
    const stage = panel?.offsetParent
    if (!open || !panel || !(stage instanceof HTMLElement)) return
    const measure = () => {
      const bounds = stage.getBoundingClientRect()
      const rest = { left: bounds.right - panel.offsetWidth, top: bounds.top + panel.offsetTop, width: panel.offsetWidth, height: panel.offsetHeight }
      setClearance(minimapClearance(rest, minimap, MINIMAP_GAP))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(panel)
    return () => observer.disconnect()
  }, [open, minimap])

  return (
    <div
      ref={panelRef}
      id="instrument-performance"
      className="instrument-demo instrument-performance absolute top-0 right-0 z-[4] h-full w-screen overflow-hidden bg-(--stage-background)"
      role="region"
      aria-label={`${instrumentName} performance`}
      data-open={open}
      aria-hidden={open ? undefined : true}
      inert={!open}
    >
      {open && <PerformanceVideo performance={performance} instrumentName={instrumentName} clearance={clearance} />}
    </div>
  )
}
