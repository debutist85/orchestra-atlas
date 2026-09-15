# Map annotations and interaction geometry

`entity-layout.ts` owns CSS-pixel annotation placement and destination picking. Visual nodes retain their existing seating geometry and colors. The renderer projects node bounds, measures the current label buttons, and supplies the title and bottom action bounds as exclusion zones.

## Three geometries

- Visual: existing luminous node constellations.
- Label: a measured, minimum-44px text target placed adjacent to constellation bounds.
- Interaction: an invisible padded union of constellation and label bounds. It uses shared screen-space picking, not extra DOM buttons.

Every semantic destination retains exactly one focusable HTML button. The canvas stays decorative to assistive technology. The label and constellation invoke the same semantic navigation actions, never listening-selection actions. Native button activation supports Enter/Space; hover/focus emphasizes the existing constellation. Text is always present at the appropriate level without requiring hover.

## Placement

`labelPlacements` contains curated desktop/mobile anchor overrides using existing family/instrument IDs. Unspecified entities default to Top. The layout evaluates a small fixed set of neighboring anchors and offsets, penalizing other labels, fixed UI, and luminous marks; it clamps labels inside the viewport. There is no simulation or per-frame physics. These rules can be tuned without altering JSX or seating geometry.

Labels have transparent backgrounds and restrained typographic styling. Added/Some added indicators remain separate lines within the same target. Actual DOM measurements include these indicators. Content and fixed-UI observers request a layout frame even when reduced motion leaves the scene idle.

Projected picking prioritizes a label hit, then an actual node, then distance to the nearest label/node within the padded region. Stable semantic IDs break ties, so changing DOM order does not change region picking. Existing world-space regions remain a fallback during semantic travel while labels are inert.

## Motion and scope

Zustand remains the navigation source of truth. Existing GSAP presentation handoff fades the old destinations before resolving the new level. The layout consumes the renderer's canonical destination; it does not create another navigation state. Leaf instrument views have no map destination labels. Screen-space identity and Back/Add/Explore remain in their existing positions.

No changes were made to listening selection, audio behavior, node materials, palette, or camera choreography.

## Verification

`tests/entity-layout.mjs` covers 1440×900, 768×1024, 320×568, 375×667, 390×844, 430×932, and 844×390. Tests project real seating geometry with the current camera focus, using representative label measurements, and cover every family plus the Flute leaf. Assertions check minimum label target size, viewport bounds, label/UI collisions, node and label navigation targets, and independence from ordering. Motion and listening regression tests also run via `npm test`.

Browser automation could not initialize in this environment. Actual font measurements, visual association, keyboard focus/activation, and touch navigation still require manual desktop/mobile review. Geometry tests are not a substitute for that review.
