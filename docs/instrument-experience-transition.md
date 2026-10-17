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

On desktop, the live map projects the full-orchestra node bounds, crops the contextual stage to that geometry plus a margin for the outer lights, and scales the result so the whole miniature stays inside the viewport between the header and footer. The contextual frame can therefore use the orchestra's natural aspect ratio instead of preserving the full-screen stage ratio. Its labels and buttons are hidden, its complete floor treatment and node ghost waves are disabled, and the miniature does not receive pointer input. The contextual miniature always stays on screen in the top-left corner, on every viewport; on phones (shorter side below 500px) it is drawn larger when held upright and smaller on its side (`minimapSize`). The settled miniature's on-screen rectangle is published to `src/store/explore-layout-store.ts` (viewport px, a layout target rather than an animation value) so the instrument stage can keep clear of it. It is published when entering Explore and cleared only once the return to the map has settled, so the instrument stage is not recomposed — and the model not re-framed — while it fades out. The map canvas stays transparent in its empty pixels. The exploration layer keeps the shared canvas color so the model has a continuous ground; the miniature stage does not paint that fill, so its lights sit directly on the exploration stage. The exploration layer occupies only the space between the persistent bars. Targets and timing are centralized in `experience-motion.ts`. Resize/orientation changes recompute the target without replaying the full travel.

The Violin asset rotates 90 degrees around its lengthwise axis so its front sits square to the camera, with no perspective turn around the other axes.

## Rendering lifecycle

Only the foreground experience performs continuous work after a transition settles. While entering exploration, the orchestra scene remains active through the camera and map-shrink motion. It then renders a half-resolution contextual frame, disables multisampling, and suspends animation, audio activity updates, raycasting, and pointer work. Returning to the map resumes its full rendering quality before the transition begins.

The instrument renderer mounts only after the contextual map has settled. It remains available during the return motion, then the exploration stage unmounts and releases its WebGL context once the map is active again.

Selecting Explore for an instrument with a model first enters a preparation phase without changing modes. The Explore control keeps its label and replaces the arrow with a restrained busy indicator while the lazy renderer chunk and GLB load, the asset is decoded, the hidden renderer is created, and its first frame is drawn. The ready callback then starts the map-to-exploration transition. Because the model is already drawable before the map begins to shrink, it can be revealed immediately at the transition endpoint. Instruments without models enter exploration immediately and do not load the model runtime or asset.

A page opened directly on an explore URL launches straight into the explorer: the launch overlay holds (at 99%) until the explorer has been presented behind it with an instant transition, so the map — already zoomed to the instrument — never shows first. If preparing the model fails, the overlay releases and the map is the fallback.

Each mode change kills the active timeline without reverting its current rendered values, so rapid Explore/Back actions continue from the visible pose instead of queuing. Cleanup also preserves the settled full-map transform when the exploration stage unmounts. Reduced motion compresses the handoff to a short recomposition/fade. Returning restores map transform, opacity, chrome, and the same instrument navigation state.

## Anatomy focus

Separate from the map↔explore choreography above: once inside the violin
explorer, selecting a named anchor (`src/features/instrument-explorer/instrument-anatomy.ts`)
moves the camera toward it. This lives entirely in `ViolinModel.tsx` as a
sibling mechanism to `ExperienceMotion` — not an extension of it, since that
class only knows the two top-level stage modes and has no notion of a camera.
Selection state (`selectedPartId`, `selectedActionId`, `demonstrationOpen`)
is its own Zustand store, `src/store/anatomy-store.ts`, independent of
`experience-store`/`navigation-store` and of the listening feature's
instrument selection.

Re-framing (resize, or a recomposed model frame) keeps the visitor's orbit: only the camera distance and projection shift follow the frame, and the model bounds the labels anchor to are measured from a front-pose scratch camera. A re-frame requested while a part is focused, or while the camera is still travelling back, is deferred until it lands.

