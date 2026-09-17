import type { OrchestraSceneConfig, OrchestraSectionId } from '../config'

// Independent of Three.js: future selection/playback can supply target values,
// while the renderer owns interpolation. Neutral state retains ambient swirls.
export type SectionVisualState = {
  opacity: number // 0–1 visibility; use emphasis for dimming a visible section.
  emphasis: number // -1 dimmed, 0 neutral, +1 highlighted.
  activity: number // 0–1 additional musical activity above ambient animation.
}

export type OrchestraVisualState = Record<OrchestraSectionId, SectionVisualState>

export const neutralSectionVisualState: Readonly<SectionVisualState> = Object.freeze({
  opacity: 1,
  emphasis: 0,
  activity: 1,
})

// Every section and scene gets its own values; never mutate shared preset data
// to represent selection. Spheres, reflections and light spill share this state.
export function createOrchestraVisualState(
  sections: OrchestraSceneConfig['sections'],
): OrchestraVisualState {
  return Object.fromEntries(
    Object.keys(sections).map((id) => [id, { ...neutralSectionVisualState }]),
  ) as OrchestraVisualState
}
