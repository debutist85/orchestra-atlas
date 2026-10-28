# Orchestra map

**Status:** Approved behavior for the current production map  
**Feature:** `src/features/orchestra-map`  
**Related:** [navigation-motion.md](../docs/navigation-motion.md), [map-annotations.md](../docs/map-annotations.md), [ghost-twins.md](../docs/orchestra-map/ghost-twins.md)

The map is the spatial interface to the orchestra. It is a luminous seating sculpture, not a concert-hall simulation and not a decorative WebGL background.

---

## Established

### Purpose

- Show where families and instruments sit.
- Let a visitor zoom orchestra → family → instrument.
- Keep non-selected players perceivable.
- Drive listening highlight from the same navigation state.
- Visualize musical activity from the offline activity profile and the global transport.

### Navigation model

Canonical state lives in `src/store/navigation-store.ts`. Valid levels:

```text
orchestra
family     strings | woodwinds | brass | percussion | other
instrument derived family + one catalog instrument
```

Actions: `enterFamily`, `enterInstrument`, `goBack`, `resetToOrchestra`, and `navigateTo` for scene/DOM events. Invalid IDs are ignored. Entering an instrument derives its family from `src/store/catalog.ts`.

The URL is a projection of that state:

```text
/
/strings
/strings/cello
```

Instrument IDs are kebab-case in the path, except Contrabass uses `/strings/contrabass`. Legacy `/strings/double-bass` links resolve to the same instrument and are replaced with the canonical path. Extra trailing segments are ignored by spatial navigation so later explorer routes can attach. Deeper or sibling moves push history; withdraw replaces. Query strings such as `?preset=` and `?debug=true` are preserved. There is no router library.

