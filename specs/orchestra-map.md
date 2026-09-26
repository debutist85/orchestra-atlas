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

Instrument IDs are kebab-case in the path (`double-bass`). Extra trailing segments are ignored so later explorer routes can attach. Deeper or sibling moves push history; withdraw replaces. Query strings such as `?preset=` and `?debug=true` are preserved. There is no router library.

### Interaction

- Click/tap a family or instrument label, or its constellation, to enter that destination.
- Hovering a constellation or its caption highlights both. Hover is not required for selection.
- Escape, ← Back, empty-canvas click at family depth, and a click away from the focused instrument at instrument depth all withdraw one level.
- Explore on a focused instrument group is a no-op annotation. It does not change navigation or mix.
- Native buttons handle Enter/Space. The canvas is decorative to assistive technology; each destination has exactly one focusable HTML control.

### Visual behavior

- Seating, polar lattice, section assignments, and camera framing are frozen product geometry. Do not retune them while implementing other features. See [COMPOSITION-REFINEMENT.md](../docs/orchestra-map/COMPOSITION-REFINEMENT.md).
- Selected family or instrument is emphasized. Peripheral nodes are dimmed but remain present.
- Ghost twins express presence of the current view; they follow canonical navigation, not hover or mix. Reduced motion disables them. See [ghost-twins.md](../docs/orchestra-map/ghost-twins.md).
- Activity rings / intensity follow `activity.json` at the global transport time, including for instruments that are not currently decoded.
- Labels sit outside constellation corners (`entity-layout.ts`). Minimum target size is 44px. Idle captions are dim; hover, focus, and highlight restore them.

### Motion

`navigation-motion.ts` owns one GSAP timeline per discrete navigation. Camera, label opacity, identity, and emphasis travel together (~850 ms). Approach vs withdraw follows hierarchy depth. Interruptions start from the current rendered pose. Reduced motion snaps to the destination.

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
