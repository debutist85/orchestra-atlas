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

On desktop, the live map projects the full-orchestra node bounds, crops the contextual stage to that geometry plus a margin for the outer lights, and scales the result so the whole miniature stays inside the viewport between the header and footer. The contextual frame can therefore use the orchestra's natural aspect ratio instead of preserving the full-screen stage ratio. Its labels and buttons are hidden, its complete floor treatment and node ghost waves are disabled, and the miniature does not receive pointer input. On portrait viewports it fits into the left side of the overview heading, beside the instrument title. On a phone in portrait the miniature does not take clicks, so the overview buttons underneath stay usable. On a phone that slot is 46% of the heading and at least 7rem tall; on a tablet it is 34% of the heading and at least 8.5rem tall. The map canvas stays transparent in its empty pixels. The exploration layer keeps the shared canvas color so the model has a continuous ground; the miniature stage does not paint that fill, so its lights sit directly on the exploration stage. The exploration layer occupies only the space between the persistent bars. Targets and timing are centralized in `experience-motion.ts`. Resize/orientation changes recompute the target without replaying the full travel.

The Violin asset rotates 90 degrees around its lengthwise axis so its front sits square to the camera, with no perspective turn around the other axes.

Inactive map nodes blend into light charcoal using the same GSAP timing and
easing as the overview camera transition. Returning blends their original
appearance back in. The blend resumes from its current value when reversed;
reduced motion and resize settling apply the destination appearance directly.

## Rendering lifecycle

Only the foreground experience performs continuous work after a transition settles. While entering exploration, the orchestra scene remains active through the camera and map-shrink motion. It then renders a half-resolution contextual frame, disables multisampling, and suspends animation, audio activity updates, raycasting, and pointer work. Returning to the map resumes its full rendering quality before the transition begins.

The instrument renderer mounts only after the contextual map has settled. It remains available during the return motion, then the exploration stage unmounts and releases its WebGL context once the map is active again.

Selecting Explore for an instrument with a model first enters a preparation phase without changing modes. The Explore control keeps its label and replaces the arrow with a restrained busy indicator while the lazy renderer chunk and GLB load, the asset is decoded, the hidden renderer is created, and its first frame is drawn. The ready callback then starts the map-to-exploration transition. Because the model is already drawable before the map begins to shrink, it can be revealed immediately at the transition endpoint. Instruments without models enter exploration immediately and do not load the model runtime or asset.

Each mode change kills the active timeline without reverting its current rendered values, so rapid Explore/Back actions continue from the visible pose instead of queuing. Cleanup also preserves the settled full-map transform when the exploration stage unmounts. Reduced motion compresses the handoff to a short recomposition/fade. Returning restores map transform, opacity, chrome, and the same instrument navigation state.

## Exploration layout

The exploration shell uses two sibling layout tracks: a charcoal overview panel
on the left and the instrument stage on the right. The overview contains the
family, instrument name, and existing summary; its upper area leaves space for
the live contextual orchestra. The panel is `clamp(280px, 21.4vw, 384px)` wide.
The entire charcoal container is the exploration UI target in the shared GSAP
timeline, so its background and content fade in and out together with the
existing UI timing, including reduced-motion and interrupted transitions.
There is no divider above the instrument title. In landscape, scrolling the
aside fades the fixed minimap to zero opacity over the first 64px; scrolling
back restores it. The fade affects canvas compositing only, leaving the
suspended WebGL scene idle. Returning to the map restores canvas opacity
through the existing transition timeline. On a phone in landscape — landscape, shorter than 768px, and narrower than
1024px, which is often wider than the 719px portrait line — the overview,
anatomy, and demonstration panels are each one third of the viewport width,
and the minimap is sized to that overview column. The title sits at the bottom of that column, and the column clips anything that does not fit. The description moves out
of the overview into its own sheet of the same width, which slides sideways
out from behind the overview, the landscape counterpart of the phone portrait
dropdown. Its text fades with that same slide. A round chevron on the sheet's outer edge opens it (pointing right)
and closes it (pointing left); it uses the same outline, glow, and pressed
highlight as the constellation nodes. The model reframes in the space left
beside the open sheet. The sheet and the panels on the opposite side cannot
be open together: opening Anatomy or a demonstration closes the sheet, and
opening the sheet closes those panels.
The model canvas fills the remaining track and reframes through its existing
ResizeObserver. Anatomy and demonstration panels remain inside that stage;
the overview stays in place while they open.

Portrait viewports stack a scrollable overview above the model.
Orientation alone selects the layout: landscape uses the left panel and
portrait uses the top panel, regardless of viewport width.
The heading places the minimap on the left and the title on the right. On a phone the minimap slot is 46% of the heading; on a tablet it is 34%. The slot is at least 7rem tall on a phone and 8.5rem on a tablet, and it grows with the heading when the title is taller. The title scales relative to its
own column. On a phone the toggle spans a separate row below both columns, and the summary
is initially hidden. The map is repositioned on resize/orientation changes.
The overview wraps its title. In portrait that overview is the same translucent black blur as the landscape aside, and the model continues behind it. The description slides down from behind the overview, the vertical counterpart of the phone landscape sheet, and its text fades with that slide. A chevron on the sheet's lower edge opens it (pointing down) and closes it (pointing up). On a portrait tablet the minimap takes 34% of the header and the title keeps the rest.
A ResizeObserver reads the stage after that reflow and keeps `--explore-stage-height` in step, which sizes the phone rail.
This layout change adds no new Sound,
Techniques, or Orchestral Use navigation.

