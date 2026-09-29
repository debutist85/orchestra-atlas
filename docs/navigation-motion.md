# Spatial navigation motion

Approved map behavior is in [specs/orchestra-map.md](../specs/orchestra-map.md). This note is the motion implementation record.

## Ownership

Canonical navigation remains in `src/store/navigation-store.ts`. Map clicks and Back still call its semantic actions. The audible mix is a projection of that navigation. Playback transport remains in the independent playback store.

`src/features/orchestra-map/three/navigation-motion.ts` owns a single GSAP timeline for discrete navigation. It is bound to the scene and stable DOM wrappers from React layout effects, with a GSAP context and explicit scene-disposal cleanup. This uses GSAP's context lifecycle without adding a separate React wrapper dependency.

GSAP controls:

- camera position and look-at center;
- navigation-only section emphasis targets;
- navigation-only per-node focus multipliers;
- opacity of spatial labels and current identity;
- opacity and a 5px vertical offset of contextual actions.

The renderer still owns material updates, hover interpolation, floor projections, and the existing activity/idle clock. Navigation does not write playback, activity, or a separate listening-selection store. The mix follows the destination zoom when navigation changes.

## Choreography

Timing is centralized in `navigationTiming`, with an approximately 850ms transition. Approach and Withdraw are chosen by semantic hierarchy depth; transitions within one level reuse Approach.

On approach, root family captions fade with the camera travel. Family-level
instrument captions have been removed from the DOM; projected node regions
still drive pointer picking, while semantic instrument buttons live in the
identity group for keyboard access. The instrument-level Explore button also
lives in that group. React receives the new **presentation** navigation state
at 810ms. During either direction, the destination heading fades from 20%
opacity while its letter spacing contracts; the departing caption fades out
while its spacing expands. Each caption follows its own node-box anchor.
They share the camera's 50ms start, 760ms duration, and `power2.inOut` ease.
Only the destination caption is a semantic heading; the departing visual layer
is hidden from assistive technology. Focused family or instrument emphasis starts immediately so the hover
lift is not lost on selection; peripheral dimming shares the same camera
travel curve. The delayed presentation state is not a second navigation
source of truth: all events still go through canonical semantic actions.

A small lateral camera excursion during travel creates restrained perspective parallax across the existing formation. Geometry remains fixed, preserving alignment between map nodes, projected labels, and world-space picking regions. No orbit, per-node scale animation, or extra scene geometry is introduced.

## Interruptions and accessibility

Each new transition kills and releases the previous timeline/context without reverting its current visual values. The replacement starts from the rendered camera and current emphasis. Only the latest label handoff can execute. Contexts are reverted on disposal, DOM styles/inert flags are restored, and animation references are released.

Label and contextual-action wrappers are inert while their content changes; they become interactive at completion. The canvas remains navigable, and external semantic actions can interrupt travel. Focus moves to the current identity when the transition settles.

Reduced motion skips travel and parallax, immediately applying the destination and information. Switching to reduced motion during travel settles the latest transition. Resize and preset rebuilds also settle the current transition before recomputing framing, avoiding stale camera endpoints after orientation changes.

## Validation and limits

`npm test` includes actual GSAP controller checks for direction, interrupted camera continuity, return to Orchestra, reduced-motion snapping, forced settling, disposal, and listening-state independence. Existing selection tests remain in place. Build and lint are separate checks.

Browser automation could not initialize in this environment. The visual feel, DOM fade handoff, keyboard focus, touch interaction, and portrait/landscape layouts still require browser review. This is a motion prototype, not a completed visual sign-off.

GSAP is the only added runtime dependency. Its coordinated object/DOM timelines replace the camera's exponential interpolation; the build grew by approximately 28 KB gzipped. No new animation, React integration, or test framework dependencies were added.
