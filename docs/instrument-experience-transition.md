# Map → instrument experience transition

## State ownership

`src/store/experience-store.ts` owns `experienceMode: 'map' | 'explore'`. Its semantic `enterExplore()` action reads the canonical navigation store and succeeds when the current instrument exists in the orchestra catalog. Every mapped instrument can enter the shared exploration shell; Violin is currently the only entry with a 3D model. `exitExplore()` changes only the experience mode.

The navigation hierarchy remains Orchestra → Family → Instrument. Entering Explore leaves `{ level: 'instrument', familyId: 'strings', instrumentId: 'violin' }` intact. Playback, position, zoom-derived listening mix, and loading state live in their existing stores/engine and are never written by the experience transition.

## Component lifecycle

`OrchestraMap` remains mounted for both modes, so its Three.js scene, GSAP navigation state, audio bridge, and current instrument framing survive. The instrument explorer is mounted on first use and retained afterward. The Violin GLB is loaded once per application mount and is disposed with its renderer when the map application unmounts.

The explorer loads `3d/violin/violin-web-anchors.glb` for Violin through `mediaUrl()` (the R2 media base when `VITE_MEDIA_URL` is set, otherwise a local `public/3d` file). The model is not committed. Instruments without a model show a simple unavailable status. The violin model is rotatable (drag/touch) and has 8 named anatomical hotspots with selection, anatomy/technique content, camera focus, and a demonstration layer — see "Anatomy focus" below. Return to the instrument view is the header Back control; returning from a focused anatomy part or technique is a separate, nested Back inside the explorer itself (`AnatomyPanel`/`DemonstrationStage`), not this header control.

## Choreography

`experience-motion.ts` owns one replaceable GSAP timeline. It animates DOM composition only:

- the existing spatial map stage translates/scales and becomes contextual;
- the live map camera simultaneously returns to the full-orchestra framing without changing the stored instrument navigation;
- map labels and buttons fade away before the contextual map settles;
- the persistent header and footer remain visible as a shell around the changing 3D stage;
- the violin model is first mounted after the map has settled, then resolves into the main stage;
- exploration identity resolves last.

The orchestra renderer continues to own its camera/material/activity animation. Explore applies a camera-only orchestra overview while its Zustand navigation remains on the selected instrument, so every node fits inside the contextual map while that instrument's emphasis is retained. The transition never writes raw animation values to Zustand.

On desktop, the live map projects the full-orchestra node bounds, crops the contextual stage to that geometry plus a margin for the outer lights, and scales the result so the whole miniature stays inside the viewport between the header and footer. The contextual frame can therefore use the orchestra's natural aspect ratio instead of preserving the full-screen stage ratio. Its labels and buttons are hidden, its complete floor treatment and node ghost waves are disabled, and the miniature does not receive pointer input. On viewports below 720px it scales to 18% and exits behind the top shell, leaving the model the available stage. The map canvas stays transparent in its empty pixels. The exploration layer keeps the shared canvas color so the model has a continuous ground; the miniature stage does not paint that fill, so its lights sit directly on the exploration stage. The exploration layer occupies only the space between the persistent bars. Targets and timing are centralized in `experience-motion.ts`. Resize/orientation changes recompute the target without replaying the full travel.

The Violin asset rotates 90 degrees around its lengthwise axis so its front sits square to the camera, with no perspective turn around the other axes.

## Rendering lifecycle

Only the foreground experience performs continuous work after a transition settles. While entering exploration, the orchestra scene remains active through the camera and map-shrink motion. It then renders a half-resolution contextual frame, disables multisampling, and suspends animation, audio activity updates, raycasting, and pointer work. Returning to the map resumes its full rendering quality before the transition begins.

The instrument renderer mounts only after the contextual map has settled. It remains available during the return motion, then the exploration stage unmounts and releases its WebGL context once the map is active again.

