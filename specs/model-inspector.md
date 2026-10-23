# Model inspector

**Status:** Experimental implementation on `refactor/reusable-model-inspector`; not yet merged into main or published as a package  
**Module:** `src/lib/model-inspector`  
**Usage guide:** [Model inspector README](../src/lib/model-inspector/README.md)  
**Related:** [Architecture](../docs/architecture.md), [Orchestra map](orchestra-map.md)

This specification records the extracted module's current contract. Changes to
its boundaries or observable behavior should update this file. Integration
examples belong in the module README.

## Purpose and boundaries

Provide reusable, framework-independent inspection of static GLTF/GLB models.
The module depends on Three.js and browser APIs, and is currently validated
against the repository's Three.js 0.186. It must not import React, Zustand,
GSAP, application features, domain content, or CSS.

| Module owns | Consumer owns |
|---|---|
| Model fetch/decode caching and scene instances | Asset selection, provenance, and rights |
| Staged texture uploads and shader preparation | Loading indicators, messages, and transitions |
| Renderer, camera, controls, resize, render scheduling | Lighting, environments, tone mapping, and visual design |
| Orbit, zoom, pan, gesture discrimination, picking | Semantic controls, navigation, and focus policy |
| Default camera fitting and geometry utilities | Authored compositions and camera animations |
| Projection and incremental annotation visibility | Annotation meaning, labels, markup, and selection state |
| Preparation/readiness/error notifications | Application state, error UI, retry actions, and recovery |

The canvas is a representation, not the source of application/domain state.
No built-in spinner, annotation appearance, title layout, animation library, or
instrument-specific behavior belongs in this module.

## Construction and configuration

The entry point is `createModelInspector(host, options?)`, exported from
`src/lib/model-inspector/index.ts`. Each instance owns one renderer, scene,
perspective camera, OrbitControls instance, and active model.

The consumer supplies a sized HTML host. The module appends a transparent,
antialiased canvas, marks it hidden from assistive technology, and uses
`touch-action: none` on that canvas to support orbit gestures. Consumer markup
supplies the accessible meaning and equivalent controls.

| Option | Current default / meaning |
|---|---|
| `fov` | 35 degrees |
| `maxPixelRatio` | 1.5; actual ratio is capped at this value |
| `autoResize` | `true`; observes host size |
| `autoFit` | `true`; fits on load and resize |
| `controls.dampingFactor` | 0.08; orbit damping is enabled |
| `controls.enableZoom` | `true` |
| `controls.enablePan` | `false` |
| `controls.minPolarAngle` / `maxPolarAngle` | 0 / π radians |
| `controls.minDistance` / `maxDistance` | 0 / Infinity |
| `setup(renderer, scene)` | Optional consumer setup; may return a cleanup function |

Lighting and environment are deliberately not supplied by default. Consumers
using physically based materials must provide suitable illumination. The setup
cleanup owns disposal of consumer-created resources, such as environment render
targets; the engine does not infer ownership of arbitrary scene resources.

## Model lifecycle

The observable states are `idle`, `loading`, `preparing`, `ready`, and `error`.
`getState()` reads the current state. `onState(callback)` subscribes to future
changes and returns an unsubscribe function; it does not replay the current
state. Error states include the original error as `unknown`.

A normal load follows this sequence:

1. `loadModel(url, configure?)` invalidates any previous request and detaches its
   scene instance. Drawing pauses while the next model prepares.
2. Publish `loading`, then fetch/decode or reuse the cached resource.
3. Attach a cloned scene graph and invoke the optional synchronous
   `configure(model)` hook. Apply default fitting if enabled.
4. Publish `preparing`. Upload each unique material texture with paint
   opportunities between uploads, then call asynchronous shader compilation.
5. Resume drawing. Only after a model frame renders with a nonzero viewport,
   publish `ready` and resolve the promise to that model instance.

