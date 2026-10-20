import type { PlaybackPlan } from './playback-plan'

export const START_LEAD = 0.08
// Used for the focus-bus stem crossfade (swapping which instrument
// recordings are audible) — short and click-avoidance-oriented, not meant
// to be heard as a fade.
export const HANDOFF_SECONDS = 0.05
// The full-orchestra background layer ducking down when zooming into a
// section (or back up when zooming out) is a musical event the listener
// should actually hear happen, not an instant cut — HANDOFF_SECONDS is far
// too quick (~50ms) for a gain swing this large to read as anything but a
// sudden jump.
export const BACKGROUND_FADE_SECONDS = 0.6

export type TransitionKind = 'none' | 'orchestra-to-focus' | 'focus-to-orchestra' | 'focus-to-focus'

export function sameStemIds(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((id, index) => id === right[index])
}

export function departingStemIds(current: readonly string[], next: readonly string[]) {
  return current.filter(id => !next.includes(id))
}

export function arrivingStemIds(current: readonly string[], next: readonly string[]) {
  return next.filter(id => !current.includes(id))
}

export function transitionKind(from: PlaybackPlan, to: PlaybackPlan): TransitionKind {
  if (from.mode === 'orchestra' && to.mode === 'orchestra') return 'none'
  if (from.mode === 'focus' && to.mode === 'focus' && sameStemIds(from.stemIds, to.stemIds)) return 'none'
  if (from.mode === 'orchestra' && to.mode === 'focus') return 'orchestra-to-focus'
  if (from.mode === 'focus' && to.mode === 'orchestra') return 'focus-to-orchestra'
  return 'focus-to-focus'
}

export function keepPriorFocusOnFailure<State>(current: State, _desired: State): State {
  return current
}
