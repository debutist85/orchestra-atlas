# Spatial layout

Reusable TypeScript + Three.js geometry and label-positioning module. No React,
DOM measurement, styling, animation library, store, or Orchestra Atlas content
is imported. The module is independent of `model-inspector`; use either alone
or combine them. See [the specification](../../../specs/spatial-layout.md).

## Placement

```ts
import { placeCaption, resolveCaptionGap } from './spatial-layout'

const edge = 'right'
const gap = resolveCaptionGap(edge, 2, viewport) // 2vw → pixels
const point = placeCaption(
  { x: bounds.left, y: bounds.top, width: bounds.width, height: bounds.height },
  { width: labelWidth, height: labelHeight },
  edge, 'start', gap, 'outside',
)
// Consumer applies point.x/point.y to its own UI.
```

`edge` is top/bottom/left/right/center; `align` is start/center/end along that
edge. `side` is inside/outside. Gap acts perpendicular to the edge, using the
caption's adjacent edge. Center ignores align, side, and gap. Placement never
clamps or flips. `placeCaption` and `EdgePosition.gap` consume resolved CSS
pixels. `resolveCaptionGap` interprets numeric authoring values as vh on
vertical spacing (top/bottom), vw on horizontal spacing (left/right).

## Object bounds and depth

```ts
import { createObjectBounds, layoutLabels } from './spatial-layout'

const probe = createObjectBounds(model)
// Call after orbit/model changes, not from an independent continuous loop.
const measured = probe.measure(camera, viewport)
if (measured) {
  const result = layoutLabels([
    {
      id: 'title',
      position: { edge: 'right', align: 'center', side: 'outside', gap: 24 },
      measure: maxWidth => measureTitle(maxWidth), // your DOM/canvas/native UI
    },
    {
      id: 'category', relativeTo: 'title',
      position: { edge: 'top', align: 'start', side: 'outside', gap: 6 },
      measure: maxWidth => measureCategory(maxWidth),
    },
  ], measured.screen, safeArea, 120)
}
```

`measure` returns:

- `screen`: left/top/width/height in viewport CSS pixels, without viewport clamps.
- `depth`: near/far distances and extent along the camera's forward axis.
  Depth is signed; part of an object behind the camera may be negative.
- `world`: world-space Box3 of the included transformed mesh-box corners.

The provider caches local geometry-box corners, then transforms them using
current mesh world matrices and camera matrices. Object, parent, and nested
mesh rotation/translation/scale all affect results, as does camera orbit and
perspective/orthographic projection. The box is conservative: it encloses the
mesh boxes, not an exact pixel silhouette. It avoids resampling every vertex
while orbiting. Near/far-plane clipping occurs before perspective division,
including boxes that cross the camera. Entirely depth-clipped/empty/hidden
objects or zero-size viewports return `undefined`. Horizontal/vertical
viewport clipping is left to the consumer.

Mesh boxes are measured once, when the probe is created: create a new probe
after adding/removing meshes or modifying vertex geometry. Ordinary transforms
need nothing. Static meshes only: animated deformation, skinning, morph
targets, material transparency, and rendered-pixel visibility are not
modeled. `depth` describes the object, not occlusion by other objects.

### Stable orbit envelope

`createOrbitEnvelope(points, up)` (from `orbit-envelope.ts`) takes sampled
model vertices (e.g. model-inspector's `sampleModelPoints`) and returns a
measure `(camera, viewport, { target, distance, minPolarAngle, maxPolarAngle })`
giving a fixed maximum footprint over a full azimuth orbit and the supplied
polar range (radians). The points are reduced to a height-band profile that
contains them all (`orbitEnvelopeProfile`), so a measure is cheap.
Horizontal/vertical/depth extrema are solved analytically
(`projectOrbitEnvelope`) rather than sampled from camera poses. Perspective and
orthographic projection, camera up axis, zoom, and view offsets are supported;
the camera must orbit and look at `target` (the origin, where the profile is
built) with fixed up. The result is conservative, not a tight silhouette.

Camera angle is not a cache key: ordinary orbiting reuses the same result object.
Changing distance, projection/viewport, target, or polar limits recomputes it;
a new model pose or geometry needs a new envelope from newly sampled points.
If an allowed orientation would cross the perspective near plane, it returns
undefined instead of an unbounded projection; a consumer can retain its last
valid envelope while inspecting that close. It represents the full object
across rotations, without far-plane clipping.

In Orchestra Atlas, `explorerLayoutDefaults.labelBounds` in
`features/instrument-explorer/config.ts` defaults to `'envelope'`. Set it to
`'live'` globally or override an individual instrument:

```ts
export const explorerLayoutOverrides = {
  violin: { labelBounds: 'live' },
}
```

This switches the label reference only; model framing, hotspot focus travel,
and authored parallax are separate policies. Labels are pinned to the envelope
rather than moving with changing projected edges. Existing parallax can still
move the text relative to those fixed anchors.

`projectWorldCircle` is a lightweight adapter for map-like planar markers. It
projects the center and world-XY radius through the consumer's current camera.
Camera matrices should already be up to date.

## Linked labels

`layoutLabels(inputs, objectBounds, area, minWidth?, contain?)` returns placed
`boxes` and transform-anchor `points`. IDs are generic strings. Inputs can
reference the model (default), another input ID, or `'labels'` (the supplied
area). Missing/cyclic references fall back to the model. Label sizes come from
consumer-supplied measurement callbacks; widths are capped to the available
area. Optional `reach` reserves room for consumer-owned parallax motion.

Containment defaults to false. Set it true to shift linked groups together
into the supplied area; this preserves their internal edge gaps. No camera
framing, viewport reading, focus policy, or animation is implicit. The `custom`
placement hook exists for legacy/custom adapters; ordinary consumers should
use edge positions.

## Atlas integration

- Map caption placement re-exports the shared primitive for compatibility.
  Map markers use `projectWorldCircle`; existing planar adaptive framing stays
  in the map feature.
- Exploration's `layoutPlanes` is an adapter over `layoutLabels`. Production
  default title positions use edges; legacy anchor overrides are supported
  only in that adapter. Existing instrument title gaps remain pixel values
  from explorer configuration, while map authoring uses viewport units.
- Exploration publishes a stable maximum orbit envelope by default; live model
  screen bounds and depth are an opt-in through `labelBounds`. It keeps a stable model-frame reservation to avoid
  rotation-driven camera fitting feedback. During hotspot focus travel, label
  animation retains ownership and live label relayout is deferred.
- Parallax styling, signed layer depths, camera focus animations, minimap and
  description clearances remain Atlas policies. Computed object depth is
  available to consumers; it does not silently replace authored layer depths.

Run `npm run test:spatial` for the focused regressions independently of the
full application suite. Tests include `tests/spatial-layout.mjs`, spatial typography, caption placement,
caption framing, model extent, and map entity layout checks. Real browser/device
review is still required for animation and performance.

`layoutLabels` containment accepts `true`/`false` for both axes, or
`{ x: boolean, y: boolean }` to constrain each axis independently.
