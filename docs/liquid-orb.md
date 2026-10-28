# Liquid light orb study

Run `npm run dev` and open `/dev/liquid-orb`. This development-only route is lazy
loaded, skips navigation synchronization and audio connection, and does not mount
the orchestra map. The existing constellation material is unchanged.

## Technique

One camera-facing plane, one GLSL material, one draw call. Up to eight analytic
radial crests sample continuous fields on a unit circle (no angular seam). Coupled
fields evolve at different rates, forming inward pleats and small outward
excursions. Independently gated crests accumulate light at overlaps. A hemisphere
mapping adds faint interior folds; one-sided diffusion suggests translucent silk
beneath each crest. Exponential distance falloff supplies local glow without
render targets or bloom passes. Exponential light rolloff and sRGB output keep
bright overlaps from clipping abruptly.

The parameter state belongs to React, while the renderer owns elapsed animation
time. Speed changes preserve phase. Pause preserves time while controls and resize
still redraw. Reset restores both parameters and the starting phase, preserving
the user's pause preference. Reduced motion starts paused and changing the system
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
| Interior ambient | 0.035 |
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
reset, each control and reduced motion. The nominal desktop orb diameter is about
425 CSS pixels; on mobile it scales to fit with controls below the preview.

## Scaling assessment

The technique is a plausible candidate for smaller nodes, not a validated
60-instance solution. Cost is dominated by fragment shading: eight bounded field
iterations, trigonometric evaluations, and exponential glow falloffs per pixel.
The prototype caps device pixel ratio at 2. It allocates no geometry or simulation
objects per frame and uses no textures or extra render targets.

Before production integration, profile representative mobile GPUs. Opportunities
include a smaller fixed strand count for tiny nodes, eliminating interior folds
below a screen-size threshold, rendering tight billboards with instancing and
per-instance phase/color, and reducing pixel ratio. Sixty separate copies of this
600 CSS pixel canvas would be inappropriate; small instanced billboards have a
very different fill-rate budget. No orchestra integration is included here.
