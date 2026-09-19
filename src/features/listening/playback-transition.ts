import type { PlaybackPlan } from './playback-plan'

export const START_LEAD = 0.08
export const HANDOFF_SECONDS = 0.05

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
