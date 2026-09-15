# Spatial navigation motion prototype

## Ownership

Canonical navigation remains in `src/store/navigation-store.ts`. Map clicks and Back still call its semantic actions. Listening selection and requested playback mode remain in the independent listening store.

`src/features/orchestra-installation/navigation-motion.ts` owns a single GSAP timeline for discrete navigation. It is bound to the scene and stable DOM wrappers from React layout effects, with a GSAP context and explicit scene-disposal cleanup. This uses GSAP's context lifecycle without adding a separate React wrapper dependency.

GSAP controls:

- camera position and look-at center;
- navigation-only section emphasis targets;
- navigation-only per-node focus multipliers;
- opacity of spatial labels and current identity;
- opacity and a 5px vertical offset of contextual actions.

The renderer still owns material updates, hover interpolation, floor projections, and the existing activity/idle clock. Listening indicators remain React-derived; navigation does not write selection, activity or mix state. The listening-mode controls remain usable throughout travel.

## Choreography

Timing is centralized in `navigationTiming`, with an approximately 850ms transition. Approach and Withdraw are chosen by semantic hierarchy depth; transitions within one level reuse Approach.

Old labels/actions fade during the first 120ms. Travel begins at 50ms. Peripheral dimming starts at 100ms and focused emphasis at 200ms. At 150ms, React receives the new **presentation** navigation state while its wrappers are transparent. New labels resolve at 620ms (650ms on Withdraw); contextual actions resolve at 690ms. The delayed presentation state is not a second navigation source of truth: all events still go through canonical semantic actions.

A small lateral camera excursion during travel creates restrained perspective parallax across the existing formation. Geometry remains fixed, preserving alignment between map nodes, projected labels, and world-space picking regions. No orbit, per-node scale animation, or extra scene geometry is introduced.

## Interruptions and accessibility

Each new transition kills and releases the previous timeline/context without reverting its current visual values. The replacement starts from the rendered camera and current emphasis. Only the latest label handoff can execute. Contexts are reverted on disposal, DOM styles/inert flags are restored, and animation references are released.

Label and contextual-action wrappers are inert while their content changes; they become interactive at completion. The canvas remains navigable, and external semantic actions can interrupt travel. Focus moves to the current identity when the transition settles.

Reduced motion skips travel and parallax, immediately applying the destination and information. Switching to reduced motion during travel settles the latest transition. Resize and preset rebuilds also settle the current transition before recomputing framing, avoiding stale camera endpoints after orientation changes.

## Validation and limits

`npm test` includes actual GSAP controller checks for direction, interrupted camera continuity, return to Orchestra, reduced-motion snapping, forced settling, disposal, and listening-state independence. Existing selection tests remain in place. Build and lint are separate checks.

Browser automation could not initialize in this environment. The visual feel, DOM fade handoff, keyboard focus, touch interaction, and portrait/landscape layouts still require browser review. This is a motion prototype, not a completed visual sign-off.

GSAP is the only added runtime dependency. Its coordinated object/DOM timelines replace the camera's exponential interpolation; the build grew by approximately 28 KB gzipped. No new animation, React integration, or test framework dependencies were added.
