import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

import { defaultPlayback, formatPlaybackTime } from './playback'
import { listeningEngine } from './listening-engine'
import { useListeningLoadStore } from '../../store/listening-load-store'
import { usePlaybackStore } from '../../store/playback-store'

export function PlaybackControls() {
  const status = usePlaybackStore(state => state.status)
  const position = usePlaybackStore(state => state.position)
  const duration = usePlaybackStore(state => state.duration)
  const toggle = usePlaybackStore(state => state.toggle)
  const seek = usePlaybackStore(state => state.seek)
  const load = useListeningLoadStore()
  const pulsesRef = useRef<HTMLDivElement>(null)
  const ready = load.status === 'ready'
  const playing = ready && status === 'playing'

  // The range input's onChange fires continuously while dragging (it's the
  // native `input` event, not `change`), and seek() bumps epoch on every
  // call — committing on every one of those fired a real chunk-preload
  // fetch cycle for every intermediate position swept through, not just the
  // final target. While actively dragging (tracked via pointer down/up),
  // only update this local value for visual feedback; commit the real
  // seek() once on release. Keyboard stepping (no pointerdown involved)
  // still commits immediately, so arrow-key nudges stay responsive.
  const [scrubPosition, setScrubPosition] = useState<number | null>(null)
  const isDragging = useRef(false)
  const displayPosition = scrubPosition ?? position
  const progress = duration > 0 ? displayPosition / duration : 0

  const commitScrub = (event: ReactPointerEvent<HTMLInputElement>) => {
    if (!isDragging.current) return
    isDragging.current = false
    // A plain click on the thumb (pointerdown/up with no movement) never
    // fires onChange, so scrubPosition stays null — only seek if the value
    // actually changed during the drag, or every simple click would bump
    // epoch and trigger a full reconcile cycle for no real change.
    if (scrubPosition !== null) seek(Number(event.currentTarget.value))
    setScrubPosition(null)
  }

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const levels = listeningEngine.pulseLevels(reduced.matches)
      const bars = pulsesRef.current?.children
      if (!bars) return
      for (let index = 0; index < bars.length; index++) {
        (bars[index] as HTMLElement).style.transform = `scaleY(${levels[index] ?? 0.16})`
      }
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Rendering the toggle/pulses immediately but the scrubber only once ready
  // shifted the header's layout the moment loading finished. Wait for a
  // resolved status (ready or error) and show the whole interface — or just
  // the error message — as a single, layout-stable reveal instead.
  if (load.status === 'loading') return null

  return (
    <fieldset className="playback">
      <legend className="sr-only">Playback</legend>
      {load.status === 'error' ? (
        <output className="playback__status">Recording unavailable</output>
      ) : (
        <>
          <button type="button" className="playback__toggle" onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}>
            {playing
              ? (
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <rect x="2.2" y="1.5" width="2.4" height="9" />
                  <rect x="7.4" y="1.5" width="2.4" height="9" />
                </svg>
              )
              : (
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3.2 1.4v9.2L10.4 6z" />
                </svg>
              )}
          </button>
          <span className="playback__time" aria-hidden="true">{formatPlaybackTime(displayPosition)}</span>
          <input
            className="playback__progress"
            type="range"
            min={0}
            max={duration}
            step={0.01}
            value={displayPosition}
            aria-label="Playback position"
            aria-valuetext={`${formatPlaybackTime(displayPosition)} of ${formatPlaybackTime(duration)}`}
            style={{ '--playback-progress': `${progress * 100}%` } as CSSProperties}
            onPointerDown={() => { isDragging.current = true }}
            onChange={event => {
              const value = Number(event.target.value)
              if (isDragging.current) setScrubPosition(value)
              else seek(value)
            }}
            onPointerUp={commitScrub}
            onPointerCancel={commitScrub}
          />
          <span className="playback__time playback__duration" aria-hidden="true">{formatPlaybackTime(duration)}</span>
          <div ref={pulsesRef} className="playback__pulses" aria-hidden="true">
            {Array.from({ length: defaultPlayback.pulseCount }, (_, index) => <span key={index} />)}
          </div>
        </>
      )}
    </fieldset>
  )
}