Selecting Explore for an instrument with a model first enters a preparation phase without changing modes. The Explore control keeps its label and replaces the arrow with a restrained busy indicator while the lazy renderer chunk and GLB load, the asset is decoded, the hidden renderer is created, and its first frame is drawn. The ready callback then starts the map-to-exploration transition. Because the model is already drawable before the map begins to shrink, it can be revealed immediately at the transition endpoint. Instruments without models enter exploration immediately and do not load the model runtime or asset.

Each mode change kills the active timeline without reverting its current rendered values, so rapid Explore/Back actions continue from the visible pose instead of queuing. Cleanup also preserves the settled full-map transform when the exploration stage unmounts. Reduced motion compresses the handoff to a short recomposition/fade. Returning restores map transform, opacity, chrome, and the same instrument navigation state.

## Anatomy focus

Separate from the map↔explore choreography above: once inside the violin
explorer, selecting a named anchor (`src/features/instrument-explorer/instrument-anatomy.ts`)
moves the camera toward it. This lives entirely in `ViolinModel.tsx` as a
sibling mechanism to `ExperienceMotion` — not an extension of it, since that
class only knows the two top-level stage modes and has no notion of a camera.
Selection state (`selectedPartId`, `selectedTechniqueId`, `demonstrationOpen`)
is its own Zustand store, `src/store/anatomy-store.ts`, independent of
`experience-store`/`navigation-store` and of the listening feature's
instrument selection.

Camera behavior: with no hand-authored preset for a part, the camera keeps
its current viewing direction and pulls closer, re-centered on that part's
anchor — this works for every part automatically. A preset in
`anatomy-camera.ts` overrides this with a specifically composed
target/position for a part that needs one (captured via the dev-only tool
below). The pre-focus camera state is snapshotted once and restored on
deselect; selecting a different part while one is focused transitions
directly, without returning to the general view first; any in-flight tween
is killed before a new one starts, so rapid re-selection or Back never stacks
timelines.

Content: `technique.ts` models techniques and demonstrations (audio/video
built; interactive/comparison are typed stubs) separately from anatomy parts,
linked by id. Only the bridge → sul ponticello path is populated for this
first slice — no sul ponticello recording exists yet, so its demonstration
shows an honest "not yet available" state rather than placeholder content.
`demo-playback-coordination.ts` pauses the main orchestral transport when a
demonstration starts playing and resumes it on close only if nothing else
changed the transport in the meantime.

Dev tooling: with `?debug=true` in development, a small overlay in
`ViolinModel.tsx` shows the live camera position/target while focused and
copies a ready-to-paste preset — the only way these numbers get tuned
without guessing, same spirit as `OrchestraMap.tsx`'s existing debug panel.

## Accessibility

During Explore, the map's labels and controls are `inert`; miniature labels do not become tiny keyboard targets. The header Back control stays available and leaves Explore for the same instrument view; it does not withdraw a navigation level. The miniature map is not a pointer target. The persistent shell and playback controls remain available. Focus moves to that header Back control after settling. During return, the explorer becomes inert immediately; map interaction is restored when the map settles, and focus returns to the selected instrument's Explore action. Escape exits Explore before applying the map hierarchy’s normal one-level Back behavior.

## Validation

`tests/experience-mode.mjs` checks eligibility, independence of navigation/mode state, playback-store preservation, rapid semantic mode actions, and desktop/mobile layout targets. `tests/instrument-anatomy.mjs` and `tests/technique.mjs` cover anchor/label/description data and technique linking; `tests/anatomy-store.mjs` covers the selection store's valid-transition rules; `tests/demo-playback-coordination.mjs` covers the pause/resume-on-close logic against the real playback store. Build and lint pass. `npm test`'s full run currently stops earlier, in the pre-existing, unrelated `identity-layout` figure-sizing assertion — the tests above are run standalone via the same Vite-SSR harness the rest of this session's work has used to bypass that.

The violin GLB is not committed. It is loaded from `VITE_MEDIA_URL` (`3d/violin/violin-web-anchors.glb` on the media host) and can still be read from `public/3d` when that variable is unset.