`getModel()` can return an instance during preparation; its presence alone does
not imply readiness. A hidden or zero-size host cannot report readiness until
it has a usable size and renders. No simulated timer or progress percentage
substitutes for readiness.

For the active request, fetch, decode, configuration, GPU preparation, or
first-render failures publish `error` and reject `loadModel`. The failed model
is detached. Consumers catch the rejection and present their own recovery UI.
Calling `loadModel` again is the retry mechanism.

`onError(callback)` reports renderer draw failures. Failures during the initial
model frame also reject the load. Draw failures after readiness do not rewrite
an already-resolved load promise; consumers own subsequent recovery.

### Replacement, cancellation, and disposal

- Starting another load supersedes the previous generation. Stale results must
  not attach a model, publish readiness, or replace the current error state.
- Superseded or cancelled loads resolve `undefined` when outstanding work
  unwinds. Cancellation does not promise immediate network abortion or promise
  settlement while a shared fetch/decode is still pending.
- `cancelModel()` detaches the current model, removes pending readiness
  subscriptions, resumes drawing without it, and publishes `idle`.
- `dispose()` invalidates pending work, disconnects the resize observer, removes
  controls/subscriptions/canvas, calls setup cleanup, and releases the WebGL
  renderer/context. It is idempotent.
- Disposed inspectors must not be reused. `loadModel` after disposal resolves
  `undefined`; disposal must prevent pending results from accessing the released
  renderer or attaching models.

## Resource ownership

Resources are cached by URL, keeping only the two most recently used decoded
models (`MAX_CACHED_MODELS`); a use moves a model to most recent, and loading
a third forgets the least recent. A decoded model holds its file buffer and
every texture as a raw bitmap (4 MB per 1024² texture): the heaviest
instruments hold 100–270 MB each, and an unbounded cache reached about 1.2 GB
across the orchestra, beyond what mobile browsers allow a tab. Eviction only
forgets the entry; instances still on screen keep their own references, and a
later load fetches and decodes again. Concurrent requests share
fetch/decode work. Failed decoded-resource promises evict their entry so a later
load can retry.

Each instance gets a separate scene graph but shares the cached geometry,
materials, and textures. Consumers must treat those resources as immutable and
must not dispose them from individual instances. Clone materials before making
instance-specific edits; consumers own cleanup of any additional resources they
create.

Detaching a model (replacement, cancellation, or disposal) releases its shared
resources from that renderer (`releaseModelResources`, `gpu-resources.ts`).
A three.js renderer attaches a `dispose` listener to every geometry, material,
and texture it uploads and removes it only when that resource is disposed, not
when the renderer is; without this, every disposed renderer stayed reachable
from the cache. Disposing in three.js only drops GPU copies: the CPU data stays
cached and is uploaded again by the next renderer that draws it. This is the
one place shared resources are disposed; consumers still must not.

The stage's `size()` returns the host size as of the last `resize()` (reading
it live only before the first), because render and settle listeners call it
after writing DOM styles and a live read there forced a synchronous layout per
frame. Consumers that resize the host must call `resize()`, as the resize
observer does.

Inspector disposal releases its GPU context, not the decoded CPU-side resource
cache; the two-model limit is the cache's only release. Raw file-buffer promises
are released after successful decode. Decoded geometry may still reference
file-buffer data. Relative references
inside GLTF files resolve against the model URL; ordinary browser networking and
CORS requirements apply.

## Rendering, framing, and interaction

Rendering is on demand. Controls, explicit invalidation, and ongoing camera
changes wake the loop. Damping continues until the camera settles; inactive
views do not require a permanent render loop.

- `requestRender()` schedules a draw after direct scene/camera mutations.
- `onRender(callback)` runs after a rendered frame.
- `onSettle(callback)` runs after the camera/render work settles. New work can
  wake the loop again; this is not a one-time lifetime event.
- `resize()` updates renderer dimensions and camera projection; returns false
  when the host has no usable dimensions or the inspector is disposed.
