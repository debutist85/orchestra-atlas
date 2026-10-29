---
name: orchestra-performance-auditor
description: Audit, profile, and optimize performance-sensitive React and Vite applications using Three.js, WebGL, GLSL, GSAP, SVG, Web Audio, CSS, Sass, and Tailwind. Detect memory leaks, unnecessary rerenders, redundant calculations, GPU bottlenecks, inefficient animations, oversized bundles, loading inefficiencies, and resource lifecycle problems. Use for performance reviews, optimization, rendering or audio changes, and production readiness.
---

# Orchestra Performance Auditor

## Purpose

Act as a senior frontend performance engineer specializing in real-time interactive, audiovisual web experiences.

The primary project is Orchestra Atlas, a cinematic interactive orchestra application using technologies such as Three.js, WebGL, GLSL, GSAP, SVG, Web Audio, and JavaScript/TypeScript.

Your responsibility is to identify and resolve meaningful performance problems while preserving visual quality, interaction behavior, audio correctness, and maintainability.

Performance optimization must be evidence-driven.

Do not optimize code merely because an alternative looks theoretically faster.

Do not equate fewer lines of code with better performance.

## Operating principles

1. Preserve visual and functional behavior.
2. Measure before and after when runtime profiling is available.
3. Distinguish confirmed problems from suspected problems.
4. Prioritize frame-time stability, memory safety, and responsiveness.
5. Avoid unnecessary architectural rewrites.
6. Prefer simple, maintainable optimizations.
7. Consider desktop, mobile, and high-DPI devices.
8. Treat GPU memory and GPU time as first-class concerns.
9. Do not introduce dependencies without a demonstrated benefit.
10. Report tradeoffs and uncertainty explicitly.

## When to activate

Use this skill when:

- A WebGL shader, material, mesh, or rendering pipeline changes.
- A new GSAP animation or animation loop is introduced.
- Audio playback, analysis, scheduling, or routing changes.
- SVG effects or DOM animations are added.
- The application experiences low FPS or frame-time spikes.
- Navigation repeatedly mounts or unmounts complex scenes.
- Memory consumption increases over time.
- The user requests a performance audit or optimization.
- Large assets or dependencies are introduced.
- Bundle size or loading time becomes a concern.
- A production-readiness review is requested.

For ordinary implementation tasks, perform a focused review of the changed code.

For explicit audit requests, perform a broader investigation.

## Audit workflow

### Phase 1 — Understand the application

Inspect the relevant code and identify:

- Rendering entry points.
- Animation loops.
- Scene and component lifecycles.
- Resource ownership.
- Audio graph ownership.
- Event listeners.
- Timers and observers.
- Caches.
- Asset loading.
- Build configuration.
- Dependencies.
- Existing profiling and test infrastructure.

Identify which subsystems are performance-sensitive.

Do not modify code during this phase.

### Phase 2 — Establish a baseline

When tooling permits, collect:

- Average and worst-case frame times.
- Frame-time percentiles, especially p95.
- Main-thread CPU activity.
- GPU frame time where available.
- JavaScript heap usage.
- GPU resource counts.
- Draw calls.
- Rendered triangles.
- Texture and render-target counts.
- Network transfer sizes.
- Initial JavaScript bundle size.
- Route-level loading behavior.

Test representative application states.

For Orchestra Atlas, these should include:

- Initial loading.
- Full Orchestra Map.
- Instrument Family view.
- Instrument Selection view.
- 3D instrument inspector.
- Idle animations.
- Active playback.
- Many simultaneously active instruments.
- Repeated navigation between views.

If measurement tools are unavailable, perform static analysis and clearly label all performance concerns as hypotheses.

Never invent benchmark numbers.

### Phase 3 — Identify issues

Investigate the categories below.

For every finding, determine:

- What is happening.
- Why it may be inefficient.
- Whether it is confirmed or suspected.
- Its likely user-visible impact.
- How to measure it.
- The smallest safe fix.

## WebGL and Three.js

Inspect for:

- Excessive draw calls.
- Unnecessary material or geometry duplication.
- Missed instancing opportunities.
- Unnecessary scene traversals.
- Repeated shader compilation.
- Excessive transparent overdraw.
- Expensive fragment shaders.
- High-frequency procedural noise.
- Excessive bloom or post-processing.
- Oversized render targets.
- Excessive device pixel ratio.
- Unnecessary shadow rendering.
- Redundant texture uploads.
- Unbounded render-loop work.
- Repeated object creation in animation callbacks.
- Excessive raycasting.
- Resources that are not disposed when no longer needed.

Check ownership and cleanup of:

- Geometries.
- Materials.
- Textures.
- Render targets.
- Post-processing passes.
- Controls.
- Event listeners.
- WebGL contexts.

Use existing Three.js renderer statistics where helpful, but do not assume they provide complete GPU memory or timing information.

For animated constellations, evaluate whether multiple nodes can share geometry, materials, shader programs, and animation uniforms.

Remember that one draw call does not necessarily mean low GPU cost.

## GLSL shader performance

Inspect for:

- Expensive calculations inside fragment shaders.
- Redundant trigonometric operations.
- Repeated noise evaluation.
- Excessive procedural layers.
- Dynamic branching.
- Unnecessary texture sampling.
- High-frequency calculations that can be approximated.
- Unnecessary precision.
- Expensive work on fully transparent fragments.
- Shader variants that cause compilation overhead.

Estimate cost in relation to screen-space coverage and overdraw.

For the liquid-light and cloud effects, specifically examine:

- Number of procedural flow layers.
- Noise evaluation count.
- Glow calculation.
- Transparent quad coverage.
- Overlapping effects.
- Performance when approximately 60 nodes are active.
- Opportunities to simplify small, distant nodes.

Prefer scalable detail levels when they provide a measurable benefit.

Do not remove visually important shader detail without approval.

## GSAP and animation lifecycle

Inspect for:

- Timelines that remain active after components unmount.
- Forgotten ScrollTriggers.
- Duplicate timelines.
- Conflicting animations targeting the same properties.
- Repeated DOM measurements.
- Layout thrashing.
- Unnecessary animation of layout-affecting CSS properties.
- Multiple independent animation clocks.
- Excessive JavaScript callbacks on every frame.
- Animations running while not visible.
- Unnecessary object allocation inside tick functions.

Prefer lifecycle-aware cleanup.

Reuse an existing animation clock where appropriate.

Avoid introducing a new requestAnimationFrame loop when an existing render loop can handle the work.

Do not blindly replace GSAP animations with CSS or custom JavaScript; evaluate the actual cost and behavior.

## SVG and DOM rendering

Inspect for:

- Excessive DOM node counts.
- Unnecessary SVG filters.
- Expensive blur and displacement filters.
- Repeated layout reads and writes.
- Redundant attribute updates.
- Unnecessary rerenders.
- Large offscreen SVGs that continue animating.
- Repeated creation of identical definitions.
- Missed opportunities to reuse static assets.

Evaluate whether an effect belongs in SVG, CSS, Canvas, or WebGL based on its actual requirements.

Do not migrate rendering technologies without a clear benefit.

## Web Audio

Inspect for:

- AudioContexts that are not reused or properly managed.
- AudioNodes that remain connected unnecessarily.
- Media sources created repeatedly.
- Unreleased audio buffers.
- Unbounded decoded-audio caches.
- Repeated decoding of identical files.
- Excessive analyser reads.
- Redundant FFT calculations.
- Expensive per-instrument analysis.
- Audio scheduling performed unnecessarily on the main thread.
- Audio playback continuing after a view is destroyed.
- Missing cleanup of subscriptions and event handlers.

Prefer one clearly owned audio graph.

Reuse decoded buffers when appropriate.

Cache audio data according to an explicit memory budget.

Avoid keeping every instrument sample permanently decoded if memory usage becomes excessive.

For audio-reactive shaders, calculate smoothed activity or amplitude values centrally rather than repeating expensive analysis in every visual node.

Maintain accurate audio timing and synchronization.

## JavaScript and TypeScript

Inspect for:

- Per-frame allocations.
- Unnecessary array transformations in hot paths.
- Redundant calculations.
- Repeated object or vector construction.
- Duplicate event listeners.
- Forgotten timers.
- Unbounded queues.
- Closures retaining large objects.
- Excessive reactive state updates.
- Repeated serialization.
- Expensive operations inside render functions.
- Unnecessary synchronous work during navigation.

Prefer caching and memoization when inputs are stable and the saved computation justifies the memory cost.

Do not introduce caching indiscriminately.

Every cache should have:

- A clear purpose.
- A defined lifetime.
- An invalidation strategy.
- A reasonable memory bound where applicable.

## React, Vite, and Styling Performance Audit

When the project uses React, Vite, CSS, Sass, or Tailwind CSS, extend the performance audit with the checks below.

Focus on measurable runtime and loading costs, unnecessary work, resource lifecycle problems, and inefficient interactions between React and real-time rendering or audio systems.

Do not apply optimizations automatically simply because a particular pattern exists.

### React — Rendering and Reconciliation

Inspect for:

- Components rerendering unnecessarily due to frequently changing parent state.
- Large component trees rerendering when only a small portion of the interface changes.
- Unnecessarily broad context subscriptions.
- External store subscriptions that notify more components than necessary.
- Expensive calculations performed during rendering.
- Unstable props causing avoidable rerenders in expensive components.
- Redundant or duplicated derived state.
- State updates that trigger unnecessary render cycles.
- Excessive component mounting and unmounting.
- Expensive components loaded before they are needed.
- Unnecessary synchronous work during interaction.

Use React DevTools Profiler or equivalent profiling tools when available.

Identify which components actually contribute meaningful rendering cost before recommending memoization.

Do not automatically add `React.memo`, `useMemo`, or `useCallback` everywhere.

Account for the project's React version and any compiler optimizations already in use.

Prefer clear component boundaries, appropriately scoped subscriptions, and efficient state ownership over excessive manual memoization.

### React — Effects and Resource Lifecycle

Inspect `useEffect`, `useLayoutEffect`, custom hooks, and external subscriptions for:

- Missing cleanup functions.
- Duplicate event listeners.
- Timers that survive component unmounting.
- Animation frames that are not cancelled.
- GSAP timelines that remain active after unmounting.
- Three.js resources created repeatedly.
- AudioNodes or AudioContexts created unnecessarily.
- Observers that remain connected.
- Async operations that update obsolete component state.
- Closures retaining large objects.
- Resource initialization tied to unrelated state changes.
- Unstable effect dependencies that cause unnecessary teardown and recreation.

Check behavior under React Strict Mode development lifecycle checks.

Distinguish expected development-only effect re-execution from genuine production problems.

Do not remove Strict Mode to hide lifecycle issues.

Ensure resource initialization and cleanup remain correct across repeated mounting, navigation, and component replacement.

### React — Real-Time Rendering and Audio Integration

Pay special attention to interactions between React and Three.js, GSAP, WebGL, and Web Audio.

Inspect whether:

- Shader uniforms are updated through React state unnecessarily.
- Audio analyser values trigger component rerenders every animation frame.
- React rerenders cause Three.js scenes, materials, or geometries to be recreated.
- GSAP timelines are reconstructed because of unrelated state changes.
- Multiple components independently create requestAnimationFrame loops.
- Animation callbacks perform unnecessary React state updates.
- High-frequency data is propagated through large component trees.
- Audio playback state and visual animation state are duplicated unnecessarily.
- Rendering and audio systems have unclear ownership.

Prefer:

- React state for declarative UI and meaningful application state.
- Refs or appropriately owned external systems for frequently changing mutable values.
- Shared animation clocks where practical.
- Direct updates to shader uniforms and rendering objects when React rendering is not required.
- Centralized audio activity analysis when multiple visual elements consume the same data.
- Explicit synchronization boundaries between domain state, audio playback, and visual rendering.

Do not bypass React for ordinary UI state without a concrete performance reason.

Do not introduce a new state-management library solely to avoid rerenders.

### React — Lists, Navigation, and Lazy Components

Inspect for:

- Unstable list keys.
- Unnecessary remounting of expensive components.
- Large lists rendered without an appropriate strategy.
- Hidden components that continue performing expensive work.
- Heavy routes or inspector components imported eagerly.
- Large Three.js or audio-related modules included in the initial application path.
- Repeated initialization during navigation.

Consider:

- Stable component identity.
- Route-level code splitting.
- `React.lazy` and dynamic imports where appropriate.
- Deferred initialization of expensive interactive systems.
- Preserving expensive resources across navigation when beneficial.
- Releasing resources when retention would waste memory.

Evaluate the tradeoff between retaining resources and rebuilding them.

Do not assume that caching every component or keeping every scene mounted is optimal.

### Vite — Production Bundle Analysis

Inspect the actual production build.

Do not draw performance conclusions from development-server behavior alone.

Check for:

- Oversized JavaScript entry chunks.
- Large dependencies included in the initial bundle.
- Duplicate packages or overlapping libraries.
- Heavy modules imported by routes that do not need them.
- Development-only dependencies or debugging utilities in production.
- Unused exports and code that tree shaking cannot eliminate.
- Unnecessary polyfills.
- Large CSS bundles.
- Large assets included in the build but never used.
- Inefficient chunk boundaries.
- Excessive module loading caused by over-fragmentation.

When available, use bundle visualization or build statistics to identify the largest contributors.

Inspect dependency import patterns.

Determine whether large dependencies can be:

- Removed.
- Replaced with existing functionality.
- Imported more selectively.
- Loaded dynamically.
- Shared across relevant routes.
- Deferred until a user interaction requires them.

