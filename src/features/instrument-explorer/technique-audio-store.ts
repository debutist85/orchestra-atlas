import { create } from 'zustand'
import { demonstrationById, type Technique } from './technique'
import { pauseMainPlaybackForDemo, resumeMainPlaybackAfterDemo } from './demo-playback-coordination'

let player: HTMLAudioElement | undefined
let generation = 0
let removeListeners: (() => void) | undefined
export const useTechniqueAudioStore = create<{
  techniqueId: string | null
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error'
  progress: number
}>(() => ({ techniqueId: null, status: 'idle', progress: 0 }))

export function stopTechniqueAudio() {
  generation++
  removeListeners?.()
  removeListeners = undefined
  if (player) {
    player.pause()
    player.removeAttribute('src')
    player.load()
    player = undefined
    resumeMainPlaybackAfterDemo()
  }
  useTechniqueAudioStore.setState({ techniqueId: null, status: 'idle', progress: 0 })
}

// One lazy player across every hotspot. Media events drive progress; no timer
// or rendering loop estimates playback position. Pause retains the player.
export async function toggleTechniqueAudio(technique: Technique) {
  const current = useTechniqueAudioStore.getState()
  if (current.techniqueId === technique.id && player && current.status === 'playing') {
    player.pause()
    useTechniqueAudioStore.setState({ status: 'paused' })
    resumeMainPlaybackAfterDemo()
    return
  }
  if (current.techniqueId === technique.id && current.status === 'loading') {
    stopTechniqueAudio()
    return
  }
  const demonstration = technique.demonstrationIds.map(demonstrationById).find(item => item?.type === 'audio' && item.src)
  if (!demonstration || demonstration.type !== 'audio') return
  const resume = current.techniqueId === technique.id && current.status === 'paused' && player
  if (!resume) {
    stopTechniqueAudio()
    player = new Audio(demonstration.src)
  }
  const audio = player!
  const request = generation
  const fail = () => {
    if (request !== generation) return
    stopTechniqueAudio()
    useTechniqueAudioStore.setState({ techniqueId: technique.id, status: 'error' })
  }
  if (!resume) {
    const updateProgress = () => {
      if (request !== generation) return
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : demonstration.durationSeconds
      const progress = duration && duration > 0 ? Math.max(0, Math.min(1, audio.currentTime / duration)) : 0
      useTechniqueAudioStore.setState({ progress })
    }
    const ended = () => { if (request === generation) stopTechniqueAudio() }
    audio.addEventListener('timeupdate', updateProgress)
    audio.addEventListener('durationchange', updateProgress)
    audio.addEventListener('ended', ended)
    audio.addEventListener('error', fail)
    removeListeners = () => {
      audio.removeEventListener('timeupdate', updateProgress)
      audio.removeEventListener('durationchange', updateProgress)
      audio.removeEventListener('ended', ended)
      audio.removeEventListener('error', fail)
    }
  }
  useTechniqueAudioStore.setState({ techniqueId: technique.id, status: 'loading' })
  pauseMainPlaybackForDemo()
  try {
    await audio.play()
    if (request === generation) useTechniqueAudioStore.setState({ status: 'playing' })
  } catch { fail() }
}
