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

Instrument IDs are kebab-case in the path, except Contrabass uses `/strings/contrabass`. Legacy `/strings/double-bass` links resolve to the same instrument and are replaced with the canonical path. Extra trailing segments are ignored so later explorer routes can attach. Deeper or sibling moves push history; withdraw replaces. Query strings such as `?preset=` and `?debug=true` are preserved. There is no router library.

### Interaction

- Click/tap a family or instrument constellation to enter that destination. Its visually hidden HTML label remains available to keyboard users and in the scene-error fallback.
- Hovering a constellation or its caption highlights both. Hover is not required for selection.
- Escape and ← Back withdraw one level. At family depth, hovering anywhere inside an instrument sub-region highlights that instrument, and clicking anywhere in it enters the instrument. Gaps inside the selected family's authored section regions keep the family selected; gaps outside them, including the woodwind gap within Strings, withdraw. At instrument depth, clicking between lights inside the selected instrument's region keeps the instrument selected. Viola's region follows its bent node path, leaving the dimmed-node pocket outside it. A canvas click outside the selected cluster withdraws one level.
- Explore on a focused instrument group is a no-op annotation. It does not change navigation or mix.
- Native buttons handle Enter/Space. The canvas is decorative to assistive technology; each destination has exactly one focusable HTML control.

### Visual behavior

- After loading reaches 100%, the loader finishes fading out, then the constellation fades in and rises from below with ease-out timing over 0.6 seconds, traveling 2.5vh (clamped to 12–27.5px). Header, Play invitation, labels, and transport remain hidden and inert until the entrance completes, then appear. Reduced motion skips the entrance and UI fades.

- Before playback has ever started, a semantic Play button follows the canvas conductor node in the full-orchestra view. Its circular hit target and ripple halo sit over the spatial node, with the quiet primary instruction “Play the orchestra” and supporting line “or select a group to explore” grouped directly below. Zooming in fades the widget out; returning to the full orchestra brings it back after the camera settles. Activating it starts playback, fades the invitation, and reveals the footer transport. The conductor does not become a transport control again after pausing.
- The root orchestra highlights one family at a time before playback using the existing colored hover intensity rather than white activity rings. Each family switches on immediately, holds for one second, switches off immediately, then waits three seconds before the next; nodes receive no individual timing or color correction. The family sequence is decorative, pauses for pointer or label hover, and is disabled for reduced motion. The first zoom-in permanently ends the family-node sequence for the session, even if the visitor returns to the full orchestra without playing; the conductor Play widget can still return. Starting playback ends both invitations.
- The conductor stays dark gray in every playback and invitation state. The canvas spans the full viewport behind both chrome bars. Explore controls stay within the usable area between the bars, including during zoom transitions. The transparent, borderless header is 50px high on desktop and mobile; the footer is 70px high on desktop and 60px on mobile.
- The stage holds the active identity heading and its instrument-level Explore action; the top bar holds Back at nested depths and functional controls. Back appears after the zoom from the full orchestra settles. The identity caption stays below the header bar and above the footer bar, at any level or orientation, including during zoom travel. At family or instrument depth, a layout may include decorative artwork behind the caption. Landscape and portrait art-direct that artwork independently through `figure` (`width`, `x`, `y`, `rotation`, `scale`, `opacity`, `mask`). The artwork does not receive pointer events and is not a semantic name. Violin, Viola, Cello, Contrabass, Horn, and the Strings family currently provide artwork. The caption type, not the artwork, stays between the header and the footer. The bottom bar contains only the centered playback controls, revealed after initial activation. Play, elapsed time, seek, duration, and decorative pulse bars remain in one row on narrow screens. Escape also withdraws one level.

- Seating, polar lattice, and section assignments are frozen product geometry. The root camera framing places the constellation slightly above center; desktop overview occupancy is 66% from 1024px wide (72% below that), leaving extra space below the header; family framing is unchanged. Past a 1280×800 viewport, instrument zoom pulls back in proportion to the larger overflow, so a selected instrument keeps that on-screen size. Family zoom takes about a third of that pullback. The full orchestra still fills the larger display. A muted, looping video sits behind the full-orchestra constellation and fades out with the zoom into a family or instrument, then fades back in on return. Playback continues until that zoom settles. It does not receive pointer events and is hidden from assistive technology. On a root launch, the browser preloads the clip while the loading overlay is visible and starts playback when the app is ready; loading does not wait for the whole file. Viewports below 1024px wide use the lightweight 720p encode; wider viewports use the 1080p production encode. Reduced motion shows a still poster without loading or playing the clip. At instrument depth on mobile portrait (shorter than 768px wide and taller than wide), the framing shifts downward by 10% of the viewport height so the selected lights sit lower under the heading. See [COMPOSITION-REFINEMENT.md](../docs/orchestra-map/COMPOSITION-REFINEMENT.md).
- Selected family or instrument is emphasized. Peripheral nodes are dimmed but remain present.
- Ghost twins express presence of the current view; they follow canonical navigation, not hover or mix. Reduced motion disables them. See [ghost-twins.md](../docs/orchestra-map/ghost-twins.md).
- Activity rings / intensity follow `activity.json` at the global transport time, including for instruments that are not currently decoded.
- Root family navigation labels are visually hidden while the WebGL map works; keyboard focus reveals each label, and the fallback shows them. At family depth, instrument names are no longer projected label chips. The heading group contains semantic instrument navigation buttons, revealed on keyboard focus and shown together in the scene-error fallback. At instrument depth, Explore sits with the heading as a separate button. The header Back button sits at the top left at both nested depths. Minimum target size is 44px.

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
| Seating / families | `src/features/orchestra-map/config.ts`, `utils/navigation.ts` |
| Label geometry | `utils/entity-layout.ts` |
| Motion | `three/navigation-motion.ts` |
| Catalog | `src/store/catalog.ts` |
| URL sync | `src/store/navigation-route.ts` |
| Tests | `tests/entity-layout.mjs`, `navigation-motion.mjs`, `navigation-path.mjs`, `ghost-idle.mjs`, `idle-animation.mjs` |

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

- When Explore becomes real, how does it attach to `/family/instrument/explore/…` without changing zoom?
- How much activity visualization should remain at orchestra depth on small screens?
- Physical-device performance of ghosts + activity + Web Audio together

---

## Validation

`npm test` covers layout, motion, path parsing, idle/ghosts, and listening independence. Visual feel, touch, and reduced-motion still require browser review.