## Anatomy focus

Anatomy uses the instrument's dark semantic surface and warm foreground tokens;
the map accent remains on hotspots and small indicators. Performance selectively
mutes inactive anatomy content while preserving the background, active technique
and available controls. See [Instrument colors](instrument-colors.md) for token
ownership, aliases, contrast results and validation limits.

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
first slice. The fixed charcoal overview keeps the instrument name and a short
summary. Selecting a part slides one rail in from the right. Anatomy is its first panel; Demonstration follows it, so opening a performance carries Anatomy along instead of moving the panels separately. On a phone in portrait, the rail is vertical and the Anatomy panel is only as tall as its content. Opening a performance pushes that sheet up against the overview and the demonstration fills the stage height left below it. On a portrait tablet the Anatomy column likewise wraps its content instead of filling the stage. The landscape canvas narrows by the anatomy panel width as the panel slides in, simultaneously with the camera zoom. The focused target stays centered in the remaining canvas. Resizing redraws immediately to avoid blank frames. Portrait retains a full-width canvas beneath its details overlay. A technique
that has a video shows a Performance control, which opens the demonstration
panel directly, to the right of the details panel. On landscape the demonstration fills the stage width left beside Anatomy, so Anatomy sits against the overview. The canvas retains its anatomy width while the two panels sit side by side. The sul ponticello demonstration is a local test video,
`public/videos/instruments/violin/arco.mp4`, standing in until a verified
sul ponticello recording is hosted. Timpani has no model yet, so Explore
loads the violin GLB as a placeholder. Stroke and tremolo are attached to
that model's chinrest for timpani only, using
`public/videos/instruments/timpani/stroke.mp4` and
`tremolo.mp4`. Both off-canvas panels are 33vw wide in smaller landscape viewports, 25vw from 1280px, and 100vw in portrait. The demonstration shows only the video. The file is requested when the panel opens, and a
centered indicator stays up until the video can play. It then fades in, with
the whole frame visible inside the panel. While the demonstration is open the
instrument canvas dims (an opacity treatment on its container, not a mesh
material change — fully reversible) and every anatomy marker hides, including
the one for the selected part; the general Anatomy state keeps that one
marker up, only the demonstration hides it too.
`demo-playback-coordination.ts` pauses the main orchestral transport when a
demonstration starts playing and resumes it on close only if nothing else
changed the transport in the meantime.

Local Back controls live beside the content they close, in addition to the
single header Back/Escape (`OrchestraMap.tsx`'s `stepBackFromExplore`):
`AnatomyDetailPanel` has a `← Instrument` control above its scrollable content
that calls `returnToInstrument()` directly, and `DemonstrationStage` has a
`← <part label>` control beside the technique title that calls
`closeDemonstration()` directly — closing a performance this way never also
closes the anatomy part it was opened from. Both local controls call the same
anatomy-store actions the header Back steps through one at a time, rather
than a separate implementation of "go back." The playback-resume call that
used to live only at `stepBackFromExplore`'s call site now lives inside the
anatomy-store actions themselves (`closeDemonstration`, `returnToInstrument`,
and any other transition that can close an open demonstration), so every path
that closes a demonstration resumes playback the same way.

Dev tooling: with `?debug=true` in development, a small overlay in
`ViolinModel.tsx` shows the live camera position/target while focused and
copies a ready-to-paste preset — the only way these numbers get tuned
without guessing, same spirit as `OrchestraMap.tsx`'s existing debug panel.

## Accessibility

During Explore, the map's labels and controls are `inert`; miniature labels do not become tiny keyboard targets. The header Back control stays available and leaves Explore for the same instrument view; it does not withdraw a navigation level. The miniature map is not a pointer target. The persistent shell stays available. Playback controls stay available during Explore and are hidden while a constellation node is open — Discover, a technique note, or a demonstration. They return only after that panel's slide has finished. Focus moves to that header Back control after settling. During return, the explorer becomes inert immediately; map interaction is restored when the map settles, and focus returns to the selected instrument's Explore action. Escape exits Explore before applying the map hierarchy’s normal one-level Back behavior.

## Validation

`tests/experience-mode.mjs` checks eligibility, independence of navigation/mode state, playback-store preservation, rapid semantic mode actions, and desktop/mobile layout targets. `tests/instrument-anatomy.mjs` and `tests/technique.mjs` cover anchor/label/description data and technique linking; `tests/anatomy-store.mjs` covers the selection store's valid-transition rules; `tests/demo-playback-coordination.mjs` covers the pause/resume-on-close logic against the real playback store. Build and lint pass. `npm test`'s full run currently stops earlier, in the pre-existing, unrelated `identity-layout` figure-sizing assertion — the tests above are run standalone via the same Vite-SSR harness the rest of this session's work has used to bypass that.

The violin GLB is not committed. It is loaded from `VITE_MEDIA_URL` (`3d/violin/violin-web-anchors.glb` on the media host) and can still be read from `public/3d` when that variable is unset.
