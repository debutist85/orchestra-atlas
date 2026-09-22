# Map → instrument experience transition

## State ownership

`src/store/experience-store.ts` owns `experienceMode: 'map' | 'explore'`. Its semantic `enterExplore()` action reads the canonical navigation store and succeeds when the current instrument exists in the orchestra catalog. Every mapped instrument can enter the shared exploration shell; Violin is currently the only entry with a 3D model. `exitExplore()` changes only the experience mode.

The navigation hierarchy remains Orchestra → Family → Instrument. Entering Explore leaves `{ level: 'instrument', familyId: 'strings', instrumentId: 'violin' }` intact. Playback, position, zoom-derived listening mix, and loading state live in their existing stores/engine and are never written by the experience transition.

## Component lifecycle

`OrchestraMap` remains mounted for both modes, so its Three.js scene, GSAP navigation state, audio bridge, and current instrument framing survive. The instrument explorer is mounted on first use and retained afterward. The Violin GLB is loaded once per application mount and is disposed with its renderer when the map application unmounts.

The current prototype explorer contains the supplied `public/3d/violin/violin-web-anchors.glb` for Violin, a simple model-unavailable status for the remaining instruments, minimal identity, and an explicit “Back to orchestra” action. It adds no controls, hotspots, anatomy, techniques, or instrument audio.

## Choreography

`experience-motion.ts` owns one replaceable GSAP timeline. It animates DOM composition only:

- the existing spatial map stage translates/scales and becomes contextual;
- the live map camera simultaneously returns to the full-orchestra framing without changing the stored instrument navigation;
- map labels and buttons fade away before the contextual map settles;
- the persistent header and footer remain visible as a shell around the changing 3D stage;
- the violin model is first mounted after the map has settled, then resolves into the main stage;
- exploration identity and return control resolve last.

The orchestra renderer continues to own its camera/material/activity animation. Explore applies a camera-only orchestra overview while its Zustand navigation remains on the selected instrument, so every node fits inside the contextual map while that instrument's emphasis is retained. The transition never writes raw animation values to Zustand.

On desktop, the live map projects the full-orchestra node bounds, crops the contextual stage to that geometry plus a small margin, and scales the fitted result down by a further 40% in the available upper-left area directly below the top shell. The contextual frame can therefore use the orchestra's natural aspect ratio instead of preserving the full-screen stage ratio. Its labels and buttons are hidden, its complete floor treatment and node ghost waves are disabled, and an invisible pointer target over the miniature map provides an additional return action. On viewports below 720px it scales to 18% and exits behind the top shell, leaving the model the available stage. The map renderer and both stage layers use the same explicit black background so postprocessing cannot introduce a mismatched rectangle. The exploration layer occupies only the space between the persistent bars. Targets and timing are centralized in `experience-motion.ts`. Resize/orientation changes recompute the target without replaying the full travel.

The Violin asset rotates 90 degrees around its lengthwise axis so its front sits square to the camera, with no perspective turn around the other axes.

## Rendering lifecycle

Only the foreground experience performs continuous work after a transition settles. While entering exploration, the orchestra scene remains active through the camera and map-shrink motion. It then renders a half-resolution contextual frame, disables multisampling, and suspends animation, audio activity updates, raycasting, and pointer work. Returning to the map resumes its full rendering quality before the transition begins.

The instrument renderer mounts only after the contextual map has settled. It remains available during the return motion, then the exploration stage unmounts and releases its WebGL context once the map is active again.

Selecting Explore for an instrument with a model first enters a preparation phase without changing modes. The Explore control shows a restrained busy indicator while the lazy renderer chunk and GLB load, the asset is decoded, the hidden renderer is created, and its first frame is drawn. The ready callback then starts the map-to-exploration transition. Because the model is already drawable before the map begins to shrink, it can be revealed immediately at the transition endpoint. Instruments without models enter exploration immediately and do not load the model runtime or asset.

Each mode change kills the active timeline without reverting its current rendered values, so rapid Explore/Back actions continue from the visible pose instead of queuing. Cleanup also preserves the settled full-map transform when the exploration stage unmounts. Reduced motion compresses the handoff to a short recomposition/fade. Returning restores map transform, opacity, chrome, and the same instrument navigation state.

## Accessibility

During Explore, the map's labels and controls are `inert`; miniature labels do not become tiny keyboard targets. The contextual map itself remains a pointer return target, while the persistent shell and playback controls remain available. The exploration stage becomes interactive and focus moves to the return action after settling. During return, the explorer becomes inert immediately; map interaction is restored when the map settles, and focus returns to the selected instrument's Explore action. Escape exits Explore before applying the map hierarchy’s normal one-level Back behavior.

## Validation

`tests/experience-mode.mjs` checks eligibility, independence of navigation/mode state, playback-store preservation, rapid semantic mode actions, and desktop/mobile layout targets. Build and lint pass. The complete repository test command currently stops later in the pre-existing chunk-playback test because its ignored/generated chunk manifest is absent from this checkout.

The violin GLB is currently untracked. It must be included or delivered by the project’s asset pipeline for other checkouts and deployments.