Explore (`src/store/experience-store.ts`'s `experienceMode`) is orthogonal state and owns one of those trailing segments, e.g. `/strings/violin/explore`: entering explore pushes history, exiting replaces, and it never changes `navigation` itself. `src/store/navigation-route.ts` only writes this segment outward from either store; reading it back on load or a popped history entry — which can mean preparing a 3D model first — is OrchestraMap's own job (`beginExplore`/`exitExplore`), not the route module's.

### Interaction

- Click/tap a family or instrument constellation to enter that destination. Its visually hidden HTML label remains available to keyboard users and in the scene-error fallback.
- Hovering a constellation or its caption highlights both. Hover is not required for selection.
- Escape and ← Back withdraw one level. At family depth, hovering anywhere inside an instrument sub-region highlights that instrument, and clicking anywhere in it enters the instrument. Gaps inside the selected family's authored section regions keep the family selected; gaps outside them, including the woodwind gap within Strings, withdraw. At instrument depth an instrument of up to three lights is triggered by its individual lights; one of four or more by the shape its lights form (their convex outline, widened by their radius to take in the outer circles), gaps between the lights included. A light of another instrument is never part of it. Hovering the trigger lights up all of the instrument's lights, with a pointer cursor when the instrument has an Explore view, and clicking or tapping it enters Explore. For the small instruments, clicking between the lights inside the region keeps the instrument selected. Viola's region follows its bent node path, leaving the dimmed-node pocket outside it. A canvas click outside the selected cluster withdraws one level.
- Explore on a focused instrument group is a no-op annotation. It does not change navigation or mix.
- Native buttons handle Enter/Space. The canvas is decorative to assistive technology; each destination has exactly one focusable HTML control.

### Visual behavior

- The launch screen shows `OrchestraFanLoader` in progress mode above the "Loading N%" count: its five arcs fill from the inner ring outward with the same count. The count is time-paced (at least 1s) but capped at the share of real loading stages finished (scene built, audio profile and manifest fetched, first audio chunk decoded, a deep-linked explorer presented), so it reaches 100% only when all are done. Reduced motion shows the static fan and no count.
- After loading reaches 100%, the loader finishes fading out, then the constellation fades in and rises from below with ease-out timing over 0.6 seconds, traveling 2.5vh (clamped to 12–27.5px). Header, Play invitation, labels, and transport remain hidden and inert until the entrance completes, then appear. Reduced motion skips the entrance and UI fades.

- Before playback has ever started, a semantic Play button follows the canvas conductor node in the full-orchestra view. Its circular hit target and ripple halo sit over the spatial node, with the quiet primary instruction “Play the orchestra” directly below, in the muted navigation white (`--color-navigation`). (Selecting lights is taught by the constellation invitation instead.) Zooming in fades the widget out; returning to the full orchestra brings it back after the camera settles. Activating it starts playback, fades the invitation, and reveals the footer transport. The conductor does not become a transport control again after pausing.
- The root orchestra highlights one family at a time before playback using the existing colored hover intensity rather than white activity rings. Each family switches on immediately, holds for one second, switches off immediately, then waits three seconds before the next; nodes receive no individual timing or color correction. The family sequence is decorative, pauses for pointer or label hover, and is disabled for reduced motion. The first zoom-in permanently ends the family-node sequence for the session, even if the visitor returns to the full orchestra without playing; the conductor Play widget can still return. Starting playback ends both invitations.
- Every map view (full orchestra, family, instrument) invites selection through a small floating copy of its constellation (below), never on the map's own lights: on one light of that copy, two thin rings in the light's color leave it, 350ms apart, growing up to 2.75× its radius (a bounded growth for a large light) and fading, after a white outline pointing hand (Lucide Pointer, 20px, with a dark under-stroke) drifts toward it from below, growing from faint (30%) to fully opaque as it approaches, rests with its fingertip beside the light, tilted toward it, then drifts back out fading, never disappearing; the same hand on touch screens. One cycle is 3.6s and loops. The light is chosen deterministically: in the first configured instrument of the view's family (at the full orchestra, Strings' first instrument, so Violin; in Brass, Horn), the one nearest that cluster's middle, with the hand coming from the cluster's outer side so it does not cover its neighbors. The Percussion family demonstrates on its rightmost light instead, the hand from its right. It waits for the launch reveal and camera travel to settle, and is off during Explore and its model loading. It teaches selection once per depth: the first selection made from a depth retires it there for the rest of the session, wherever the visitor returns. From the full orchestra that is going into any family or instrument; from any family, into any instrument; at instrument depth, opening the 3D inspector (a link that opens straight into the inspector does not count). Lights, labels and the keyboard controls all count. Play, hover, drags and empty clicks do not affect it. A page reload starts afresh. At the full orchestra its rings peak midway between the Play button's. Reduced motion shows one still ring and the pointer at rest. It is decorative (`aria-hidden`, no pointer events); the map's lights keep their hover, hit areas and selection unchanged. The 3D inspector has its own rotation affordance and does not show it.
- While the invitation shows, a small SVG copy of the view's constellation (a faint rounded inset, 150×92 at its design size) floats in an empty part of the stage, carrying the invitation. Below the lights the instruction “SELECT A GLOWING NODE” reads the same at every depth (in the style of the map's hint: 10px capitals set by CSS, 0.12em tracking, the hint's color, wrapping within the inset; it is not scaled with the drawing). The drawing is drawn scaled to the stage as one piece (lights, glow, rings and hand together): 15% of the stage's width, or of 1.6× its height on a short stage, clamped to 120–220px wide. It shows: at the full orchestra only the Strings family's lights, at family depth the family's instrument lights, at instrument depth that instrument's lights; nothing in the 3D inspector. It is projected from the scene's real lights (their instance matrices under their parents) through the map's current camera, without moving it, then cropped to what those lights draw (each glow, and the featured light's widest rings and hand) and fitted uniformly with 10px padding, centered, so nothing is clipped, its shape and relative sizes are kept, and one light sits in the middle. The copied lights (with their glow) are drawn at 50% opacity; the rings and hand are not. Each light keeps its own display color and id, and the fit from stage px to miniature units is kept, so a later ripple or pointer can target a light without recapturing. It is captured once the view's camera has settled and again after a resize settles, never per frame; starting travel discards it (the last copy stays drawn while it fades). Its position is found by the scene, with the same logic as the preparing indicator but its own preference: preferably one of the stage's corners or the middle of its top or bottom edge (all within the area between the header and footer, 16px in), the top-left corner whenever it is free (the most favoured), else the free one nearest the constellation; when none is free, anywhere in free stage space, near the constellation. Only active lights hold it off: every light at the full orchestra, and deeper in only the view's own, since the rest are dimmed and may be covered. It is never over the caption, labels, or the Play button and its copy. With no such space it is not shown. The drawing is decorative (`aria-hidden`); the instruction is ordinary text, hidden with the inset. No pointer events.
- The conductor is dark gray while the Play invitation shows; once the orchestra has started playing its light fades out almost completely (to 6% opacity over 0.45s, at once under reduced motion) and stays that faint. The canvas spans the full viewport behind both chrome bars. Explore controls stay within the usable area between the bars, including during zoom transitions. The transparent, borderless header is 40px high on desktop and mobile; the footer is 50px high on desktop and mobile.
- The stage holds the active identity heading and a larger parent destination link left-aligned directly above it, its label 6px above the title. A keyboard-only constellation control provides the semantic equivalent of selecting a light; the title is not interactive. The top bar retains functional controls and the explorer’s existing Back location. Back appears after the zoom from the full orchestra settles. The identity caption stays below the header bar and above the footer bar, at any level or orientation, including during zoom travel. Family captions are set in capitals. At family or instrument depth, a layout may include decorative artwork behind the caption. Landscape and portrait art-direct that artwork independently through `figure` (`width`, `height`, `x`, `y`, `rotation`, `scale`, `opacity`, `mask`). A figure sets `width`, `height`, or both; the unset dimension is `auto`. The artwork does not receive pointer events and is not a semantic name. Violin, Viola, Cello, Contrabass, Horn, and the Strings family currently provide artwork. The caption type, not the artwork, stays between the header and the footer. The bottom bar contains only the centered playback controls, revealed after initial activation. Play, elapsed time, seek, duration, and decorative pulse bars remain in one row on narrow screens. Escape also withdraws one level.