- `fitModel()` fits a bounding sphere within both viewport axes, retaining the
  viewing direction and updating the orbit target and clip planes. It is a
  conservative default rather than a precision editorial composition system.
- `camera`, `controls`, `renderer`, and `scene` are exposed for custom consumers.
  Camera movement and focus transitions have no imposed animation style.
- Advanced `beginPreparation()` / `finishPreparation()` pause/resume drawing;
  normal consumers should let `loadModel` coordinate preparation.

`createCanvasGestures` separates taps from drags and rejects pinch/cancelled
sequences. It does not assign application meaning to empty-space clicks.
`pickModelPoint` supplies geometric picking; application selection remains with
the consumer. Keyboard controls and reduced-motion policy belong to the
consumer, including any custom camera animation.

## Annotation utilities

`createPointVisibility(camera)` accepts arbitrary `{ id, object }` points and an
occluding model. It has no knowledge of instrument anatomy, DOM labels, or
selected state.

- `setModel`, `setPoints`, and `setEpsilon` invalidate the current pass.
- `refresh(count = 1)` checks points incrementally and returns whether another
  frame is needed to finish the pass. Atlas uses one check per animation frame, with remaining CPU visibility work
  scheduled separately from WebGL drawing. Visibility-only updates must not
  redraw an unchanged scene.
- `isVisible(id)` returns cached visibility; unchecked points default to hidden.
- Camera matrix changes invalidate the pass automatically. Consumers synchronize
  camera matrices before refreshing, and call `setPoints` again after changing
  model/point transforms externally.
- Completion must not require a synchronous full pass when the camera settles.

`projectToScreen` and `isOccluded` expose lower-level projection and raycasting.
Occlusion stops at the first object reporting an intersection, respects raycaster
layers and recursive traversal controls, and reuses hit buffers per raycaster.
Individual mesh raycasts may still traverse dense geometry.
`sampleModelPoints`, `fitDistance`, `modelRadius`, and `projectedBounds` support
custom framing independently of the default fit.

## Orchestra Atlas integration

The instrument-stage adapter supplies existing lighting, studio environment,
FOV, and orbit constraints, and disables automatic fitting/resizing in favor of
the existing typography-aware composition and observers.

`InstrumentModel.tsx` remains the React integration for instrument content,
semantic annotation controls, debug editing, audio, view signals, and GSAP focus
behavior. Anchor naming conventions and anatomy corrections remain feature
content. Feature-local utility re-exports preserve existing import paths.

Extraction must preserve the established exploration experience, preparation
optimizations, and navigation semantics. It introduces no asset modifications,
new dependency, or package publication.

## Validation and current limits

The standalone `examples/model-inspector` consumer uses plain HTML and Three.js,
and must remain buildable without importing Atlas application code.

Automated coverage includes:

- `tests/model-inspector.mjs`: request replacement, first-frame readiness,
  cancellation before readiness, failure/retry, render errors, and disposal.
- `tests/model-preparation.mjs`: staged/deduplicated uploads, cancellation,
  incremental visibility, and stationary-camera caching.
- Existing resource, model-extent, canvas-gesture, anatomy, and experience tests:
  cache retry/deduplication, fitting, picking-related geometry, and integration.

The application build, standalone example build/type check, and focused tests
passed during extraction. The full suite remains blocked by a pre-existing
violin artwork-size assertion. Browser/device review remains pending; tests do
not establish visual equivalence or a performance improvement by themselves.

Current exclusions and constraints:

- Static GLTF/GLB inspection; animated/skinned playback is not supported by this
  extraction's contract.
- No public package/versioning or automatic cache eviction budget yet.
- No built-in domain UI, focus animation, model editor, or rights determination.
- Individual GPU uploads cannot be interrupted; staged preparation reduces
  accumulated work per frame but cannot guarantee stall-free rendering.
- Without asynchronous shader support, shader compilation can still block.
- Custom shader-uniform texture preparation and general asset-format support
  are not promised by the current material-texture preparation path.