Camera behavior: the camera always looks at the focused part, and the projection shift that places the whole instrument in its composed frame eases to zero on the same curve, so the part ends in the center of the stage (both axes); returning eases the shift back to the frame's. With no hand-authored preset for a part, the camera keeps
its current viewing direction and pulls closer, re-centered on that part's
anchor — this works for every part automatically. A preset in
`anatomy-camera.ts` overrides this with a specifically composed
target/position for a part that needs one (captured via the dev-only tool
below). The pre-focus camera state is snapshotted once and restored on
deselect; selecting a different part while one is focused transitions
directly, without returning to the general view first; any in-flight tween
is killed before a new one starts, so rapid re-selection or Back never stacks
timelines.

Content: each focused part offers a series of actions (`technique.ts`).
Every part has **Discover** first, which reveals the part's description
(`instrument-anatomy.ts`), followed by the playing techniques configured for
that part on that instrument (`instrumentPartActions`: instrument → anatomy
anchor → technique id → media, `audio` and/or `video`, in display order).
Techniques are a shared catalog (title, description) linked by id, so one
technique can serve several parts or instruments. Media files are a separate
per-instrument registry; a configured medium without a file shows as not yet
available. The violin is configured as Bow (col legno · audio, arco · video),
Bridge (sul ponticello · audio, chords · audio, pizzicato · video),
Fingerboard (harmonics · audio), and Discover only for the other parts. The
only violin file so far is `public/videos/instruments/violin/arco.mp4`, now
attached to Arco. Timpani has no model yet, so Explore loads the violin GLB
as a placeholder; stroke and tremolo (video) are attached to that model's
chinrest for timpani only, using
`public/videos/instruments/timpani/timpanist_male_default.mp4` and
`timpanist_male_tremolo.mp4`. Actions are presented as a plain list in
`AnatomyPanel` until the action-node presentation is designed. The demonstration is an off-canvas panel:
25vw wide in landscape and 100vw in portrait. Opening it slides the panel in
from the right and pushes the instrument stage left by that same width. The
panel shows only the video. The file is requested when the panel opens, and a
centered indicator stays up until the video can play. It then fades in, with
the whole frame visible inside the panel.
`demo-playback-coordination.ts` pauses the main orchestral transport when a
demonstration starts playing and resumes it on close only if nothing else
changed the transport in the meantime.

Dev tooling: with `?debug=true` in development, a small overlay in
`ViolinModel.tsx` shows the live camera position/target while focused and
copies a ready-to-paste preset — the only way these numbers get tuned
without guessing, same spirit as `OrchestraMap.tsx`'s existing debug panel.

## Spatial typography

In the full-instrument view, the family title and instrument title are semantic HTML (`SpatialTypography.tsx`) placed on invisible depth planes beside the model. `spatial-typography.ts` holds the per-plane configuration (depth, position, parallax strength, opacity, scale, blur), per-instrument position overrides, and which plane each text belongs to, plus the pure layout, composition, offset, and damping math.

Labels never overlap the model's box, so hotspots stay uncovered. On a portrait stage (a phone held upright) they always go on top (`portraitLabelSide`), right-aligned to the stage edge, starting to the right of the contextual minimap, with the model frame starting below it. With labels on the right, the centered composition moves clear of the minimap when the model frame would otherwise run under it (`composeStage`). On a landscape stage the side follows the model's own front-view shape, not the viewport's: right of a tall model, above a wide one (width/height ≥ `wideModelAspect`). Plane positions are configured per side. The typography composes the stage: the available area is the viewport safe area between the header and footer, less an edge margin. The label group is measured first, then the area is split — the labels get their own side and the model gets a frame matched to its front-view aspect in the rest, narrowed beside right-hand labels or shortened below top labels when they need room (at most `maxLabelShare` of the area goes to labels), with model and labels centered together. The frame is published on the view signal (`instrument-view.ts`); `ViolinModel.tsx` publishes the model's aspect on load, fits the model into the frame on both axes, and shifts the projection (`setViewOffset`) so the model lands there while the camera still orbits its center. The fit is exact under perspective: it uses the model's sampled vertices (`model-extent.ts`), not its bounding box, which would assume the extremes sit on the deepest face and leave a thin instrument short of its frame. The model frame has its own, smaller edge margin (`modelEdgeMargin`) than the labels (`edgeMargin`), so on a short screen it uses nearly all the height between the header and footer bars. It then publishes the model's measured front-view screen bounds (projected from the same vertices), and the planes are placed relative to them, confined to the labels' side.