- Seating, polar lattice, and section assignments are frozen product geometry. The root camera framing places the constellation slightly above center; desktop overview occupancy is 66% from 1024px wide (72% below that), leaving extra space below the header; family framing is unchanged. Past a 1280×800 viewport, instrument zoom pulls back in proportion to the larger overflow, so a selected instrument keeps that on-screen size. Family zoom takes about a third of that pullback. The full orchestra still fills the larger display. A muted, looping video sits behind the full-orchestra constellation and fades out with the zoom into a family or instrument, then fades back in on return. Playback continues until that zoom settles. It does not receive pointer events and is hidden from assistive technology. On a root launch, the browser preloads the clip while the loading overlay is visible and starts playback when the app is ready; loading does not wait for the whole file. Viewports below 1024px wide use the lightweight 720p encode; wider viewports use the 1080p production encode. Reduced motion shows a still poster without loading or playing the clip. At instrument depth on mobile portrait (shorter than 768px wide and taller than wide), the framing shifts downward by 10% of the viewport height so the selected lights sit lower under the heading. See [COMPOSITION-REFINEMENT.md](../docs/orchestra-map/COMPOSITION-REFINEMENT.md).
- Selected family or instrument is emphasized. Peripheral nodes are dimmed but remain present. Inspection’s contextual minimap uses a brighter dimmed intensity than the main map so the surrounding formation remains legible at miniature size. A selected instrument keeps the family view's glow while its peers dim; brighter levels come only from hover, each step brighter than the last: the full map at rest < a family hovered on the full map < an instrument hovered at family depth < the selected instrument hovered at instrument depth.
- Player nodes use the liquid-light orb material, instanced per section and colored by their existing node-band/instrument/section palette. The conductor keeps its playback-marker appearance. Settings live in `src/features/liquid-orb/config.ts`; the isolated comparison remains at `/dev/liquid-orb` in development.
- Nodes are flat filled discs with instrument signature colors and no interior shading. Musical activity controls a white eclipse corona whose thickness grows outward; disc coverage masks inward bloom. Hover increases fill brightness and adds 0.08 bloom to the default 0.1; selection doubles brightness without a bloom boost.
- The revised activity profile supplies bounded intensity and explicit attacks on the output-compensated playback clock, with a 20 ms visual lead. The visual profile is independent of audio gain scheduling. When unavailable, the original profile is used and a status notice is shown. Seating, radii, picking, loading, camera framing, semantic controls and miniature behavior are preserved.
- Reduced motion suppresses music pulses. Legacy ghost twins and white activity rings remain off for filled nodes. Shared fill, rim and musical response settings live at the root of `liquidOrbConfig`; prototype-only size and zoom controls stay under `prototype`.
- Root family navigation labels are visually hidden while the WebGL map works; keyboard focus reveals each label, and the fallback shows them. At family depth, instrument names are no longer projected label chips. The heading group contains semantic instrument navigation buttons, revealed on keyboard focus and shown together in the scene-error fallback. At instrument depth, a constellation control appears on keyboard focus and highlights the selected lights. Parent navigation is muted text with an arrow and identifies Orchestra or the current family. During instrument exploration the existing header control returns through anatomy/demo states before returning to Instrument Selection. Minimum target size is 44px.