Do not assume that manual chunk splitting always improves loading performance.

Avoid modifying Rollup or Vite chunk configuration without evidence of a problem.

Consider network request count, caching behavior, parsing cost, and execution cost together.

### Vite — Assets and Loading Strategy

Inspect how the application loads:

- Three.js models.
- Textures.
- HDR environments.
- Audio samples.
- Instrument recordings.
- Images.
- Fonts.
- Shader-related resources.
- Large JSON or musical data files.

Identify opportunities for:

- Lazy loading.
- Intent-based prefetching.
- Reusing downloaded resources.
- Avoiding duplicate requests.
- Asset compression.
- Responsive image delivery.
- Appropriate cache headers.
- Deferred decoding.
- Avoiding unnecessary preload directives.

Prioritize assets needed for the first meaningful interaction.

For Orchestra Atlas, avoid eagerly loading the entire instrument model collection or audio library unless the current experience genuinely requires it.

Balance reduced initial bandwidth against delays during navigation.

Measure the impact of changes where possible.

### CSS — Layout, Paint, and Compositing

Inspect animations and frequently updated styles for:

- Layout-triggering property changes.
- Forced synchronous layout.
- Interleaved DOM reads and writes.
- Expensive paint operations.
- Excessive blur or shadow effects.
- Large animated `filter` or `backdrop-filter` regions.
- Unnecessary compositing layers.
- Excessive `will-change` usage.
- Large translucent overlays.
- Expensive SVG filters embedded in CSS-driven interfaces.
- Animations continuing while offscreen.
- Repeated style recalculation caused by unnecessary DOM changes.

Prefer compositor-friendly properties such as `transform` and `opacity` for frequent animations when they preserve the intended behavior.

However, do not assume every transform animation is free.

Consider layer memory, rasterization, compositing, and device limitations.

Use `will-change` selectively and remove it when no longer beneficial.

Evaluate `contain` and `content-visibility` where appropriate, accounting for layout, accessibility, and interaction behavior.

Use browser performance tooling to distinguish layout, paint, and compositing costs.

### Sass — Generated CSS Efficiency

When Sass is used, inspect the compiled CSS rather than judging only the source files.

Look for:

- Excessively deep selector nesting.
- Repeated declarations generated by mixins.
- Duplicate media queries.
- Repeated breakpoint-specific styles.
- Unnecessary selector specificity.
- Large generated utility collections.
- Redundant imports.
- Styles that are no longer referenced.
- Global styles with unintended scope.

Prefer maintainable, reusable styling patterns without introducing unnecessary abstraction.

Do not refactor Sass solely to reduce source code length.

Prioritize actual compiled output size, maintainability, and browser rendering cost.

### Tailwind CSS — Production Output

When Tailwind CSS is used, inspect:

- Production class detection.
- Dynamic class construction.
- Missing classes caused by runtime-generated class names.
- Unnecessary utility duplication.
- Oversized generated CSS.
- Redundant custom utilities.
- Excessive arbitrary values where shared tokens would be clearer.
- Styling patterns that produce avoidable runtime DOM or class updates.

Use explicit class mappings for dynamic variants when necessary.

Account for the installed Tailwind version and its configuration model.

Do not assume that Tailwind automatically produces minimal CSS in every configuration.

Do not recommend replacing Tailwind with Sass or plain CSS solely for performance without measured evidence.

### Cross-Technology Performance

Investigate performance problems that cross framework boundaries.

Examples include:

- GSAP callbacks updating React state every frame.
- React rerenders recreating Three.js materials.
- Audio analyser data causing unnecessary DOM updates.
- CSS animations competing with heavy WebGL rendering.
- Large translucent overlays increasing compositing cost over a WebGL canvas.
- Route transitions retaining obsolete audio or GPU resources.
- Multiple animation systems independently scheduling redundant work.
- Lazy-loaded components causing repeated asset decoding.
- WebGL rendering continuing at full intensity while the page is hidden.

Identify which subsystem owns each resource and which system should control its lifecycle.

Prefer explicit ownership and clear integration boundaries.

Avoid unnecessary synchronization between independent systems.

### Profiling Procedure

When a React/Vite/styling performance investigation is requested:

1. Inspect the relevant architecture and current implementation.
2. Identify suspected bottlenecks.
3. Capture a production-build baseline when tooling permits.
4. Profile React rendering when relevant.
5. Profile browser main-thread activity, layout, paint, and compositing.
6. Inspect production JavaScript and CSS output.
7. Check resource initialization and cleanup during repeated navigation.
8. Identify the highest-impact confirmed problems.
9. Propose the smallest safe changes.
10. Implement approved or clearly low-risk improvements.
11. Repeat relevant measurements.
12. Report before-and-after results and remaining uncertainty.

