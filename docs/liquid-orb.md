# Liquid light orb study

Run `npm run dev` and open `/dev/liquid-orb`. This development-only route is lazy
loaded, skips navigation synchronization and audio connection, and does not mount
the orchestra map. The existing constellation material is unchanged.

## Technique

Each orb uses one camera-facing plane and one GLSL material. The comparison uses
one shared WebGL renderer and geometry, with five scissored views / draw calls. Up to eight analytic
radial crests sample continuous fields on a unit circle (no angular seam). Coupled
fields evolve at different rates, forming inward pleats and small outward
excursions. Independently gated crests accumulate light at overlaps. A hemisphere
mapping adds faint interior folds; one-sided diffusion suggests translucent silk
beneath each crest. Exponential distance falloff supplies local glow without
render targets or bloom passes. Exponential light rolloff and sRGB output keep
bright overlaps from clipping abruptly.

The parameter state belongs to React, while the renderer owns elapsed animation
time. Speed changes preserve phase. Pause preserves time while controls and resize
still redraw. Reset restores the base parameters, comparison controls, and starting phases,
preserving the user's pause preference. Reduced motion starts paused and changing the system
preference to reduced motion pauses it. Background tabs do not advance time.
The renderer disposes its geometry, material, observers and animation loop on exit.

## Reference defaults

| Control | Default |
|---|---:|
| Animation speed | 0.65 |
| Flow complexity | 1 |
| Flow distortion | 1 |
| Strand density | 5 |
| Strand thickness | 1 |
| Strand brightness | 1.2 |
| Internal folds | 0.18 |
| Interior ambient | 0.05 |
| Highlight concentration | 2.4 |
| Glow intensity | 0.65 |
| Glow radius | 1 |
| Orb opacity | 1 |
| Orb color | `#35c9ff` |

Values are artistic multipliers, not physical units. Higher highlight concentration
narrows the brightly illuminated portions of each strand. Density activates up to
eight crests. Opacity fades the result against the black study background.

## Reference and review status

The supplied `watery-orb.gif` has 63 frames, roughly 2.6 seconds per loop. Frames
0, 10, 20, 30, 40 and 50 were inspected. They show local inward pleats and shifting
overlaps rather than whole-object motion, an almost black center, faint folded
membranes, and a tight blue glow. The GIF is a local visual reference only; it is
not copied into the site and its reuse rights have not been determined.

TypeScript/build and lint were run. No browser was connected to the available
browser automation tool, so runtime GLSL compilation, rendered appearance,
interactive controls, animation smoothness and mobile layout still require browser
review. No visual match or measured frame rate is claimed. In particular, verify
that the procedural crests read as liquid folds rather than nested rings, that
bright overlaps remain selective, and that interior folds are visible but subtle.
The analytic technique does not reproduce the reference's actual fluid surface,
fine texture or true front/back occlusion.

Review at desktop and mobile sizes, at several animation moments, with pause,
reset, each control and reduced motion. Five orbs sit in one row on wide desktop screens. Smaller screens wrap to three,
two, or one column, keeping each orb square with controls below the comparison.

## Scaling assessment

The technique is a plausible candidate for smaller nodes, not a validated
60-instance solution. Cost is dominated by fragment shading: eight bounded field
iterations, trigonometric evaluations, and exponential glow falloffs per pixel.
The prototype caps device pixel ratio at 2. It allocates no geometry or simulation
objects per frame and uses no textures or extra render targets. The comparison
shares one WebGL context and caches tile positions on resize rather than measuring
the DOM every frame.

Before production integration, profile representative mobile GPUs. Opportunities
include a smaller fixed strand count for tiny nodes, eliminating interior folds
below a screen-size threshold, rendering tight billboards with instancing and
per-instance phase/color, and reducing pixel ratio. Sixty separate copies of this
600 CSS pixel canvas would be inappropriate; small instanced billboards have a
very different fill-rate budget. No orchestra integration is included here.


## State comparison

The route now compares the approved reference with dimmed, highlighted, playing,
and idle variants. These are experimental appearance mappings, not new production
map behavior. The shared material sliders and color apply to all five variants.
The shader itself is unchanged.

| State | Response relative to shared base |
|---|---|
| Reference | Unmodified |
| Dimmed | Opacity ×0.28, glow ×0.3, glow radius ×0.75, speed ×0.55 |
| Highlighted | Hover/focus or Active: glow up to ×3.5, glow radius ×1.65, brightness ×1.4 |
| Playing | Intensity 0→1: speed ×0.45→2, distortion ×0.55→1.6, complexity ×0.7→1.4, density ×0.5→1.6 (clamped 1–8), glow ×0.75→1.4 |
| Idle | Identical to Playing at intensity 0: speed ×0.45, distortion ×0.55, complexity ×0.7, density ×0.5 (clamped 1–8), glow ×0.75 |

Hover or keyboard-focus the highlighted orb. Click/tap it or use its Active button
to hold the state. Hover, focus and Active are combined, so it stays highlighted
until all three have released. Intensity and highlight transitions use exponential
smoothing with a faster rise than fall. Speed is integrated into each orb's own
phase; changing intensity never multiplies absolute elapsed time and jumps phase.
Fractional strand density fades strands into the existing shader rather than
switching whole strands abruptly.

As requested, music intensity is a demo only: an automatic, smooth 14-second phrase
with smaller swells, or a manual 0–100% slider. Moving the slider switches to manual
mode. The current smoothed intensity is displayed without screen-reader live
announcements. No audio is loaded or played. Pause freezes the demo clock, flow,
and idle flow; adjusting manual intensity or highlight while paused updates the
static appearance. Reduced motion starts the study paused, and Resume explicitly
opts into motion. Reset restores automatic mode, 50% manual value, inactive
highlight and starting phases while retaining pause/resume state.

State logic is in `src/features/liquid-orb/orb-states.ts`; rendering and interaction
are in `OrbComparison.tsx`; the page and shared controls are in `LiquidOrb.tsx`.
Run `node --experimental-strip-types tests/liquid-orb.mjs` to verify state contrast,
monotonic intensity response, bounded density, idle/zero-intensity equivalence and frame-rate-independent
attack/release. Build, lint and this focused check pass (lint retains existing map
warnings). Browser review remains pending because the preview tool has no connected
browser. Review hover/blur, keyboard focus, click/tap persistence, manual 0/50/100%,
automatic swells, pause/reset, mobile wrapping and resizing while paused.