The header Back control (Explore only) reads “Back” and uses the caption Back's type at the explorer's Watch performance label size: clamp(0.62rem, 0.52rem + 0.2vw, 0.75rem) uppercase, 0.1em tracking, 75% opacity rising to full on hover and focus.
The caption Back control (a Lucide arrow with “Orchestra”, and the family name at instrument depth)
uses 14px labels, left-aligned with the title. Its hit area is the height of that label, with 6px of space beneath it.
It rests at 75% opacity and returns to full opacity on hover and keyboard focus.
The header Back control uses 10px horizontal padding.
Both have a transparent background. Outgoing visual copies match these metrics.

### Exploration hint and preparation

No exploration hint line is shown under Play or in captions; the floating constellation invitation teaches selection.

Preparation mounts the cached GLTF resource and waits for the model’s first rendered frame, then starts the existing explorer transition. Texture uploads are staged with paint opportunities between unique textures, and shaders compile asynchronously before the first model frame. Hotspot visibility checks run one per frame and cache results until the camera or markers change; settling does not trigger a full synchronous pass. While preparing, the selected instrument's own lights ripple gently toward the viewer and back as the loading indicator, their liquid material moving with them (a single light pulses), with a “Preparing [instrument]…” indicator (a 48px fan loader beside “Preparing” over the instrument's name, two lines at 13px, 12px on narrow screens, with no border or background) floating in free stage space, placed by the same logic as the illustration but favouring the bottom center, else the free corner or edge center nearest the constellation; a status line in the caption announces it to screen readers. Other lights stay still. Preparation lasts at least one wave cycle, also for instruments without a model. Reduced motion keeps the lights brightened but still. Reduced motion enters immediately when ready. Deep links preserve the existing launch overlay behavior.

Preparation blocks further canvas navigation; the parent link and Escape can cancel it. Unmounted renderers ignore outstanding resources. Failures retain Instrument Selection with an announced error and Retry; failed resources are evicted from cache. No persistent hint appears in 3D exploration. Canvas drags exceeding 8px do not navigate.

### Caption placement

Family and instrument captions use `edge`, `align`, `side`, and `gap` in
independent portrait/landscape configurations. Defaults are top edge, center
alignment, outside, and 2 viewport units of gap. The measured group contains Back, title,
and retry content; decorative artwork is excluded.
Headings stay on one line.

`edge` accepts `top`, `bottom`, `left`, `right`, or `center`. `align` accepts
`start`, `center`, or `end` along the edge. Top/bottom align left/center/right;
left/right align top/center/bottom. `side` explicitly selects outside/inside,
without flipping. Gap applies only perpendicular to the edge. Outside uses
caption bottom/top/right/left for box top/bottom/left/right respectively;
inside reverses the caption edge. Center ignores alignment, side, and gap.
The old composite `placement` property is removed.

Caption positions are never clamped, including inside and center placement.
Outside captions use adaptive framing; inside and center retain their
constellation-relative anchors. Text-size limits remain. Headings stay on one line and captions do not scroll.

Outside placement reserves the measured caption extent perpendicular to its edge and gap in the
camera framing before zoom begins. The selected constellation fits into the
remaining safe rectangle; its camera may pull back and shift, while inside,
center, and full-orchestra framing retain their previous behavior. Caption text
is capped at half the safe height for top/bottom edges and half the safe width
for left/right edges, to retain room for the lights on small stages. Back-link space
is present from the start, fading with the title and disabled until navigation settles.

Projection follows the existing camera transitions. Group size changes trigger
layout, including loading copy and keyboard focus. Departing visual captions
include the same context rows so their measurement remains consistent. The full
orchestra uses the same edge/alignment placement API with independent portrait
and landscape presets; its camera framing and brand styling are preserved. See
[identity typography](../docs/identity-typography.md) for authoring examples.

### Motion

`navigation-motion.ts` owns one GSAP timeline per discrete navigation. Camera, label opacity, and emphasis travel together (~850 ms), while the stage identity updates immediately when a destination is selected. Approach vs withdraw follows hierarchy depth. Interruptions start from the current rendered pose. Reduced motion snaps to the destination.

