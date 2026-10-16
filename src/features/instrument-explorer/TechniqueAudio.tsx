import { Ear, Play, Pause } from 'lucide-react'
import type { Technique } from './technique'
import { toggleTechniqueAudio, useTechniqueAudioStore } from './technique-audio-store'

export function TechniqueAudio({ technique }: { technique: Technique }) {
  const id = useTechniqueAudioStore(state => state.techniqueId)
  const status = useTechniqueAudioStore(state => state.status)
  const active = id === technique.id && (status === 'playing' || status === 'loading')
  return <div className="mt-2">
    <button type="button" className="inline-flex items-center gap-2 min-h-11 cursor-pointer text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-4" aria-label={`${active ? 'Pause' : status === 'paused' && id === technique.id ? 'Resume' : 'Hear'} ${technique.title} placeholder audio`} aria-pressed={active} onClick={() => void toggleTechniqueAudio(technique)}>
      {active ? <Pause size={16} strokeWidth={1.5} aria-hidden="true" /> : id === technique.id && status === 'paused' ? <Play size={16} strokeWidth={1.5} aria-hidden="true" /> : <Ear size={16} strokeWidth={1.5} aria-hidden="true" />}
      {active ? (status === 'loading' ? 'Cancel loading' : 'Pause audio') : id === technique.id && status === 'paused' ? 'Resume audio' : 'Hear sample'}
    </button>
    <p className="text-xs leading-relaxed">Shared violin chords placeholder — not a verified example of this technique.</p>
    {id === technique.id && status === 'error' && <p role="status" className="text-xs">Audio unavailable. Select Hear sample to retry.</p>}
  </div>
}