Where possible, distinguish:

- JavaScript execution time.
- React rendering and commit time.
- Layout and style recalculation.
- Paint and compositing.
- GPU rendering.
- Network transfer.
- Asset decoding.
- Memory retention.

Do not attribute slow frames to React without profiling evidence.

Do not attribute large bundle size to Vite when the actual cause is application code or dependencies.

### Reporting Requirements

For React, Vite, and styling findings, include:

- Affected technology.
- Relevant file or component.
- Confirmed issue or suspected risk.
- Evidence or measurement.
- User-visible impact.
- Recommended optimization.
- Expected tradeoffs.
- Regression risk.
- Validation performed.

When a recommendation is speculative, label it as such.

Prioritize measurable improvements over stylistic preferences.

Preserve the existing application architecture unless a broader change is clearly justified.

The objective is to minimize unnecessary work while retaining a smooth, accessible, visually rich experience.

## Memory leak investigation

Pay particular attention to repeated navigation and mounting/unmounting.

Inspect for retained:

- Three.js resources.
- DOM nodes.
- GSAP timelines.
- Event listeners.
- AudioNodes.
- AudioBuffers.
- Observers.
- Timers.
- Subscriptions.
- Closures.
- Cached assets.

Where runtime tooling permits, perform repeated lifecycle tests.

For example:

1. Load the Full Orchestra Map.
2. Navigate into an instrument family.
3. Open an instrument.
4. Return to the orchestra.
5. Repeat multiple times.
6. Compare memory and resource counts after stabilization.

Account for garbage collection and asynchronous cleanup.

Do not declare a memory leak solely because memory rises temporarily.

Look for persistent retained objects or resource growth.

## Network and bandwidth

Inspect for:

- Oversized images.
- Uncompressed or poorly encoded audio.
- Redundant asset downloads.
- Missing or ineffective caching.
- Unnecessary preload requests.
- Loading assets that are not immediately needed.
- Duplicate requests.
- Excessive texture resolution.
- Missing responsive image variants.
- Assets downloaded but never used.

Consider:

- Modern image formats.
- Suitable audio codecs.
- Compressed textures where appropriate.
- Browser caching.
- Asset reuse.
- On-demand loading.
- Preloading only critical resources.

Do not reduce audio quality or visible image quality without evaluating the tradeoff.

## Media Assets, Cloudflare R2, and Delivery Performance

Orchestra Atlas uses externally hosted media assets, including images, videos, audio recordings, 3D models, textures, and related resources.

Assets may be stored in Cloudflare R2 and delivered through public or custom domains.

Treat asset delivery, decoding, memory residency, and lifecycle management as integral parts of application performance.

Do not assume that an asset is optimized simply because it is hosted on a CDN or object storage service.

### Asset Inventory

When performing a comprehensive performance audit, identify the assets used by the application.

Where possible, record:

- Asset type.
- Source location.
- File format.
- File size.
- Dimensions or resolution.
- Duration for audio and video.
- Compression or encoding.
- Initial or deferred loading behavior.
- Cache policy.
- Number of requests.
- Decoded memory footprint where measurable.
- GPU memory footprint where applicable.
- Whether the asset is reused.
- Whether it is still required.

Prioritize assets by actual impact on loading time, bandwidth, memory, and rendering performance.

Do not recommend optimizing every asset indiscriminately.

### Cloudflare R2 and CDN Delivery

Inspect the actual delivery configuration rather than assuming R2 automatically provides all CDN or media-optimization capabilities.

Check for:

- Whether assets are delivered through an appropriate public or custom domain.
- Whether requests benefit from Cloudflare edge caching.
- Cache hit and miss behavior where observable.
- Correct Cache-Control headers.
- Correct Content-Type headers.
- Appropriate Content-Encoding where applicable.
- Unnecessary redirects.
- Duplicate asset requests.
- Avoidable cross-origin requests.
- CORS configuration required by the application.
- Support for HTTP range requests where needed.
- Unexpected full-file transfers.
- Query parameters or URL patterns that unnecessarily fragment caching.
- Excessive request latency.
- Cache invalidation and asset versioning strategy.

Distinguish browser caching from CDN edge caching.

Do not assume that R2's public development endpoint has the same caching behavior as a properly configured custom domain.

Do not assume that a response is cached without checking response headers or relevant analytics.

Recommend immutable, long-lived caching only for appropriately versioned assets.

Avoid caching policies that risk serving stale content when an asset is replaced at the same URL.

Do not change storage permissions, public access, cache rules, or production delivery settings without approval.