Each plane's position is a point on a reference box — the model bounds, or another plane's box via `relativeTo` (the family title sits on the instrument title) — with alignment (start/center/end) and a px offset. Planes are confined to the labels' side less their own parallax reach, so text stays clear of the model and the screen edges mid-rotation. Widths are capped to the space a plane has, so text wraps where it stands; linked planes are contained as one group.

The instrument description is not part of this layout: it stays in the instrument data and will be presented separately, asynchronously.

Parallax is derived from the instrument camera, not the pointer: `ViolinModel.tsx` publishes OrbitControls' azimuth/polar angles on the same signal, and the typography damps toward the resulting offsets on the GSAP ticker, writing transforms through refs and stopping once settled. Reduced motion disables the parallax.

When a hotspot is focused, the titles travel with the zoom (`label-travel.ts`): each title moves away from the focused part's live on-screen position and grows by how far the camera has dollied toward the part, as text standing in the scene would — a plane nearer or further by its `depth` × `travelDepthSpacing` rushes past faster or slower. `ViolinModel.tsx` shares the camera and the zoom's focus point on the view signal. Only the dolly drives the titles, not the camera's turn toward the part: projecting fixed world points through a camera that tilts as it travels (e.g. the bridge close-up, which looks up from below) swung them past their place and back on the way home. Meanwhile they fade out while their letter spacing opens by `identityTrackingExpansionEm` (0.18em), with the departing map caption's timing (`navigationTiming`: 50ms start, 760ms, `power2.inOut`); returning to the full view reverses it — titles come home, fade in, and contract. The travel runs for the camera's `focus.duration` (config.ts). Parallax and stage layout are suspended during the travel and resume when it settles; switching between parts keeps the titles out. Reduced motion skips the travel and fades instantly. `AnatomyPanel` shows the part content while focused, as before.

## Accessibility

During Explore, the map's labels and controls are `inert`; miniature labels do not become tiny keyboard targets. The header Back control stays available and leaves Explore for the same instrument view; it does not withdraw a navigation level. The miniature map is not a pointer target. The persistent shell stays available. Playback controls stay available during Explore and are hidden while a demonstration panel is open. Focus moves to that header Back control after settling. During return, the explorer becomes inert immediately; map interaction is restored when the map settles, and focus returns to the selected instrument's Explore action. Escape exits Explore before applying the map hierarchy’s normal one-level Back behavior.

## Validation

`tests/experience-mode.mjs` checks eligibility, independence of navigation/mode state, playback-store preservation, rapid semantic mode actions, and desktop/mobile layout targets. `tests/instrument-anatomy.mjs` and `tests/technique.mjs` cover anchor/label/description data and technique linking; `tests/anatomy-store.mjs` covers the selection store's valid-transition rules; `tests/demo-playback-coordination.mjs` covers the pause/resume-on-close logic against the real playback store. Build and lint pass. `npm test`'s full run currently stops earlier, in the pre-existing, unrelated `identity-layout` figure-sizing assertion — the tests above are run standalone via the same Vite-SSR harness the rest of this session's work has used to bypass that.

The violin GLB is not committed. It is loaded from `VITE_MEDIA_URL` (`3d/violin/violin-web-anchors.glb` on the media host) and can still be read from `public/3d` when that variable is unset.
