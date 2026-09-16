import { create } from 'zustand'
import { clampPlaybackPosition, defaultPlayback } from '../features/listening/playback'

export type PlaybackStatus = 'paused' | 'playing'
export type PlaybackState = {
  status: PlaybackStatus
  position: number
  duration: number
  tempoBpm: number
  epoch: number
}

type PlaybackStore = PlaybackState & {
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (position: number) => void
  setClock: (position: number) => void
}

const initial: PlaybackState = {
  status: 'paused',
  position: 0,
  duration: defaultPlayback.duration,
  tempoBpm: defaultPlayback.tempoBpm,
  epoch: 0,
}

export const usePlaybackStore = create<PlaybackStore>((set) => ({
  ...initial,
  play: () => set(state => ({
    status: 'playing',
    position: state.position >= state.duration ? 0 : state.position,
    epoch: state.position >= state.duration ? state.epoch + 1 : state.epoch,
  })),
  pause: () => set({ status: 'paused' }),
  toggle: () => set(state => state.status === 'playing'
    ? { status: 'paused' }
    : {
      status: 'playing',
      position: state.position >= state.duration ? 0 : state.position,
      epoch: state.position >= state.duration ? state.epoch + 1 : state.epoch,
    }),
  seek: position => set(state => ({
    position: clampPlaybackPosition(position, state.duration),
    epoch: state.epoch + 1,
  })),
  setClock: position => set(state => {
    const next = clampPlaybackPosition(position, state.duration)
    if (next >= state.duration && state.status === 'playing') return { position: state.duration, status: 'paused' }
    return Math.abs(next - state.position) < 0.03 ? state : { position: next }
  }),
}))
