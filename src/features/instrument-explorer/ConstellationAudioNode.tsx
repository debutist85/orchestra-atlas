import { useAnatomyStore } from '../../store/anatomy-store'
import { Ear, Pause } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { Technique } from './technique'
import { toggleTechniqueAudio, useTechniqueAudioStore } from './technique-audio-store'

// Playback position updates SVG directly, keeping React out of media progress.
export function ConstellationAudioNode({ technique }: { technique: Technique }) {
  const ringRef = useRef<SVGCircleElement>(null)
  const [status, setStatus] = useState('idle')
  const lastStatus = useRef('idle')
  useLayoutEffect(() => {
    const update = () => {
      const state = useTechniqueAudioStore.getState()
      const matches = state.techniqueId === technique.id
      const nextStatus = matches ? state.status : 'idle'
      if (nextStatus !== lastStatus.current) { lastStatus.current = nextStatus; setStatus(nextStatus) }
      const progress = matches ? state.progress : 0
      ringRef.current?.setAttribute('stroke-dashoffset', String(100 * (1 - progress)))
      // A fully offset SVG dash can leave a seam pixel. Hide zero progress
      // explicitly, including initial paint, completion and technique changes.
      ringRef.current?.setAttribute('stroke-opacity', progress > 0 ? '1' : '0')
    }
    update()
    return useTechniqueAudioStore.subscribe(update)
  }, [technique.id])
  const playing = status === 'playing'
  return <button type="button" className="contextual-constellation__action" aria-label={`${playing ? 'Pause' : status === 'paused' ? 'Resume' : status === 'loading' ? 'Cancel' : 'Play'} ${technique.title}, placeholder audio`} aria-pressed={playing} aria-busy={status === 'loading'} onClick={() => { useAnatomyStore.getState().openTechniqueNote(technique.id); void toggleTechniqueAudio(technique) }}>
    <span className="contextual-constellation__circle" aria-hidden="true">
      <svg className="contextual-constellation__progress" viewBox="0 0 48 48"><circle ref={ringRef} cx="24" cy="24" r="22" strokeOpacity="0" pathLength="100" strokeDasharray="100" strokeDashoffset="100" /></svg>
      {playing ? <Pause size={20} strokeWidth={1.5} /> : <Ear size={20} strokeWidth={1.5} />}
    </span>
    <span className="contextual-constellation__label">{technique.title}</span>
    {status === 'error' && <span role="status" className="contextual-constellation__label">Unavailable · retry</span>}
  </button>
}
