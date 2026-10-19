# Spatial layout

**Status:** Experimental shared implementation on `refactor/reusable-model-inspector`  
**Module:** `src/lib/spatial-layout`  
**Usage and API:** [Module README](../src/lib/spatial-layout/README.md)

## Purpose

Unify map caption placement and instrument-exploration label placement through
framework-independent edge geometry. Support reusable model-relative captions,
including a projected box and depth that respond to actual 3D transforms.
This is a local module, not a published package. No dependencies were added.

## Contract

- Placement uses `edge`, `align`, `side`, and perpendicular `gap`. Center
  centers both axes and ignores the remaining positional fields.
- The geometry core operates in CSS pixels. Consumers can resolve responsive
  authoring gaps through `resolveCaptionGap` (vh for top/bottom, vw for left/right).
- The module never imposes appearance, animation, domain content, React, DOM,
  application state, camera framing, or automatic flips/clamps on placement.
- Linked labels can reference the object, another label, or an allocated label
  area. Containment is opt-in and shifts linked groups without changing their
  internal relationships. Measurement/wrapping is consumer supplied.
- Missing/cyclic label references fall back to object bounds.

## Geometry

`createObjectBounds(root)` caches local mesh-box corners. Measuring transforms
those corners through current object hierarchy and camera matrices, returning
screen bounds, camera-space near/far depth and depth extent, and world bounds.
Changing root/child rotation, position, scale, or camera orientation must affect
the result without rebuilding the geometry cache.

The box is conservative and rotation-aware, not an exact mesh silhouette.
Near/far clipping must happen before projection to avoid inverted/infinite
rectangles for near-plane crossings. Invisible object hierarchies and camera
layers are respected. Empty, fully depth-clipped objects and zero-size viewports
return undefined. Partial off-screen rectangles remain unclamped. Geometry
changes require explicit `refreshGeometry`; static-mesh inspection is the
current scope. Deforming/skinned/morph geometry and pixel opacity are excluded.

`projectWorldCircle` provides projected node-circle bounds for planar scenes.
These are bounds representations, not the source of semantic scene state.

## Integration boundaries

The orchestra map uses the shared placement and planar projection primitives.
Its seating, framing, typography, navigation, and responsive authoring remain
feature owned. The former caption utility path is a compatibility re-export.

Exploration defaults now use edge/alignment configurations. Its existing
`layoutPlanes` adapter delegates linked placement/containment to the shared
module, while retaining old anchor-override compatibility. Label screen bounds/depth default to the maximum orbit envelope; `labelBounds: 'live'`
opts into angle-dependent bounds. Stable frame reservation remains
separate from live bounds to prevent camera/label feedback. Focus travel keeps
ownership of its animated labels; live relayout resumes afterwards.

Preserve existing parallax, authored text-plane depth, focus travel, descriptions,
minimap clearance, model fitting, audio, and accessible semantic markup. Measured
object depth is additional geometry data; adopting it as a replacement for
art-directed text depth would require a separate experience decision.

## Orbit-envelope label policy

Exploration defaults to `explorerLayoutDefaults.labelBounds: 'envelope'`, with
per-instrument override support. `'live'` restores following current model edges.
The reusable `measureEnvelope` API calculates conservative maximum screen and
depth extents of mesh-box corners across full azimuth and a permitted polar
range at a fixed target and distance. Analytic extrema avoid camera-angle scans.

The envelope must remain identical during ordinary orbiting. Cache invalidation
covers distance/zoom, projection/view offsets, viewport, target/up axis, polar
limits, model transforms/geometry, and visibility. Near-plane-crossing orbits
return undefined; Atlas retains the previous valid label reference rather than
publishing invalid bounds. Floating-point noise must not repeatedly relayout
fixed anchors. Far-plane clipping is not applied to the maximum object envelope.

The camera must look at its orbit target with fixed up. Static mesh geometry
limitations remain. The envelope controls resting label references, not the
model fit or existing parallax/focus animation policy.

## Validation

Geometry checks cover nested transforms, rotation-sensitive width/depth, camera
orientation, scale, near-plane crossing, behind-camera/hidden/empty objects,
linked labels, and planar marker projection. Existing map/explore layout tests
cover placement, stage composition, wrapping, containment, and camera framing.

Build, lint, and focused regression results are reported with implementation.
Browser/device review is required before accepting visual feel or performance;
no GPU/browser benchmark improvement is implied by unit tests. Existing full-suite
artwork assertions can fail independently of this extraction.

Portrait exploration titles use the selected bounds' top as their bottom-edge
reference, with the configured title gap. Horizontal alignment and containment
use the stage label area; vertical containment is disabled so it cannot detach
the titles from the envelope. This placement does not resize the model frame.
Large envelopes can therefore place titles above the safe area.

## Performance policy

`createObjectBounds(root, { static: true })` lets a consumer promise stable mesh
transforms/visibility between explicit `invalidateTransforms()` calls. Its
envelope cache hits skip hierarchy traversal. Dynamic detection remains the
default. World corners are cached separately from projection parameters;
geometry refresh invalidates both caches. Camera layer changes also refresh the
included meshes. Live `measure()` remains transform-aware in both modes.

Atlas coalesces label layout requests to animation frames and caches measured
text sizes by available width, with bounded per-label entries. Resize, font
loading and the end of focus travel invalidate measurements. This must preserve
wrapping, configured gaps and orientation-specific composition.