React presentation of labels may lag the canonical store until travel settles. That delay is not a second navigation source of truth.

### Relationship to listening

Zooming **is** the mix change. There is no separate listening-selection store. The engine maps `highlightedInstrumentIds(navigation)` to a highlight plan. The map must not fetch, decode, or schedule audio.

### Accessibility

- Semantic HTML labels before ARIA.
- Keyboard: Tab to labels, Enter/Space to activate, Escape to withdraw.
- Visible focus on chrome and chips.
- Reduced-motion path for camera and ghosts.
- Scene error shows a status message; labels remain usable.
- Important state in the WebGL scene also exists in the surrounding DOM (identity, playback, notes).

### Responsive

Mobile is first-class. Labels, 44px targets, and touch withdrawal apply at the tested viewports (including 320×568 and landscape 844×390). Desktop hover is additive, not required.

---

## Current implementation

| Concern | Location |
|---|---|
| React chrome and labels | `src/features/orchestra-map/components/OrchestraMap.tsx` |
| Three.js scene | `src/features/orchestra-map/three/` |
| Liquid-orb material and settings | `src/features/liquid-orb/`, especially `config.ts`; `three/liquid-node-material.ts` |
| Seating / families | `src/features/orchestra-map/config.ts`, `utils/navigation.ts` |
| Label geometry | `utils/entity-layout.ts` |
| Motion | `three/navigation-motion.ts` |
| Catalog | `src/store/catalog.ts` |
| URL sync | `src/store/navigation-route.ts` |
| View constellation (shared scope) | `utils/constellation-scope.ts` |
| Constellation invitation | `utils/constellation-invitation.ts` (light and timing), `components/ConstellationInvitation.tsx` inside `ConstellationIllustration.tsx` |
| SVG miniature | `three/constellation-capture.ts`, `utils/constellation-miniature.ts`, `components/ConstellationMiniature.tsx`, `OrchestraScene.captureConstellation`, `components/ConstellationIllustration.tsx` |
| Floating overlays (illustration, preparing indicator) | `utils/free-spot.ts` (anchors and preferences), `OrchestraScene.setOverlay`, `components/floating-overlay.ts`, `components/PreparingIndicator.tsx` |
| Tests | `tests/entity-layout.mjs`, `navigation-motion.mjs`, `navigation-path.mjs`, `navigation-route.mjs`, `ghost-idle.mjs`, `idle-animation.mjs`, `constellation-invitation.mjs`, `constellation-miniature.mjs` |

DEV geometry tools: press `D` or open `?debug=true`.

---

## Out of scope

- Redesigning seating, polar grid, or camera framing
- Instrument explorer, techniques, score, or video
- Making the map aware of chunks, AudioBuffers, or backends
- A second selection store for audio
- Router libraries

---

## Open questions

- How much activity visualization should remain at orchestra depth on small screens?
- Physical-device performance of instanced liquid orbs + activity + Web Audio together

---

## Validation

`npm test` covers layout, motion, path parsing, idle/ghosts, and listening independence. Visual feel, touch, and reduced-motion still require browser review.

During camera zoom travel, both caption groups follow their projected anchors
without position clamping against the stage. No position clamp is applied after
the transition settles either. Outside destination
framing still reserves caption space before the transition starts.

`gap` specifies viewport-relative separation between the selected bounding-box edge and
the corresponding edge of the complete caption group (including Back and hint).
It does not change caption width/height limits. Outside gap extends away from
the constellation; inside gap insets the caption from the selected box edge.

Numeric `gap` values are responsive: top/bottom edges interpret them as `vh`,
left/right edges as `vw`; center ignores gap. For example, `gap: 2` means 2vh
on a top edge and 2vw on a left edge. The scene resolves the value to CSS pixels
from its full viewport-sized canvas before positioning and adaptive framing.
Existing numeric values were converted using a 1280×800 reference viewport
(vertical gaps divided by 8, horizontal gaps by 12.8); zero remains zero.

Returning from exploration focuses the instrument heading. No separate Explore
CTA is rendered. The title is not interactive; a keyboard-only constellation
control provides equivalent access to selecting the lights.

The header is 40px high on all screens. The full-orchestra landscape camera
has an additional 2.5vh upward composition shift; portrait and nested-group
framing retain their existing behavior.
