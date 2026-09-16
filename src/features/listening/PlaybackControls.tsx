import { useEffect, useRef, type CSSProperties } from 'react'

import { defaultPlayback, formatPlaybackTime } from './playback'
import { createPlaybackEngine } from './playback-engine'
import { usePlaybackStore } from '../../store/playback-store'

export function PlaybackControls() {
  const status = usePlaybackStore(state => state.status)
  const position = usePlaybackStore(state => state.position)
  const duration = usePlaybackStore(state => state.duration)
  const toggle = usePlaybackStore(state => state.toggle)
  const seek = usePlaybackStore(state => state.seek)
  const pulsesRef = useRef<HTMLDivElement>(null)
  const playing = status === 'playing'
  const progress = duration > 0 ? position / duration : 0

  useEffect(() => {
    const engine = createPlaybackEngine()
    const disconnect = engine.connect()
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const draw = () => {
      frame = requestAnimationFrame(draw)
      const levels = engine.pulseLevels(reduced.matches)
      const bars = pulsesRef.current?.children
      if (!bars) return
      for (let index = 0; index < bars.length; index++) {
        (bars[index] as HTMLElement).style.transform = `scaleY(${levels[index] ?? 0.16})`
      }
    }
    frame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(frame)
      disconnect()
      engine.dispose()
    }
  }, [])

  return (
    <fieldset className="playback">
      <legend className="sr-only">Playback</legend>
      <button type="button" className="playback__toggle" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
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
      <span className="playback__time" aria-hidden="true">{formatPlaybackTime(position)}</span>
      <input
        className="playback__progress"
        type="range"
        min={0}
        max={duration}
        step={0.01}
        value={position}
        aria-label="Playback position"
        aria-valuetext={`${formatPlaybackTime(position)} of ${formatPlaybackTime(duration)}`}
        style={{ '--playback-progress': `${progress * 100}%` } as CSSProperties}
        onChange={event => seek(Number(event.target.value))}
      />
      <span className="playback__time playback__duration" aria-hidden="true">{formatPlaybackTime(duration)}</span>
      <div ref={pulsesRef} className="playback__pulses" aria-hidden="true">
        {Array.from({ length: defaultPlayback.pulseCount }, (_, index) => <span key={index} />)}
      </div>
    </fieldset>
  )
}