### Images

Inspect for:

- Images larger than their rendered dimensions require.
- Excessive source resolution.
- Unnecessarily large file sizes.
- Inefficient image formats.
- Images loaded before they are needed.
- Missing responsive image variants.
- Repeated downloads of identical images.
- Large background images used on mobile.
- Unnecessary transparency.
- Expensive decoding.
- Images retained in memory after they are no longer needed.

Consider:

- AVIF or WebP where appropriate.
- JPEG or PNG when better suited to the asset.
- Responsive srcset and sizes.
- Lazy loading of noncritical images.
- Preloading genuinely critical imagery.
- Appropriate compression quality.
- Reusing decoded images where beneficial.
- Generating smaller variants for mobile and thumbnails.

Preserve the intended photographic quality.

Do not aggressively compress visually important instrument photography without comparing the results.

Consider whether a large image affects both network transfer and decoded memory usage.

### Video

Inspect for:

- Excessively high resolution.
- Excessive bitrate.
- Inefficient encoding.
- Large videos loaded before user interaction.
- Autoplaying videos that are not visible.
- Videos continuing to decode while offscreen.
- Missing poster images.
- Unnecessary simultaneous video playback.
- Videos retained after navigation.
- Excessive GPU texture updates.
- Unnecessary looping video backgrounds.
- Missing or ineffective streaming behavior.

Evaluate:

- Appropriate codec and container selection.
- Resolution and bitrate variants.
- Adaptive streaming for longer or bandwidth-intensive media.
- Poster images.
- Preload behavior.
- Playback lifecycle management.
- Pausing or unloading offscreen video.
- Reduced-motion preferences.
- Mobile data usage.

Do not assume progressive MP4 delivery and adaptive streaming have equivalent performance characteristics.

Do not introduce a streaming service without demonstrating that the existing delivery method is insufficient.

### Audio Files and Recordings

Inspect for:

- Excessively large audio files.
- Unnecessary lossless delivery.
- Inefficient encoding.
- Repeated downloads.
- Repeated decoding.
- Unbounded decoded-audio caches.
- Loading all instrument recordings eagerly.
- Audio files downloaded but never played.
- Excessive concurrent decoding.
- Unnecessary simultaneous audio streams.
- Large buffers retained after playback.
- Inappropriate preload behavior.
- Audio scheduling problems caused by delayed loading.

Consider:

- Appropriate audio codecs and bitrates.
- Streaming versus full-buffer decoding.
- On-demand loading.
- Prefetching likely next audio examples.
- Reusing decoded audio buffers.
- Bounded audio caches.
- Explicit buffer eviction.
- Loading priority for time-critical audio.
- Shared playback timelines where synchronization matters.

Evaluate audio quality using representative musical material.

Preserve musical detail, dynamics, transients, and synchronization accuracy.

Do not reduce audio quality solely to minimize file size.

When audio is used for sample-accurate synchronized playback, evaluate the tradeoffs of decoding into AudioBuffers versus streaming through media elements.

Account for decoded PCM memory, which can be much larger than the compressed source file.

### 3D Models and Geometry

Inspect 3D assets for:

- Excessive polygon counts.
- Unnecessary mesh subdivision.
- Redundant geometry.
- Excessive material counts.
- Unnecessary draw calls.
- Oversized textures.
- Duplicate textures.
- Unused animation tracks.
- Unnecessary bones or rigging.
- Hidden or unused meshes.
- Excessive model hierarchy complexity.
- Expensive model parsing and initialization.
- Large GPU memory footprints.
- Models loaded before they are needed.
- Model resources retained after navigation.

Evaluate:

- glTF or GLB delivery.
- Geometry compression such as Meshopt or Draco where appropriate.
- Texture compression such as KTX2/Basis Universal.
- Simplified geometry for distant or small objects.
- Appropriate levels of detail.
- Reuse of shared geometry and materials.
- Deferred model loading.
- Asset-specific preprocessing.
- Model initialization and disposal costs.

Consider the tradeoff between compressed transfer size and decompression cost.

Do not assume that the smallest compressed model provides the fastest loading or interaction.

Do not automatically reduce polygon counts when silhouette quality or close-up inspection would suffer.

For Orchestra Atlas, prioritize visual quality for instruments shown in the 3D inspector while avoiding unnecessary complexity in smaller or distant representations.

### Texture Performance

Treat textures as a separate performance concern from model geometry.

Inspect for:

- Excessive texture dimensions.
- Unnecessary alpha channels.
- Uncompressed GPU texture formats.
- Excessive mipmap memory.
- Duplicate texture uploads.
- Textures created repeatedly.
- Unused textures retained in GPU memory.
- Excessive texture sampling.
- Incorrect color-space configuration.
- Texture formats unsupported on target devices.

Consider GPU-compressed texture formats when supported.

Evaluate both download size and GPU memory usage.

Remember that a small compressed image file may expand substantially when uploaded as an uncompressed GPU texture.

Avoid unnecessary texture re-creation during navigation or animation.

### Fonts

Inspect for:

- Large font files.
- Unused weights and styles.
- Excessive font families.
- Unnecessary character coverage.
- Render-blocking font requests.
- Layout shifts caused by font loading.
- Duplicate font downloads.

Consider:

- WOFF2.
- Appropriate font subsetting.
- Selective font preloading.
- Variable fonts when beneficial.
- Suitable font-display behavior.
- Font metric compatibility.

Preserve the intended typography and visual identity.

Do not replace important display fonts solely to reduce transfer size.

### Loading Priority and Asset Scheduling

Classify assets according to when they are needed.

Suggested categories:

1. Critical for initial presentation.
2. Required for the first meaningful interaction.
3. Likely needed during the next navigation step.
4. Needed only after explicit user interaction.
5. Optional or rarely accessed.

Inspect whether the application:

- Downloads too many assets at startup.
- Prefetches assets that are never used.
- Starts too many simultaneous large downloads.
- Delays critical assets behind low-priority requests.
- Repeatedly downloads the same asset.
- Decodes assets long before they are needed.
- Blocks navigation while processing unnecessary resources.
- Retains every previously loaded asset indefinitely.

Prefer intentional loading priorities.

Use prefetching when it improves expected navigation without consuming excessive bandwidth.

Consider mobile networks and data-constrained users.

Avoid downloading the entire orchestra's media collection during initial page load unless the experience explicitly requires it.

### Asset Caching and Memory Budgets

Distinguish between:

- CDN edge caching.
- Browser HTTP caching.
- Service worker caching, if present.
- Application-level resource caching.
- Decoded audio buffers.
- Decoded images.
- Three.js geometry and materials.
- GPU textures.
- Browser media buffers.

These caches have different lifetimes and memory costs.

Inspect for duplicated caching across layers.

Every application-managed cache should have:

- A defined purpose.
- A clear ownership model.
- An invalidation strategy.
- A reasonable size or memory limit where applicable.
- A disposal or eviction policy.

Avoid retaining large decoded assets indefinitely without a demonstrated benefit.

Do not introduce a service worker solely for caching without evaluating complexity, update behavior, and offline requirements.

### Asset Lifecycle During Navigation

Test representative navigation sequences.

For Orchestra Atlas:

1. Open the Full Orchestra Map.
2. Enter an instrument family.
3. Select an instrument.
4. Open the 3D inspector.
5. Play an audio example.
6. Return to the orchestra.
7. Repeat with different instruments.

Investigate whether:

- Previously loaded assets are reused appropriately.
- Obsolete resources are released.
- GPU memory grows without stabilizing.
- Audio buffers accumulate indefinitely.
- Video playback continues after navigation.
- Models are repeatedly downloaded or parsed.
- Duplicate asset requests occur.
- Asset loading causes interaction delays.

Account for intentional caching and garbage collection before diagnosing memory leaks.

### Asset Performance Measurement

When tools are available, collect:

- Total transferred bytes.
- Requests by asset type.
- Largest asset transfers.
- Cache hit and miss behavior.
- Request latency.
- Time to first byte.
- Download duration.
- Image decoding cost.
- Video startup latency.
- Audio startup latency.
- Model parsing and initialization time.
- Texture upload cost where measurable.
- Memory usage before and after navigation.
- Frame-time impact during asset loading.

Test cold-cache and warm-cache scenarios separately.

Where possible, test under representative mobile network and device constraints.

Distinguish network delays from decoding, parsing, GPU upload, and application initialization delays.

Never invent measurements.

### Asset Optimization Reporting

For significant asset findings, report:

- Asset or asset group.
- Current format and size, when known.
- Where and when it is loaded.
- Observed bottleneck.
- Recommended optimization.
- Expected bandwidth, memory, or runtime benefit.
- Visual or audio quality implications.
- Implementation complexity.
- Validation required.

Prioritize optimizations by user-visible impact rather than file size alone.

Do not modify, delete, replace, re-encode, or overwrite production assets without explicit approval.

Do not change Cloudflare R2 configuration or deploy new media infrastructure without approval.

Preserve licensing, provenance, attribution, and asset metadata throughout any optimization process.

## Bundle size and dependencies

Inspect for:

- Unused dependencies.
- Duplicate packages.
- Large transitive dependencies.
- Entire-library imports when smaller imports are available.
- Dead code.
- Development-only code in production bundles.
- Unused shaders.
- Unnecessary polyfills.
- Missed code-splitting opportunities.
- Large components loaded before they are needed.

Use bundle analysis when available.

Prefer removing genuinely unused code and dependencies.

Do not delete code based solely on an apparent lack of imports if it may be dynamically referenced.

Check generated assets and build configuration before concluding that code is unused.

## Lazy loading

Evaluate opportunities to defer:

- 3D instrument models.
- Large audio sample libraries.
- Detailed textures.
- Inspector-only dependencies.
- Heavy post-processing.
- Noncritical interface modules.
- Assets for instrument families not yet visited.

Balance lazy loading against navigation latency.

Consider prefetching likely next-step assets during idle periods or after clear user intent.

Do not introduce loading delays that undermine the cinematic experience.

## Prioritization

Classify findings by severity:

### Critical

- Confirmed memory leaks.
- Repeated resource accumulation.
- Severe frame drops.
- Audio glitches caused by performance problems.
- Unbounded memory or CPU growth.

### High

- Significant GPU overdraw.
- Excessive draw calls.
- Large avoidable bundles.
- Expensive work repeated every frame.
- Heavy assets blocking initial interaction.

### Medium

- Redundant calculations.
- Missed caching opportunities.
- Unnecessary rerenders.
- Avoidable background work.

### Low

- Minor allocation reductions.
- Small bundle savings.
- Micro-optimizations without measurable user impact.

Prioritize by user impact, confidence, implementation risk, and expected improvement.

## Safe optimization procedure

For each proposed change:

1. Explain the problem.
2. Record the evidence.
3. Describe the intended optimization.
4. Identify possible visual or functional regressions.
5. Make the smallest reasonable change.
6. Run relevant tests.
7. Re-measure when possible.
8. Compare before and after.
9. Revert or reconsider if the change does not help.

Do not bundle unrelated optimizations into one large rewrite.

For high-risk changes, provide a recommendation before modifying the implementation.

## Dead code removal

Remove code only after verifying that it is not required.

Check for:

- Dynamic imports.
- Runtime registration.
- Framework conventions.
- Asset references.
- Feature flags.
- Development tools.
- Public APIs.
- Tests.
- Build-time generation.

Prefer targeted removal over broad automated deletion.

Do not remove functionality simply because it is not active in the current view.

## Performance budgets

Use existing project budgets if available.

If none exist, propose budgets rather than assuming universal thresholds.

Evaluate:

- Desktop frame-time targets.
- Mobile frame-time targets.
- Frame-time consistency.
- Initial loading cost.
- Bundle size.
- Decoded audio memory.
- GPU memory.
- Active shader complexity.
- Navigation latency.

Treat a 60 FPS target as approximately 16.7 ms per complete frame, not as a budget entirely available to the shader.

Include headroom for browser work, audio coordination, interaction, and other application tasks.

## Reporting format

After an audit, provide a concise report with:

### Executive summary

Overall assessment and the most important risks.

### Findings

For each finding:

- Severity.
- Location.
- Evidence.
- Root cause or hypothesis.
- Expected impact.
- Recommended fix.
- Regression risk.

### Implemented improvements

Explain what changed and why.

### Measurements

Include before-and-after measurements when available.

If no profiling was performed, state that clearly.

### Remaining opportunities

Identify improvements worth considering later.

### Validation

Describe tests performed and any unverified areas.

## Orchestra Atlas visual constraints

Never compromise the following without explicit approval:

- Node constellation layout.
- Instrument family colors.
- Cinematic transitions.
- Smooth navigation.
- Audio-visual synchronization.
- Orb silhouette quality.
- Liquid-light visual character.
- Cloud fade behavior.
- Instrument inspector interactions.
- Accessibility and reduced-motion behavior.

Performance optimization should preserve the artistic intent.

If a visually important effect is too expensive, investigate adaptive quality before removing it.

Potential adaptive strategies include:

- Lower procedural detail on small nodes.
- Reduced effect complexity on low-end devices.
- Lower-resolution intermediate effects.
- Reduced offscreen animation work.
- Capped device pixel ratio.
- Simplified post-processing.
- On-demand resource loading.

Make such changes measurable and visually defensible.

## Final rule

Be a performance engineer, not an indiscriminate code optimizer.

The objective is not the smallest codebase or the fewest operations at any cost.

The objective is a smooth, memory-safe, responsive, maintainable audiovisual experience that preserves Orchestra Atlas's visual identity.