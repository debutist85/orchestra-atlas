import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'

import { defaultPlayback, formatPlaybackTime } from './playback'
import { listeningEngine } from './listening-engine'
import { useListeningLoadStore } from '../../store/listening-load-store'
import { usePlaybackStore } from '../../store/playback-store'

export function PlaybackControls() {
  const status = usePlaybackStore(state => state.status)
  const hasStarted = usePlaybackStore(state => state.hasStarted)
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
  // shifted the transport layout the moment loading finished. Wait for a
  // resolved status (ready or error) and show the whole interface — or just
  // the error message — as a single, layout-stable reveal instead.
  if (load.status === 'loading') return null

  return (
    <fieldset className="playback m-0 grid min-w-0 grid-cols-[48px_max-content_minmax(0,1fr)_max-content_auto] items-center gap-[0.55rem] border-0 px-1">
      <legend className="sr-only">Playback</legend>
      {load.status === 'error' ? (
        <output className="col-span-full grid gap-[0.28rem] min-w-[7rem] text-[0.72rem] tracking-[0.04em] text-mist uppercase">Recording unavailable</output>
      ) : (
        <>
          <button
            type="button"
            className={[
              'playback__toggle grid size-12 min-w-12 place-items-center rounded-full p-0 box-border transition-colors duration-200 ease-in-out disabled:text-[#6f706a]',
              !hasStarted && 'playback__toggle--inviting',
            ].filter(Boolean).join(' ')}
            onClick={toggle}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing
              ? (
                <svg className="block size-[25px] fill-current" viewBox="0 0 12 12" aria-hidden="true">
                  <rect x="2.2" y="1.5" width="2.4" height="9" />
                  <rect x="7.4" y="1.5" width="2.4" height="9" />
                </svg>
              )
              : (
                <svg className="block size-[25px] fill-current" viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3.2 1.4v9.2L10.4 6z" />
                </svg>
              )}
          </button>
          <span className="w-[2.5em] flex-none text-[0.8rem] tracking-[0.02em] leading-none text-mist tabular-nums" aria-hidden="true">{formatPlaybackTime(displayPosition)}</span>
          <input
            className="playback__progress h-4 w-full min-w-0 m-0 p-0 appearance-none bg-transparent cursor-pointer"
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
          <span className="w-[2.5em] flex-none text-right text-[0.8rem] tracking-[0.02em] leading-none text-mist tabular-nums" aria-hidden="true">{formatPlaybackTime(duration)}</span>
          <div ref={pulsesRef} className="flex items-end gap-[3px] h-[18px] px-[15px] pb-px" aria-hidden="true">
            {Array.from({ length: defaultPlayback.pulseCount }, (_, index) => (
              <span key={index} className="block w-[2.5px] h-[18px] origin-bottom bg-[rgb(239_239_234/55%)] scale-y-[0.16]" />
            ))}
          </div>
        </>
      )}
    </fieldset>
  )
}
