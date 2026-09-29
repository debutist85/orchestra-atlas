# Map annotations and interaction geometry

Approved map behavior is in [specs/orchestra-map.md](../specs/orchestra-map.md). This note is the label and picking implementation record.

`entity-layout.ts` owns CSS-pixel annotation placement and destination picking. Visual nodes retain their existing seating geometry and colors. The renderer projects node bounds, measures the current label buttons, and supplies the title and bottom action bounds as exclusion zones.

## Three geometries

- Visual: existing luminous node constellations.
- Label: a measured, minimum-44px text target just outside a corner of the group bounds.
- Interaction: root labels use a padded constellation region plus the label's own DOM target. Deeper levels retain their padded union of constellation and label bounds. Both use shared screen-space picking, not extra DOM buttons.

Every semantic destination retains exactly one focusable HTML button. The canvas stays decorative to assistive technology. Root family labels and family-level instrument buttons invoke the same semantic navigation actions as their constellations. Zooming in also highlights that group in the mix. At family depth, a click on empty canvas, a dimmed constellation, or outside the map withdraws with the same Back action. At instrument depth, only the focused nodes keep the view; any other map click withdraws. Native button activation supports Enter/Space. Hovering a constellation or a root caption highlights both. Root captions sit at low opacity; hover, focus, and group highlight restore full color. A parked light-pass gleam can be restored with `map-labels--gleam`. Text is always present at the appropriate level without requiring hover.

## Placement

At the orchestra level, family captions use `orchestraFamilyLabelPositions` in `orchestra-family-label-layout.ts`. The positions are normalized against the projected bounds of the complete orchestra fan, so they remain attached to the composition as the camera and viewport change. Strings sits beneath the fan; Other, Woodwinds, Percussion, and Brass follow its upper perimeter. Values may extend beyond `0–1` to place a caption outside those bounds. The same config contains compact overrides for the existing 600px breakpoint. Root captions are finally constrained to an eight-pixel stage margin.

At family depth, the old projected instrument captions are removed. Picking still
uses projected node bounds with a small margin; it no longer gains an invisible
caption hit area. Instrument navigation buttons live in the identity group for
keyboard and assistive technology. They appear on focus, or all together in the
scene-error fallback. At instrument depth, Explore is a separate button in the
same DOM group as the heading and stays a no-op annotation. Its visual position
is constrained between the header and footer.

Labels have no backdrop. Actual DOM measurements drive layout. Content observers request a layout frame even when reduced motion leaves the scene idle.

Projected picking prioritizes an actual node, then a caption, then the nearest available constellation. At the root, caption placement does not expand the padded constellation region across the space between caption and lights. Deeper levels keep the established union region. A caption centered on one family must not steal a neighboring light. Stable semantic IDs break ties, so changing DOM order does not change region picking. Existing world-space regions remain a fallback during semantic travel while labels are inert.

## Motion and scope

Zustand remains the navigation source of truth. During travel the layout keeps projecting the outgoing captions against the moving camera so they ride with the map. Approach dismisses sibling captions immediately and fades the selected one. The GSAP handoff then resolves the new level. The layout consumes the renderer's canonical destination; it does not create another navigation state. Family views add ← Back at the top-left of the canvas, under the top bar. Leaf instrument views keep ← Back in the header and Explore in the identity group. Escape withdraws one level. The identity group follows the projected selected constellation. The mix follows the current zoom.

No changes were made to node materials, palette, or camera choreography. The mix follows navigation rather than a separate selection.

## Verification

`tests/entity-layout.mjs` covers 1440×900, 1024×768, 768×1024, 320×568, 375×667, 390×844, 430×932, and 844×390. Tests project real seating geometry with the current camera focus, using representative label measurements, and cover every family plus the Flute leaf. Assertions check normalized root positions, minimum label target size, viewport bounds, nested corner placement, separate caption/constellation hit areas, node and label navigation targets, and independence from ordering. Motion and listening regression tests also run via `npm test`.

Headless Chrome also initialized the WebGL map and measured the root captions at 1440×900, 1024×768, 768×1024, and 390×844 without entering the fallback UI. Woodwinds and Strings navigation exposed the unchanged instrument caption sets. Human review is still useful for final art direction, focus appearance, touch feel, and motion quality.
