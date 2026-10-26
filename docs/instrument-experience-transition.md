# Map → instrument experience transition

## State ownership

`src/store/experience-store.ts` owns `experienceMode: 'map' | 'explore'`. Its semantic `enterExplore()` action reads the canonical navigation store and succeeds when the current instrument exists in the orchestra catalog. Every mapped instrument can enter the shared exploration shell. Violin, horn, trumpet, flute, and trombone currently have 3D models. `exitExplore()` changes only the experience mode.

The navigation hierarchy remains Orchestra → Family → Instrument. Entering Explore leaves `{ level: 'instrument', familyId: 'strings', instrumentId: 'violin' }` intact. Playback, position, zoom-derived listening mix, and loading state live in their existing stores/engine and are never written by the experience transition: the music keeps playing in Explore. The map stops feeding audible activity in Explore and clears it, so the white activity rings release instead of freezing on the miniature; any still fading when the map deactivates are snapped off. The footer playback controls and the header's Full orchestra lock stay available in Explore; the footer fades out only while a demonstration or performance panel is open.

## Component lifecycle

`OrchestraMap` remains mounted for both modes, so its Three.js scene, GSAP navigation state, audio bridge, and current instrument framing survive. The instrument explorer is mounted on first use and retained afterward. The Violin GLB is loaded once per application mount and is disposed with its renderer when the map application unmounts.

The explorer loads `3d/violin/violin-web-anchors.glb` for Violin, `3d/horn/horn.glb` for horn, `3d/trumpet/trumpet.glb` for trumpet, `3d/flute/flute.glb` for flute, and `3d/trombone/trombone.glb` for trombone through `mediaUrl()` (the R2 media base when `VITE_MEDIA_URL` is set, otherwise a local `public/3d` file). The models are not committed. Instruments without a model show a simple unavailable status. The violin model is rotatable (drag/touch) and has 8 named anatomical hotspots with selection, anatomy/technique content, camera focus, and a demonstration layer — see "Anatomy focus" below. Return to the instrument view is the header Back control; the same hierarchy-aware header Back steps out of a demonstration, technique, and anatomy part before leaving Explore.

## Choreography

`experience-motion.ts` owns one replaceable GSAP timeline. It animates DOM composition only:

- the existing spatial map stage translates/scales and becomes contextual;
- the live map camera simultaneously returns to the full-orchestra framing without changing the stored instrument navigation;
- map labels and buttons fade away before the contextual map settles;
- the persistent header and footer remain visible as a shell around the changing 3D stage;
- the violin model is first mounted after the map has settled, then resolves into the main stage;
- exploration identity resolves last.

After a 400ms entrance delay, inner text wrappers slide 24px into place over 350ms
with `power2.out`: the family name and description enter from the left, and
the instrument name from the right. The same replaceable GSAP timeline owns
the entry, so interrupted transitions do not leave separate animations running.
Outer elements retain their layout, parallax, and focus transforms. Reduced
motion uses a 160ms fade without translation; instant entry skips both.

On desktop, the live map projects the full-orchestra node bounds, crops the contextual stage to that geometry plus a margin for the outer lights, and scales the result so the whole miniature stays inside the viewport between the header and footer. The contextual frame can therefore use the orchestra's natural aspect ratio instead of preserving the full-screen stage ratio. Its labels and buttons are hidden, its complete floor treatment and node ghost waves are disabled, and the miniature does not receive pointer input. The contextual miniature always stays on screen in the top-left corner, on every viewport; on phones (shorter side below 500px) it is drawn larger when held upright and smaller on its side (`minimapSize`). The settled miniature's on-screen rectangle is published to `src/store/explore-layout-store.ts` (viewport px, a layout target rather than an animation value) so the instrument stage can keep clear of it. It is published when entering Explore and cleared only once the return to the map has settled, so the instrument stage is not recomposed — and the model not re-framed — while it fades out. The map canvas stays transparent in its empty pixels. The exploration layer keeps the shared canvas color so the model has a continuous ground; the miniature stage does not paint that fill, so its lights sit directly on the exploration stage. The exploration layer occupies only the space between the persistent bars. Targets and timing are centralized in `experience-motion.ts`. Resize/orientation changes recompute the target without replaying the full travel.

The Violin asset rotates 90 degrees around its lengthwise axis so its front sits square to the camera, with no perspective turn around the other axes.

## Rendering lifecycle

Only the foreground experience performs continuous work after a transition settles. While entering exploration, the orchestra scene remains active through the camera and map-shrink motion. It then renders a half-resolution contextual frame, disables multisampling, and suspends animation, audio activity updates, raycasting, and pointer work. Returning to the map resumes its full rendering quality before the transition begins.

The instrument render loop sleeps while nothing changes and is woken by input (OrbitControls start/change), camera tweens, re-frames, and resizes; it runs until damped rotation has coasted to a stop. Hotspot positions are projected every rendered frame and written directly to the buttons (React renders the hotspot list once). Their occlusion raycasts, the costliest per-frame work, are spread round-robin over moving frames (`anchors.occlusionChecksPerFrame` in config.ts), with one full pass once the camera settles.

