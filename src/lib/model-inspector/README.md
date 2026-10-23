# Model inspector

Behavioral contract: [Model inspector specification](../../../specs/model-inspector.md).

Framework-independent TypeScript + Three.js module for static GLTF/GLB inspection.
Copy this directory into another browser project with `three` installed. There
are no imports from React, GSAP, Zustand, Orchestra Atlas features, or CSS.
The current implementation is validated against the repository's Three.js 0.186.
This is a local module, not yet a published package.

```ts
import * as THREE from 'three'
import { createModelInspector } from './model-inspector'

const inspector = createModelInspector(host, {
  controls: { enableZoom: true, enablePan: true },
  setup(renderer, scene) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 3))
    // Supply your environment, tone mapping, lights, and optional cleanup.
  },
})
const unsubscribe = inspector.onState(({ status, error }) => {
  // Own your loading indicator, captions, errors, and retry controls.
})
await inspector.loadModel('/models/object.glb')
// Later:
unsubscribe()
inspector.dispose()
```

The host must have a nonzero CSS size. Canvas sizing and drawing are automatic;
no UI or visual style is injected. Lighting is deliberately consumer supplied.
Provide semantic keyboard controls and a textual description outside the canvas.
An entirely unlit scene will not show physically based materials meaningfully.

## Runtime API

- `loadModel(url, configure?)`: replaces the previous model, stages unique texture
  uploads, warms shaders, then resolves to the model after its first rendered
  frame. The synchronous `configure(model)` hook runs before GPU preparation;
  use it to set a pose or attach annotations. Failures reject and publish `error`.
  Replaced/cancelled loads resolve `undefined` and never report readiness.
- `onState(callback)`, `getState()`: `idle → loading → preparing → ready`, or
  `error`. Subscribe before loading; subscriptions return an unsubscribe function.
- `cancelModel()`: detaches the model and invalidates pending preparation. Shared
  network requests finish for caching; their results cannot attach to this load.
- `getModel()`: current scene instance, available during preparation too.
- `fitModel()`: fits a bounding sphere into both viewport axes while preserving
  the camera's viewing direction. `autoFit` defaults to true. Atlas disables it
  and retains its existing typography-aware framing.
- `resize()`: sizes the canvas and updates perspective. `autoResize` defaults to
  true; disable it when the consumer already owns a resize observer.
- `camera`, `controls`, `scene`, `renderer`: direct Three.js access for consumers
  that need custom camera positioning, lighting, or focus behavior. Animate them
  with whatever library you choose, and call `requestRender()` after mutations.
- `onRender`, `onSettle`, `onError`: subscriptions for overlays, settled-camera
  work, and renderer errors. `onError` reports draw failures; load-time draw
  failures also reject `loadModel`. Consumers own recovery after later errors.
- `dispose()`: invalidates work, disconnects observers, removes controls/listeners
  and canvas, and releases the WebGL context and setup-owned environment. Safe
  to repeat. The inspector must not be reused after disposal.

Options expose camera FOV, maximum pixel ratio, damping, orbit limits in radians,
zoom/pan toggles, and distance limits. Advanced `beginPreparation` /
`finishPreparation` methods pause/resume drawing; ordinary consumers should let
`loadModel` coordinate them.

## Utilities

- `createPointVisibility(camera)`: semantic-free incremental occlusion cache.
  Supply model and `{ id, object }` points, set a surface epsilon, then call
  `refresh(1)` per rendered frame. Its return value requests another frame until
  checks finish. Results persist while camera and points remain unchanged.
  Call `setPoints` again when externally changing the model/point transforms;
  synchronize camera matrices before refreshing.
- `projectToScreen`, `isOccluded`: projection and raycasting primitives.
- `sampleModelPoints`, `fitDistance`, `modelRadius`, `projectedBounds`: geometry
  utilities for consumers needing more precise custom framing.
- `createCanvasGestures`, `pickModelPoint`: tap/drag discrimination and picking.
- `instantiateModel`, `prepareModel`: lower-level resource and GPU preparation.

Decoded GLTF resources are shared by URL, keeping the two most recently used
models (a decoded model holds every texture as a raw bitmap, so heavy models
cost hundreds of MB). Instances clone scene graphs but share immutable
geometry/materials/textures. Do not mutate or dispose those shared resources
from an instance; clone a material before editing it. The inspector itself
releases a model's resources from its renderer when the model is detached, so a
disposed renderer is not kept alive through the shared cache. Animated/skinned
model playback is outside this extraction's current scope. One large GPU upload can still cause a brief
stall; splitting uploads does not make individual uploads interruptible.

## Atlas adapter and standalone example

`features/instrument-explorer/scene/instrument-stage.ts` supplies Atlas lighting,
camera constraints, and environment cleanup. `InstrumentModel.tsx` remains the
React adapter for content, annotations, typography, debug tools, and focus
animations. Feature-local utility re-exports preserve existing import paths.

Run `npm run dev` and open `/examples/model-inspector/`. The example uses only
this module and Three.js, with plain HTML controls. Enter any GLTF/GLB URL whose
server permits browser access. It does not import the Atlas application or its
assets. To test an existing licensed project asset, use its URL from the
instrument configuration.

For rotation-aware screen bounds, camera-space depth, and reusable captions,
combine the inspector with the independent [spatial-layout module](../spatial-layout/README.md).
Create an object-bounds probe after load and measure it from `onRender` using
the inspector's `camera` and `size()`; no inspector internals need to change.

Visibility work can continue through `createPointVisibility().refresh()` on a
separate animation-frame task. Only request a WebGL render when scene/camera
appearance changes; visibility-only DOM changes need no new model draw.
