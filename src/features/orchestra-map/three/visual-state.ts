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
  // Reverted to 1 (see git history for the 0 attempt): although "above
  // ambient" in this field's own comment implies rest should be 0, orchestra
  // hover (hoveredIntensity 0.43) and family selection (familyIntensity
  // 0.46) turn out to depend on the resulting (1 + activity * 0.5) = 1.5x
  // multiplier to cross the bloom threshold (0.65) at all — confirmed: at
  // activity 0 their emissive peaks at 0.516/0.552, both below threshold,
  // silently breaking both highlights. Revisit together with those two
  // config values (and instrumentHoveredIntensity/selectedInstrumentHoveredIntensity/highlightedIntensity,
  // which stay above threshold either way) rather than changing this alone.
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