The instrument renderer mounts only after the contextual map has settled. It remains available during the return motion, then the exploration stage unmounts and releases its WebGL context once the map is active again.

Selecting Explore for an instrument with a model first enters a preparation phase without changing modes. The Explore control keeps its label and replaces the arrow with a restrained busy indicator while the lazy renderer chunk and GLB load, the asset is decoded, the hidden renderer is created, and its first frame is drawn. The ready callback then starts the map-to-exploration transition. Meanwhile the instrument's own lights on the map are the loading indicator (`three/loading-wave.ts`, tuned by `visuals.loadingWave` in `config.ts`): every light of the instrument, and only those, rises toward the camera along the camera's depth axis (by a share of its own depth) and settles back, with a matching glow lift. Perspective grows each light and eases it slightly outward from the screen center, so the constellation stays recognisable while the ripple reads. Its ghosts, which are drawn at the seat, fade out with the wave and return as it settles. Fewer lights cycle faster: one light takes `singlePeriodSeconds` (1.2 s), and the cycle lengthens evenly with the count up to `periodSeconds` (2.3 s) from `fullPeriodNodeCount` (8) lights on. One light pulses alone; two or three follow each other in left-to-right order with a short delay; four or more lag by their projected position along a slightly tilted left-to-right direction, capped at under one cycle, so a large section carries one ripple. The phases are projected from the live camera when preparation starts and after a resize. Positions are computed from each light's seat every frame and the wave blends in and out by weight, so ready, failure, Back, and navigation all settle the lights rather than snapping them; the blend-out overlaps the start of the camera transition. The lights also hold the selected-instrument hover brightness while preparing, so the pointer leaving them does not dim the selection. Reduced motion keeps that brightness and the "Preparing" status without movement. Because the model is already drawable before the map begins to shrink, it can be revealed immediately at the transition endpoint. While the music plays, the instrument's activity rings keep following it and move with their lights (the scene hands each light's wave offset to its ring). Preparation ends when the model is drawable and the scene reports that `visuals.loadingWave.minimumCycles` (1) of the instrument's own wave cycle has played, so a cached model waits out the rest before the transition starts. Once the transition into Explore starts, the rings release with the cleared activity (see State ownership). Instruments without models do not load the model runtime or asset, but still hold for those cycles before entering. Reduced motion and deep links skip the minimum. While it lasts, a small "Preparing [instrument]…" line fades in under the instrument title, led by a mini `OrchestraFanLoader` (24px, heavier `strokeWidth`, starting mid-cycle; its animation is paused while the line is faded out). It is positioned out of the caption's flow, so the measured title group and its placement do not change. A separate screen-reader status announces the same.

A page opened directly on an explore URL launches straight into the explorer: the launch overlay holds (at 75%, the other loading stages done) until the explorer has been presented behind it with an instant transition, so the map — already zoomed to the instrument — never shows first. If preparing the model fails, the overlay releases and the map is the fallback.

Each mode change kills the active timeline without reverting its current rendered values, so rapid Explore/Back actions continue from the visible pose instead of queuing. Cleanup also preserves the settled full-map transform when the exploration stage unmounts. Reduced motion compresses the handoff to a short recomposition/fade. Returning restores map transform, opacity, chrome, and the same instrument navigation state.

## Rotation affordance

Once the map-to-Explore transition has settled (`exploreSettled` in the
experience store), the instrument shows that it can be turned: the "Drag to
rotate" ring (below) fades in at once, and after `idleOrbit.startDelayMs`
the camera sways ±4° around the instrument's
vertical axis over an 8s cycle (`scene/idle-orbit.ts`, settings in
`instrumentExplorerConfig.idleOrbit`), eased in from rest. It is the camera
that moves, through the stage's own render loop, as OrbitControls orbits the
camera: hotspots, labels and parallax follow exactly as for a drag, and the
model's transforms never change. The ring sits under the instrument: a circle seen tilted about the horizontal axis
(an ellipse), formed by two arrows chasing each other round it
(`scene/rotate-ring.ts`), each a band thick and bright at the front and thin
and faint at the back, with heads scaled to match. It pulses slowly
(opacity 100% to 45% and back over 3.2s; still under reduced motion). The far arrow is drawn in a layer under the WebGL
canvas (which is transparent where there is no model), the near arrow
over it, both in the same place, so the instrument covers the far
arrow where it passes behind. It is static: placed from the instrument's visible
bounds when it appears and again only when the stage size or framing
changes, never with the sway. It is as wide as the instrument's on-screen
bounding box (at most 420px, at least 64px). It sits just under the
instrument, centered on it, and keeps above the footer and above explorer
text that starts under the instrument (the portrait description and Watch
node; text beside it, like the landscape Watch node, does not count); where that leaves too little room it
rises over the instrument's base like a turntable. On a resize or a phone
turning it fades out quickly and is placed afresh once the explorer text has
glided into its new layout (`description:settled`, bubbled from
SpatialTypography; 700ms if nothing moved), so it never hops through the
in-between positions. It never takes the pointer and is hidden from screen readers.

Both run only while nothing else has the visitor's attention: no part
selected or camera focus travelling, no demonstration or performance panel
open, not dragging, not in debug. Anything else stops the sway where it is
(the pose is held, so a drag continues from exactly what is on screen) and
fades the hint out. A press on the model only pauses the sway: the hint
stays until the press actually turns the camera (a drag), so a click that
rotates nothing never blinks it out, and the sway resumes on release. A drag that actually turns the instrument (more than
`discoveredRadians`) marks rotation as discovered for the rest of the
session for that instrument: no sway or hint again on it, while other
instruments keep their own affordance until rotated. The orientation the
visitor chose is kept. A tap does not count. Otherwise the
affordance resumes once the view is back to its default state. Reduced
motion has no sway but still shows the static hint until the first turn.

## Anatomy focus

Separate from the map↔explore choreography above: once inside an
instrument's explorer, selecting a named anchor (`src/features/instrument-explorer/content/instrument-anatomy.ts`)
moves the camera toward it. This lives entirely in `InstrumentModel.tsx` as a
sibling mechanism to `ExperienceMotion` — not an extension of it, since that
class only knows the two top-level stage modes and has no notion of a camera.
Selection state (`selectedPartId`, `selectedActionId`, `demonstrationOpen`)
is its own Zustand store, `src/store/anatomy-store.ts`, independent of
`experience-store`/`navigation-store` and of the listening feature's
instrument selection.

Re-framing (resize, or a recomposed model frame) keeps the visitor's orbit: only the camera distance and projection shift follow the frame, while label reference bounds are supplied by the shared spatial-layout probe (maximum orbit envelope by default, live edges through `labelBounds: 'live'`). The front-pose scratch bounds are a framing fallback. A re-frame requested while a part is focused, or while the camera is still travelling back, is deferred until it lands.

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

The anatomy close-up adds a non-interactive CSS radial-gradient overlay between
canvas and hotspot markers; the surrounding HTML chrome and activity layers stay
above it. Its transparent center follows the selected anchor’s live projection,
including during the return journey. Opacity shares the camera timeline, duration,
and easing; reduced motion applies both states immediately. Defaults and optional
GLB-anchor overrides live in `config.ts` (`anatomySpotlightDefaults` and
`anatomySpotlightOverrides`): `radius` is the outer radius as a fraction of the
stage’s shorter side, `softness` is the share of that radius used for the falloff,
`darkness` is maximum edge opacity, and `offset` is an [x, y] screen offset in
fractions of the shorter side. No overrides are required by default.

Content: the anatomy note shows each part’s description automatically. An enlarged copy of the selected radial node's icon heads the note (40px, decorative): the Book Open while Discover is selected, the selected technique's medium icon (Ear) otherwise, not its transient Pause; parts without radial nodes have none.
Discover is the default anatomy note, represented by a Lucide Book Open node
only when the part also has playable media nodes. Clicking it clears the
technique, stops node audio, and restores the anatomy description. It is
active while no technique is selected; no separate Discover selection or
demonstration panel is needed. Technique configuration and media sources stay in
`technique.ts`; `playablePartActions()` exposes the configured technique/media
pairs. Techniques are configured for audio only: each instrument's one video
is its performance (see "Performance video" below), so there are no Eye
(watch) nodes among the listening nodes. The video path (`demonstrationsFor`,
the demonstration panel) remains for a technique configured with `video`. All
audio currently uses a user-specified temporary playback fixture,
`public/audio/instruments/violin/chords.ogg`, across all instruments.
These fixtures do not claim to demonstrate each technique or instrument.
The registry retains action-specific ids and titles while sharing the files.
Parts without configured techniques have no nodes, including Discover.

Radial HTML buttons replace the old anatomy action list. They share the note’s destination-camera
hotspot projection and arrange even interior samples of a 180° left semicircle
in landscape or top semicircle in portrait, in order: from the top down in
landscape, so Discover (always first) is the topmost node, and left to right
in portrait. A common radius adapts to count,
48px hit areas, preferred 76px center spacing (56px minimum), safe insets, persistent bars, minimap, and
the anatomy-note band. Unsafe intermediate travel poses hide the nodes until
a valid arc fits, rather than clamping nodes together or moving the camera.
The preferred radius uses 38% of the shorter safe-area side, up to 260px,
then steps down to the largest nearby arc that fits. There are no lines or visible arcs. Nodes enter from the left in landscape or above in portrait after the note’s
400ms delay, with a 64px slide and 400ms fade and a 55ms stagger; reduced motion skips it. Lucide Ear
and Eye SVGs have their source and ISC notice in `public/licenses/lucide.txt`.
Hover and focus strengthen the soft glow; the selected node (aria-pressed)
stands apart with a solid bright ring, a stronger halo, a brighter fill, and a
1.14 scale. Each button has a media-
and technique-specific accessible name and uses normal Tab/Enter/Space input.
Selecting an audio node records its technique and medium, replaces the floating
note’s name and description with that technique, and plays the recording
through the node itself. Ear becomes Pause during playback; clicking again
pauses, and another click resumes. A white SVG outline grows clockwise from
the top using media time/duration, updated directly on animation frames only
while playing. There are no extra audio controls in the note. Completion
restores Ear and allows replay from the start. It never opens the sliding panel or shifts the stage.
Back clears the technique and restores anatomy text; switching part or leaving
focus stops the audio. Audio pauses main playback and safely resumes it on
end, error, or unmount using the existing coordination layer. A video node
(none configured) would open the demonstration panel below directly.

The demonstration is an off-canvas panel:
25vw wide in landscape and 100vw in portrait and on phones in either orientation (shorter side up to 500px, the minimap's phone rule). Opening it slides the panel in
from the right and pushes the instrument stage left by that same width. The
panel shows the selected media. The file is requested when the panel opens, and a
centered indicator stays up until the video can play. It then fades in, with
the whole frame visible inside the panel. The performance video is width-bound in a narrow panel and height-bound on a landscape phone, keeping the header, a matching bottom margin, and its credit line clear.
`demo-playback-coordination.ts` pauses the main orchestral transport when a
demonstration starts playing and resumes it on close only if nothing else
changed the transport in the meantime.

Performance video: in the general view, an instrument with a recorded
performance (`performance` in `content/explorable-instruments.ts`: YouTube
id, start time, performer, ensemble; currently Utah Symphony principals for
every instrument except harp, celesta, and percussion; these are YouTube
embeds played by YouTube's own player, so their use is governed by YouTube's
Terms of Service and embed terms rather than per-asset licence metadata, and
the site must not download them or hide YouTube's branding) is opened from a "Watch performance" text button (Lucide Eye) in the explorer
actions (see "Explorer actions" below). On
a compact landscape stage (a phone on its side) the description fills the
stage's full height, over the minimap, which then does not limit its
placement (`data-layout="split"`), and runs down to the bottom of the safe
area (the actions bar, or the footer without one), so its text sits at the
bottom right, right above it. It opens `PerformanceStage`, a second off-canvas panel that
shares the demonstration panel's slide but is full screen on every screen
size, pushing the stage the full width
(`performanceOpen` in the anatomy store; the explorer's `data-demo-open`
covers either panel, and each panel slides on its own `data-open`). The
YouTube embed mounts only while the panel is open, from
`youtube-nocookie.com` with autoplay and as little player UI as YouTube
allows (`controls=0`, `disablekb=1`, `rel=0`, `iv_load_policy=3`,
`playsinline=1`): clicking the video still pauses and resumes it, and
YouTube's own title/logo overlays cannot be turned off. The share link's
`si` tracking id is dropped. The picture fades in over 1.2 s once the
player reports that it is playing (`enablejsapi=1` with the page origin, read
through the embed's postMessage handshake; this adds no UI), with the credit
following 0.3 s later. Revealing on the iframe's load event would fade in a
black player. A blocked autoplay reveals the waiting player after 3 s;
reduced motion shows it without the fade. Until then the panel shows `OrchestraFanLoader` (`src/components/`, the seating fan's arcs drawing in from the inner ring outward; static under reduced motion), centered on the panel rather than the video frame, announced as "Loading performance". It often shows for only about a second, so it starts 1.2s into its cycle (`startOffset`, inner arcs already drawn) and fades out over 0.4s as the video fades in. Fullscreen stays allowed: with no YouTube control
bar, a Lucide Maximize button beside the credit line puts the iframe into
fullscreen (left out where the browser cannot, such as iPhone Safari). A
full-width panel keeps the video clear of the contextual minimap
(`performance-layout.ts`, from the minimap rect in `explore-layout-store`):
beside it on a landscape phone. In portrait the video is deliberately kept
vertically centered. Each time the player reports playing, the
panel also sends `unloadModule('captions')` (and the older `'cc'`), since
captions the viewer or the video turns on by default cannot be disabled by
URL. `start` only applies to the first load, so when the player reports
playing (or buffering) after having ended, the panel sends
`seekTo(startSeconds)` and YouTube's replay resumes at the instrument's
passage instead of 0:00. YouTube's paused-state "More videos" shelf and end screen have no
switch at all: `rel=0` only limits them to the same channel. The
embed cannot report play/pause, so the orchestra is paused through the same
demo coordination while the panel is open and resumed on close. Header Back
and Escape close the panel first; selecting a part or leaving Explore
resets it.

Dev tooling: with `?debug=true` in development, a small overlay in
`InstrumentModel.tsx` shows the live camera position/target while focused and
copies a ready-to-paste preset — the only way these numbers get tuned
without guessing, same spirit as `OrchestraMap.tsx`'s existing debug panel.
The same panel sets an instrument's initial rotation: how it faces the
visitor when Explore opens (X/Y/Z sliders, applied live). The model is
re-placed, re-centered and re-framed from the front at each change, and
"Copy rotation" puts a ready-to-paste `modelRotations` entry (radians,
`content/explorable-instruments.ts`) on the clipboard. The model turns,
not the camera, so framing and the titles' parallax keep their front-view
rest pose. An instrument can still open from a captured orbit
(`initialCamera` in `explorable-instruments.ts`): framing keeps that
direction and fits the distance to the stage. The trombone does. Anatomy camera presets and captured hotspot views are
world-space, so they need re-capturing after an instrument's rotation
changes.

## Hotspots

In the full-instrument view only parts with a technique to listen to show a
hotspot (`hasPartAudio` in `technique.ts`); the debug hotspot editor still
lists them all. Currently that is the violin's bow, bridge, and fingerboard;
other models show none until their techniques are configured. Each hotspot
is a 44px magnifier button (Lucide Search) in the same glowing circle as the
Watch performance node (`.explore-action-surface`, a transparent black fill
under the glowing rim), brightening on hover, focus or selection.

Hotspots are anatomy points defined in JSON instead of as `Anchor_` empties
in the GLB, so they can be added without Blender or a re-export. Each
instrument with a model has its own file,
`src/features/instrument-explorer/content/hotspots/<instrumentId>.json`
(`{ "hotspots": [{ id, title, description, position, view? }] }`). These
files are picked up automatically. `position` is in the model root's own
coordinates, before the viewer's runtime rotation and re-centering. `view`
holds optional `landscape`/`portrait` camera presets in the same world-space
form as `anatomy-camera.ts`. Each orientation falls back to the other, and
with no view at all the automatic close-up is used.

At runtime each hotspot becomes an empty `Object3D` parented to the model, so
it uses the anchor pipeline unchanged: the same DOM marker, occlusion,
selection (`selectedPartId` in the anatomy store), camera focus and
the focused note (its own title/description instead of
`instrument-anatomy.ts`). The loaded set lives in `src/store/hotspot-store.ts`.

Editing: `?debug=true` in development adds a Hotspot Editor to the debug
panel, for any instrument with a model. Use "Add hotspot" and click/tap the
model to place one (raycast). Click a marker or list entry to select it and
edit its ID, title or description. "Reposition" works the same way as
placing. "Capture view" stores the live camera for the current orientation.
Debug mode also enables dolly-zoom and keeps orbiting live while a part is
focused, so a previewed view can be adjusted and captured again. Preview or
marker click plays the transition. Edits are kept as a localStorage draft
per instrument until you use Copy JSON or Download and save the result over
the config file, or use "Discard draft". A gesture that moves more than a
few pixels counts as an orbit, not a tap, so neither placing a hotspot nor
tap-to-return interferes with rotation.

## Spatial typography

In the full-instrument view, the family title and instrument title are semantic HTML (`SpatialTypography.tsx`) placed on invisible depth planes beside the model. `spatial-typography.ts` holds the per-plane configuration (depth, position, parallax strength, opacity, scale, blur), per-instrument position overrides, and which plane each text belongs to, plus the pure layout, composition, offset, and damping math.

The instrument title fits the width the layout gives its plane: it keeps its responsive size (`clamp(2.6rem, 6.4vw, 6rem)`) while its longest word fits, and is scaled down until that word fits otherwise (`fitTitle` in `SpatialTypography.tsx`, measured with a canvas at its computed font, again on every re-measure such as a resize or font load). It wraps only at spaces, balanced ("Pitched / percussions"), never inside a word; only below 28px does it stop shrinking and allow a word to break.

Labels never overlap the model's box, so hotspots stay uncovered. On a portrait stage (a phone held upright) they always go on top, right-aligned to the stage edge, and may use the stage's full width even where that runs past the contextual minimap; only the model frame starts below the minimap. With labels on the right, the centered composition moves clear of the minimap when the model frame would otherwise run under it (`composeStage`). On a landscape stage the composition is the same for every instrument, whatever its shape: the description is left of the model, the title right of it and centered on it, and the model uses the full height between the header and footer bars when the width allows. Per instrument, `explorerLayout` (`config.ts`) sets, separately for landscape and portrait, the model's initial `scale` (the share of its frame it fills) and the `gaps` from its on-screen bounding box to the title and the description; the labels follow the measured box, so a smaller scale pulls them in with it. Plane positions are configured per side. The typography composes the stage: the available area is the viewport safe area between the header and footer, less an edge margin. The label group is measured first, then the area is split — the labels get their own side and the model gets a frame matched to its front-view aspect in the rest, narrowed beside right-hand labels or shortened below top labels when they need room (at most `maxLabelShare` of the area goes to labels), with model and labels centered together. In landscape the model frame instead centers on the stage, as far as the description column on its left and the measured title space on its right allow (`composeStage`'s `centerX`). The frame is published on the view signal (`instrument-view.ts`); `InstrumentModel.tsx` publishes the model's aspect on load, fits the model into the frame on both axes, and shifts the projection (`setViewOffset`) so the model lands there while the camera still orbits its center. With envelope labels (the default), it is the model's full-orbit envelope (any azimuth, polar 20–160°, measured from the model's sampled vertices with `createOrbitEnvelope`, the same envelope the captions are laid out against) that is fit, not the front view: `InstrumentModel` publishes the envelope's aspect as the model aspect, so the stage composes a frame of that shape, and `model-framing.ts` sets the camera distance so the envelope fills the frame's share (`explorerLayout` scale) on its limiting side. The model is therefore as large as the frame allows, and since captions keep clear of the envelope they never cover it at any rotation. A long instrument such as the trombone has a nearly square envelope, so its frame is about as tall as the stage (`tests/model-framing.mjs`). The camera's clip planes are set from the model's bounding radius rather than fixed, since models are authored at very different scales (the horn is about 60× the violin). The fit is exact under perspective: it uses the model's sampled vertices (`model-extent.ts`), not its bounding box, which would assume the extremes sit on the deepest face and leave a thin instrument short of its frame. The model frame has its own, smaller edge margin (`modelEdgeMargin`) than the labels (`edgeMargin`), so on a short screen it uses nearly all the height between the header and footer bars. Initial framing publishes front-view bounds as a fallback. During inspection, the shared spatial-layout probe publishes maximum orbit-envelope bounds and depth by default, or live transformed bounds when configured; planes follow those bounds within the allocated label area. Title positions use edge/align/side/gap, while parallax and focus travel remain feature-owned. See `specs/spatial-layout.md` for the geometry contract.

Those gaps are for a roomy stage. `stageLabelGaps` (`config.ts`) shrinks them on a smaller one in proportion to the stage's size along the direction they run: its width in landscape, where the labels sit beside the model (full gaps from 1280px), its height in portrait (from 900px), never below 30% of the configured gap. The rest of the space between a label and the visible instrument is its rotation clearance: labels are laid out against the full-orbit envelope, so a turning instrument never sweeps over them.

Each plane's position is a point on a reference box — the model bounds, or another plane's box via `relativeTo` (the family title sits on the instrument title) — with alignment (start/center/end) and a px offset. Planes are confined to the labels' side less their own parallax reach, so text stays clear of the model and the screen edges mid-rotation. Widths are capped to the space a plane has, so text wraps where it stands; linked planes are contained as one group.

The full-instrument description comes from `explorable-instruments.ts`. The stage
layout measures its wrapped text and reserves a left column below the minimap
in landscape (up to 280px), or a bottom region above the footer in portrait. The description includes a
“The [instrument]” heading, a landscape-only “About the instrument” eyebrow,
with extra horizontal breathing room in portrait. Text is right-aligned in
landscape and left-aligned in portrait.
The description follows the title’s model-aspect rule: in landscape it sits
directly to the left of tall models and left-aligned below wide models, with a 40px model
gap. On screens with a shorter side below 600px, the text width is capped at
220px in landscape and 320px in portrait. Mobile portrait always keeps the description at the bottom. Its bottom edge never goes below the footer: when the model's envelope and the description cannot both fit, the description stays on the footer edge and may come closer to the model instead (`placeDescription`). For tall
models its right edge sits a gap away from the projected model’s left edge;
below wide models its left edge aligns with the projected model’s left edge.
Its vertical anchor is the upper quarter of those bounds, constrained below
the minimap. Description layout changes share the title GSAP ticker and damping, but the
description has no orbit-driven parallax. Interpolated positions remain clamped
to the safe area; portrait retains bottom alignment. Reduced motion applies
layout changes immediately.
Both the model frame and title layout use the remaining area; the model itself
is never scaled. The reservation remains while the copy is hidden, avoiding
camera re-framing during a focus transition. Font and orientation changes
remeasure the text through the existing layout observer.

The description slides 32px left in landscape and fades over 350ms when an anatomy part is selected or camera
distance falls below 94% of the current full-instrument distance. It returns
once no part is selected and distance reaches 98%; this hysteresis prevents
flicker and ignores orbit angle. `instrument-view.ts` publishes only changes to
that zoom state. Manual zoom remains disabled by the existing controls config,
but enabling it uses the same distance detection. Reduced motion removes the
fade.

Parallax is derived from the instrument camera, not the pointer: `InstrumentModel.tsx` publishes OrbitControls' azimuth/polar angles on the same signal, and the typography damps toward the resulting offsets on the GSAP ticker, writing transforms through refs and stopping once settled. Reduced motion disables the parallax.

When a hotspot is focused, the titles travel with the zoom (`label-travel.ts`): each title moves away from the focused part's live on-screen position and grows by how far the camera has dollied toward the part, as text standing in the scene would — a plane nearer or further by its `depth` × `travelDepthSpacing` rushes past faster or slower. `InstrumentModel.tsx` shares the camera and the zoom's focus point on the view signal. Only the dolly drives the titles, not the camera's turn toward the part: projecting fixed world points through a camera that tilts as it travels (e.g. the bridge close-up, which looks up from below) swung them past their place and back on the way home. Meanwhile they fade out while their letter spacing opens by `identityTrackingExpansionEm` (0.18em), with the departing map caption's timing (`navigationTiming`: 50ms start, 760ms, `power2.inOut`); returning to the full view reverses it — titles come home, fade in, and contract. The travel runs for the camera's `focus.duration` (config.ts). Parallax and stage layout are suspended during the travel and resume when it settles; switching between parts keeps the titles out. Reduced motion skips the travel and fades instantly. The projected anatomy note shows the part content while focused.

## Accessibility

During Explore, the map's labels and controls are `inert`; miniature labels do not become tiny keyboard targets. The header Back control stays available and leaves Explore for the same instrument view; it does not withdraw a navigation level. The miniature map is not a pointer target. The persistent shell stays available. Playback controls stay available during Explore and are hidden while a demonstration panel is open. Focus moves to that header Back control after settling. During return, the explorer becomes inert immediately; map interaction is restored when the map settles, and focus returns to the selected instrument's Explore action. Escape exits Explore before applying the map hierarchy’s normal one-level Back behavior.

## Validation

`tests/experience-mode.mjs` checks eligibility, independence of navigation/mode state, playback-store preservation, rapid semantic mode actions, and desktop/mobile layout targets. `tests/instrument-anatomy.mjs` and `tests/technique.mjs` cover anchor/label/description data and technique linking; `tests/anatomy-store.mjs` covers the selection store's valid-transition rules; `tests/demo-playback-coordination.mjs` covers the pause/resume-on-close logic against the real playback store; `tests/hotspots.mjs` covers hotspot config parsing/export, view fallback, ID rules and the editor store. Build and lint pass. `npm test`'s full run currently stops earlier, in the pre-existing, unrelated `identity-layout` figure-sizing assertion — the tests above are run standalone via the same Vite-SSR harness the rest of this session's work has used to bypass that.

The violin, horn, trumpet, flute, and trombone GLBs are not committed. They are loaded from `VITE_MEDIA_URL` (`3d/violin/violin-web-anchors.glb`, `3d/horn/horn.glb`, `3d/trumpet/trumpet.glb`, `3d/flute/flute.glb`, and `3d/trombone/trombone.glb` on the media host) and can still be read from `public/3d` when that variable is unset. The trumpet file's own metadata names Kagelok (Sketchfab) as author under CC-BY-4.0, source `https://sketchfab.com/3d-models/trumpet-1dc9efd37bf14d1b9d1e3de0ca90435c`. The flute file names Tealfox64, source `https://sketchfab.com/3d-models/basic-flute-8eb90edf4b6a44e8a400bfd565b37483`, under the same license. The trombone file names sethgordon, source `https://sketchfab.com/3d-models/used-trombone-3709e96c01694bc791b118e2ce534910`, under the same license. Those credits are unverified and still need human review.

## Lighting

The viewer lights every instrument with the same setup:
`instrument-lighting.ts` provides a studio environment, the punctual lights
in `InstrumentModel.tsx` add to it, and Khronos PBR Neutral tone mapping is
used. The studio is three's procedural `RoomEnvironment`, prefiltered once
by `PMREMGenerator` into `scene.environment`. There is no download, and it
is never used as `scene.background`, so the page stays black. Metallic PBR
materials take most of their brightness from what they reflect. Without an
environment the horn (metalness ≈ 0.87, roughness 0) reflected black and
rendered dark brown, and ACES Filmic pushed its gold further toward brown.
Materials are never modified: exposure and `scene.environmentIntensity` are
renderer/scene-wide. Defaults are in `config.ts` (`lighting`), with
per-instrument overrides in `instrument-lighting.ts`. With `?debug=true`, the
debug panel's Lighting section adjusts exposure, environment intensity and
tone mapping live. "Copy lighting" puts a ready-to-paste override on the
clipboard.

Hotspots are icon-only buttons with accessible anatomy names; no visual
hover labels are rendered. Selecting a part fades all markers, including the
selected one, over 350ms. The marker container is inert while focused;
returning restores the markers and their interactions. Reduced motion removes
the fade. Hover/focus strengthens the circle's glow; keyboard focus also has
an explicit outline. No continuously animated bloom or postprocessing is
added.

400ms after the anatomy camera tween begins, a floating HTML label reveals the
selected part’s name and existing description. It uses the same hotspot
projection through a scratch camera at the destination pose, independently of
the travelling camera, invisible dot, and its occlusion state. The note enters
at its final screen position instead of tracking the hotspot during zoom. The
note starts 6vw to the right in landscape or 6vh below in portrait, reducing
the gap when necessary to keep its text inside the stage’s header/footer safe
area. Its background forms a full-height vertical band in landscape, extending
behind the header and footer, or a full-width horizontal band in portrait.
The landscape gradient fades left to right; portrait fades top to bottom. The inner content slides 64px from the right in landscape or from below
in portrait and fades in over 350ms; reduced motion skips this transition. Back reverses the slide and fade over 350ms without an exit delay. The last
note content remains mounted and aria-hidden during exit, preventing an empty
label from disappearing abruptly. A new selection updates its destination projection.
Resize updates the projection aspect and safe-area constraints.
A resize observer keeps wrapping and projection aligned without a permanent
animation loop. The anatomy description is independent of the radial media actions.

In portrait, the full-instrument description uses opacity-only transitions for
both entry and zoom visibility. The anatomy note’s orientation is established
while hidden on every projection update, so its first portrait entry already
has the below-stage starting pose instead of transitioning from a rightward one.

Radial action nodes retain the last selected part’s content on deselection,
like the anatomy note. Their entry transitions reverse with a 64px outward slide and fade over
400ms (left in landscape, up in portrait), without the entrance delay or
scaling. Entry slides in along that same path. The group
becomes inert and aria-hidden immediately; content visibility changes only
after the exit finishes. CSS transitions allow interrupted exits to reverse
from their current pose, and reduced motion skips the transitions.

## Code structure

`src/features/instrument-explorer/` is grouped by sub-area. The rest of the
app imports it through `index.ts`.

- `content/`: instrument data, with no rendering. Explorable instruments
  (model URL and pose), anatomy labels and descriptions, camera presets,
  techniques, hotspots (`content/hotspots/<instrumentId>.json`).
- `scene/`: Three.js only, with no React or stores. `instrument-stage.ts`
  (renderer, lights, environment, controls, on-demand render loop),
  `model-framing.ts`, `markers.ts` (GLB anchors + hotspots, occlusion),
  `part-focus.ts` (camera focus and spotlight), `canvas-gestures.ts`
  (tap vs drag, picking), plus lighting, model loading and extent.
- `viewer/`: `InstrumentModel.tsx` composes the scene modules, connects them
  to the stores and owns the DOM overlays. `focus-overlay.ts` lays out the
  note band and radial actions.
- `typography/`, `demonstration/`: spatial typography and the off-canvas
  demonstration player.
- `debug/`: the `?debug=true` panel. It reaches the scene only through
  `debug-bridge.ts`.

## 3D model credits

Every instrument's model is configured in one table, `models` in `content/explorable-instruments.ts`: the asset's public license record, plus an optional rotation and opening camera. The record (`public/licenses/<instrumentId>.json`, or `public/licenses/instrument-pack/<name>.json` for the instrument pack) is the single source for both the model's `assetPath` (served through `mediaUrl`) and its visitor-facing credits (typed `ModelAttribution`), never the GLB. A record with a `null` license, like the violin's, shows no credits. Its tests check that each model's URL and credits come from the matching record. Fields: title, creator, creatorUrl, sourceUrl (with an optional sourceName for the link text), license, licenseUrl, modifications, and optional copyrightNotice, disclaimerNotice and previousModifications. Nothing is specific to one source or license. Each also carries a `verificationStatus` (see "Licensing Metadata Architecture" in `architecture.md`). It is not shown to visitors, and an agent never sets it to `approved`. When an instrument has an attribution, `viewer/ModelCredits.tsx` shows a "3D model credits" text toggle (Lucide Info) in the explorer actions (see "Explorer actions"); the dialog resets the uppercase, tracking, alignment and no-wrap it would otherwise inherit from that line. Like the rest of the description it hides and goes inert while a part is focused or the camera is zoomed in. The toggle opens a native modal `<dialog>`, which provides focus containment, Escape and backdrop-click to close, and focus returning to the toggle. Escape inside it does not also leave Explore. External links open in a new tab with `noopener noreferrer`. An instrument without an attribution shows no toggle. The flute's credits come from the metadata Sketchfab embeds in its GLB (`asset.extras`); the instrument-pack credits from the researched CGTrader listing. All await human review. The violin GLB carries no source metadata, so it has no credits yet.

## Explorer actions

"Watch performance" (when the instrument has a performance video) is an
action node like the anatomy actions: the Lucide Eye icon in a 44px glowing
circle, with its "Watch performance" label beside it, wrapped at its space
onto two lines on every screen. In landscape it sits directly under the instrument title, inside the
title's plane: measured with it, so the stage layout keeps it clear of the
model, but outside the title text, so it takes neither the orbit parallax nor
the focus travel; it fades out and goes inert while a part is focused. On a phone held sideways (a landscape stage under 600px tall) it is taken
out of the title plane's measured box (absolutely positioned under the title),
so the label column is sized for the title alone and the model, usually
width-limited there, gets that space back. In
portrait it leads the description instead, right-aligned above the 3D model
credits with the label before the circle, and goes inert with the
description. There too it is absolutely positioned (just above the
description), outside its measured box, so the model's space is computed as
if the node were not there.

"3D model credits" (when the model has an attribution) is a small uppercase
text link (Lucide Info) whose button wraps its content. It takes the place of
the description's "About the instrument" eyebrow, in its style but smaller
(0.55–0.62rem), above
the instrument name (in portrait, where the eyebrow is hidden, it still shows
there). An instrument without credits keeps the eyebrow. It goes inert with
the description while a part is focused or the camera is zoomed in.
