# Orchestra Atlas — project-wide performance reconnaissance

Date: 2026-10-29. Baseline: `main`, merge commit `179fa24`.

Audit only: no application code, assets, dependencies, production settings, or project configuration were changed. The previously modified performance skill was left intact. This report is the only repository addition from this audit. Builds and temporary measurement scripts generated disposable local artifacts.

The `orchestra-performance-auditor` skill guided this staged reconnaissance. This is a repository-wide inventory and prioritization exercise, with focused checks of selected risks; it is not a completed device performance certification.

## 1. Architectural performance overview

The architecture already separates semantic navigation/playback state from rendering internals. Several earlier optimizations are substantive: instancing, stable attribute buffers, cached bloom, an inactive contextual map, bounded audio loading, model resource reuse, staged uploads, incremental occlusion checks, and renderer disposal. Preserve these while investigating the remaining costs.

| Subsystem | Architecture and safeguards | Inspection coverage |
|---|---|---|
| React and state | React 19, Zustand selectors, imperative scene/overlay updates; playback publishes its clock at most every 80 ms. Most of the map does not subscribe to playback position. | Static review of stores, entry points, map/explorer effects, media components and typography; production commit counts with diagnostics enabled. No React DevTools duration profile. |
| Orchestra map | Dynamically imported `OrchestraScene`; per-section instanced billboards, separate emission/disc layers, cached bloom, three ghost instances per seat. Configured 30 FPS, DPR ≤1.5, ≤3 million drawing pixels; adaptive quality. | Source/shader review, focused regression tests, software WebGL instrumentation, orchestra/family/instrument navigation. |
| Instrument inspector | Lazy model component, on-demand rendering, incremental marker raycasts, staged texture initialization and async compilation; shared two-entry decoded model cache. | Static review, lifecycle tests, production Cello → Horn → Cello browser sequence under reduced motion. Other models inventoried, not rendered. |
| Motion, SVG and styles | Owned GSAP navigation/focus timelines; conditional parallax ticker; CSS animations and a small SVG constellation copy. Tailwind 4 plus authored CSS; no Sass source pipeline found. | Static lifecycle/style review and limited browser layout/task counters. No isolated paint/compositor trace. |
| Listening | One AudioContext and shared timeline; 15-second decoded chunks, four concurrent fetch/decode slots, 24 MiB background PCM cache allowance excluding protected chunks. Precomputed activity; no live FFT/analyser loop. | Source review, tests, live playback diagnostics, mocked scheduler cancellation test, browser callback-suppression experiment. No physical audio or iOS listening test. |
| Media and R2 | Model/media URLs centralized; responsive artwork and video variants; on-demand technique audio and performance embeds. | Local asset inventory, GLB metadata/image hashes, representative live R2 headers and production loading requests. No account analytics or storage configuration changes. |
| Build and dependencies | Vite 8; five JavaScript output chunks, React/GSAP/Three/Zustand production dependencies. Development review routes are gated by `import.meta.env.DEV`. | Actual production build, output import/string inspection, dependency listing. No precise per-module emitted-byte attribution. |
| Analysis and tools | Browser analysis worker, temporary decode contexts, offline profiling/encoding scripts, development orb preview and standalone inspector example. | Static review and audio-review unit tests. Worker/browser review UI and standalone example were not profiled in this run. |

Relevant contracts were read before evaluation: [vision](vision.md), [architecture](architecture.md), [documentation map](README.md), [map specification](../specs/orchestra-map.md), [listening specification](../specs/listening.md), [inspector specification](../specs/model-inspector.md), [spatial layout specification](../specs/spatial-layout.md), and supporting styling, listening, asset and orb notes. Some historical documentation still describes earlier branches or activity profiles; current code and observed delivery were checked explicitly.

## 2. Existing measurements and their limitations

### Checks performed

| Check | Result |
|---|---|
| `npm run build` | Passed TypeScript and production build; 221 transformed modules; Vite reported 1.45 s for its build stage. This is not runtime performance. |
| `npm run lint` | Completed with seven existing warnings: ref reads during render, state updates in effects, and missing effect dependencies. These are review prompts, not proof of expensive rendering. |
| `npm test` | Failed at `tests/activity-profile.mjs:113`: missing `chunks.stems.full_orchestra`, expected 30 flags. Earlier tests ran; later tests were not reached. |
| `npm run test:map` | Passed stable-buffer, disposal, bloom cache, layer/state, response and compaction checks. |
| `npm run test:audio-review` | Passed measurement, onset, review-player timing and cleanup tests. |
| `npm run test:spatial` | Passed model cache/session/preparation, spatial layout, envelope and framing tests. |

The map/spatial test runners initially reported a sandbox WebSocket restriction. They were rerun with local socket access and passed without that restriction. Unit tests using mocked renderers do not measure GPU speed or prove browser resource residency.

### Browser evidence

One temporary Chrome session was used with the production preview, then closed along with the preview server. Its renderer identified itself as **ANGLE / SwiftShader**, a software renderer. Desktop sampling used 1280×800 at DPR 1. Inspector lifecycle checks used 390×844, reduced motion, and the existing `forceQuality=2` override. The latter is a lifecycle check, not a default mobile performance benchmark.

The preview origin `http://127.0.0.1:4175` was rejected by R2 CORS for the profile/manifest requests (`MissingAllowOriginHeader`). Subsequent browser measurements added allow-origin/timing headers through temporary DevTools response interception. Neither R2 nor project configuration changed. This makes local production interaction testable, but does not establish that the deployed website's origin is misconfigured. Development has its own proxy at [vite.config.ts:13](../vite.config.ts#L13).

Observed evidence:

- Both the 5,667,894-byte activity JSON and the compressed visual profile were requested on initial production load. This is independent of shader performance.
- With normal motion on the software renderer, requested three-second sample windows had rAF p95 values of approximately **567–1,000 ms** across playing map scopes. A paused-root sample had p95 **583 ms**. Main-thread `TaskDuration` deltas were approximately **29–71 ms** in those windows, excluding work in GPU/other processes. These numbers demonstrate the limitations of this environment; they are not physical GPU results and do not identify a particular shader as the cause.
- The inspected normal-motion desktop run had one initial long task of **553 ms** and first contentful paint at **912 ms**. There is no cold/warm distribution, network throttling, or attribution trace; do not treat this as a loading budget or attribute the task to JSON parsing alone.
- A two-second reduced-motion, paused mobile check submitted **zero WebGL draws**. It still observed **121 rAF callbacks** in the measurement loop and eight React commits. Diagnostics were updating at 4 Hz, accounting for those commits; the rAF count is the measurement clock, not a count of application callbacks.
- Live scheduler diagnostics showed approximately **25.2–50.5 MiB** of cached PCM during the desktop playback/navigation sequence. The UI labels this “MB” but divides by 1,048,576. The 24 MiB allowance explicitly excludes protected chunks, so exceeding 24 MiB is not by itself a cache bug.
- Cello → Horn → Cello returned to **one live map WebGL context** after each inspector exit. Each departing inspector's context was lost. The second Cello entry reused its decoded model without another GLB request.
- Forced-GC JavaScript heap snapshots after those three returns were about **53.26, 53.93 and 54.25 MB** (decimal). This small sequence does not prove either a leak or a stable long-term plateau. Instrumentation itself retained context references, and JS heap does not cover most image, GPU or audio storage. Aggregate create/delete call counts also cannot account for resources implicitly freed by context loss.

A short CPU sample was mostly idle and too sparse/minified to rank application functions reliably. No GPU timer queries, retained-object heap analysis, battery measurements, low-end hardware tests, Safari tests, or broad 60-active-node device benchmark were completed. Existing notes about historical 100–270 MB model residency are useful context, not new measurements from this run.

## 3. Critical and high-priority findings

No unbounded production memory leak, device crash, or severe frame-drop rate on physical hardware was established. The strongest findings below concern reproducible loading/scheduling behavior and directly measured payloads.

### H1 — Cancellation can consume audio loading slots permanently

**High; confirmed with a controlled test of the real scheduler and mocked I/O.**

At [chunk-scheduler.ts:245](../src/features/listening/chunk-scheduler.ts#L245), `acquireSlot()` increments `activeLoads`. If the key becomes obsolete before the `await` continuation, line 246 returns before entering the `try/finally` that calls `releaseSlot()` at line 275. A granted slot is then never returned.

A temporary test attached the scheduler to a mock context, used a valid manifest, and issued a paused focus request immediately followed by an empty paused plan, four times. A fresh control completed its subsequent load and made one audio fetch. After four cancellation races, the subsequent request stayed pending after 250 ms and made **zero audio fetches**. The code path explains why it cannot drain: all four slots are occupied without active fetches to release them. This did not reproduce as a visible user failure during normal browser navigation.

**Impact:** a cancellation interleaving can leave Play/seek/focus waiting indefinitely. **Smallest candidate fix:** balance every granted slot on every return path; separately verify disposal/reconnection accounting. **Validation:** deterministic cancellation/slot-reuse regression, aborted fetch/decode variants, rapid seek/navigation during real playback. Avoid changing mix or fade behavior.

### H2 — Startup still fetches the full uncompressed analysis profile

**High; confirmed by production requests and live headers.**

[excerpt.ts:45](../src/features/listening/excerpt.ts#L45) points the gain engine to `beethoven-7th-2nd.json`. [listening-engine.ts:486](../src/features/listening/listening-engine.ts#L486) fetches and parses it, then waits for it before preparing the initial bed chunk at line 505. Meanwhile [OrchestraMap.tsx:195](../src/features/orchestra-map/components/OrchestraMap.tsx#L195) independently fetches the compact visual profile.

Live responses with `Accept-Encoding: br, gzip`:

| Profile | Transferred body | Decoded JSON size | Encoding |
|---|---:|---:|---|
| Gain/analysis `.json` | 5,667,894 B | 5,667,894 B | None |
| Visual `.runtime.json` | 186,217 B | 1,174,082 B | Brotli |

The compact visual delivery works, but it has not eliminated the dominant startup profile transfer. At a hypothetical 10 Mbit/s, 5.67 MB alone needs about 4.5 seconds of payload transfer; this is a calculation, not an observed mobile loading time.

**Candidate:** define and validate a compact gain/runtime representation, then compress/version its delivery while retaining the detailed analysis source offline. Do not blindly substitute the current visual file: gain calculation reads `instrumentsShared` in [listening-engine.ts:136](../src/features/listening/listening-engine.ts#L136), whereas the visual compactor deliberately omits that data. Measure JSON parse/retained memory and cold-start improvement; regression-test gain curves and chunk masks.

Development reads the legacy gain file while production reads the revised main file ([excerpt.ts:47](../src/features/listening/excerpt.ts#L47)). The live revised profile also lacks `full_orchestra` mask flags. [activity-profile.ts:56](../src/features/listening/activity-profile.ts#L56) safely loads unknown chunks, but local tests do not currently validate a fully matching production asset set.

### H3 — Texture-heavy models and a count-based cache can consume hundreds of MiB

**High; asset structure confirmed, actual residency/device failure remains unmeasured.**

Model paths and source hashes are recorded at [bassoon.json:5](../public/licenses/instrument-pack/bassoon.json#L5), [trombone.json:5](../public/licenses/instrument-pack/trombone.json#L5), [tuba.json:5](../public/licenses/instrument-pack/tuba.json#L5), and [cello.json:5](../public/licenses/instrument-pack/cello.json#L5). The local staged files matched their recorded SHA-256 values. R2 HEAD sizes matched the bassoon and trombone local byte counts; their remote bodies were not rehashed.

| Model | GLB bytes | Embedded 1024² images | Byte-distinct images | RGBA image-size equivalent |
|---|---:|---:|---:|---:|
| Bassoon | 19,458,352 | 67 | 38 | 268 MiB |
| Trombone | 21,204,448 | 58 | 58 | 232 MiB |
| Tuba | 14,801,744 | 45 | 28 | 180 MiB |
| Cello | 11,686,940 | 30 | 30 | 120 MiB |

The last column is `width × height × 4`, not measured memory. It excludes geometry, file buffers, GPU copies, mipmaps and render targets; actual browser storage varies. Bassoon plus trombone alone represent **500 MiB** of such image data. Bassoon has 29 redundant embedded image payloads by hash; tuba has 17. Texture objects can also outnumber source images, so image count is not an exact GPU allocation count.

[model-resource.ts:17](../src/lib/model-inspector/model-resource.ts#L17) bounds the cache to two models, which prevents unbounded collection growth but does not provide a byte budget. Each retained scene promise keeps decoded resources; navigating away deliberately retains them for reuse.

**Candidate:** first profile the largest models and establish CPU/GPU budgets, then evaluate shared image deduplication, packed maps, texture compression and a byte-aware cache. Compare metallic/wooden material quality and anatomy visibility. Preserve rights/provenance and obtain approval before replacing production assets; this audit made no asset changes. Reducing polygons is not the first answer for texture-heavy bassoon, whose inventoried geometry is only about 8,200 triangles.

### H4 — Chunk scheduling depends on animation frames continuing

**High; dependency confirmed by browser experiment; real background-tab behavior needs device validation.**

[listening-engine.ts:251](../src/features/listening/listening-engine.ts#L251) prepares/schedules future audio from a `requestAnimationFrame` tick. [chunk-scheduler.ts:397](../src/features/listening/chunk-scheduler.ts#L397) schedules only the current and next chunk. Web Audio time continues independently.

In the production browser, the bed was playing at time **0.367 s**, with chunks `[0,1]` scheduled. Animation-frame callbacks were then suppressed for 31.5 seconds using a temporary page override. Diagnostics advanced to **31.865 s**, chunk **2**, while scheduled/loaded chunks remained `[0,1]`. The scheduled window had expired without a replacement. The override was restored and playback paused afterward. This was not a listening test or a real hidden-tab experiment; the resulting gap follows from the expired source window.

**Candidate:** give audio scheduling a rendering-independent, bounded lookahead policy. First decide/test the intended background playback behavior. Merely increasing render FPS does not address this dependency. Validate real backgrounding, screen lock, long main-thread stalls, chunk joins, seeks, and resumption on desktop and iOS before choosing a scheduler mechanism.

### H5 — Full-screen HDR/MSAA/postprocessing remains an important GPU risk

**Potentially high; confirmed render structure, suspected device bottleneck.**

[OrchestraScene.ts:288](../src/features/orchestra-map/three/OrchestraScene.ts#L288) constructs two composer HDR targets plus a separate bloom-source target and a bloom mip chain. [OrchestraScene.ts:716](../src/features/orchestra-map/three/OrchestraScene.ts#L716) applies up to 4× MSAA to both composer targets, with a three-million-pixel cap from [config.ts:224](../src/features/orchestra-map/config.ts#L224). Two resolved RGBA16F color textures alone are about **45.8 MiB** at that cap; multisample color/depth storage, other attachments and bloom add considerably more. This is attachment arithmetic, not measured VRAM.

During playback, changing `orbLight` invalidates bloom ([OrchestraScene.ts:1806](../src/features/orchestra-map/three/OrchestraScene.ts#L1806)), so cached blur chiefly benefits unchanged emission, not continuously changing activity. Foreground selection introduces additional populated layer draws. Ghost movement also keeps composing fresh frames even when the blurred emission can be reused.

The current filled shader is simpler than the legacy strand effect: `PROTOTYPE_FILLED` excludes the procedural strand branch at compilation ([shader.ts:109](../src/features/liquid-orb/shader.ts#L109)). Do not blame unused strand loops for current map GPU cost.

**Candidate:** profile physical devices before changing quality. Measure render-target residency, MSAA resolve cost, bloom cache hit rate, fragment overdraw and GPU time across overview/close-up/playback. Then evaluate target resolution/attachments or adaptive tiers in small visual comparisons. Preserve the eclipse rim, neighboring-node compositing and highlighted-node stacking.

## 4. Suspected memory leaks and lifecycle risks

These are investigation targets, not confirmed unbounded production leaks:

| Risk | Evidence and exact ownership boundary | Verification needed |
|---|---|---|
| Pending engine load outlives disposal | [listening-engine.ts:444](../src/features/listening/listening-engine.ts#L444) has async profile/manifest/chunk awaits without a load-generation/disposed guard; `dispose()` at line 586 invalidates commands but does not cancel that initial load. A late load can republish state after disposal. | Deferred-fetch dispose/reconnect tests; HMR teardown test; inspect retained graph/state, not just clock behavior. |
| Cancelled models still fetch/decode | [model-resource.ts:26](../src/lib/model-inspector/model-resource.ts#L26) fetches without cancellation; [model-session.ts:55](../src/lib/model-inspector/model-session.ts#L55) rejects stale attachment only after instantiation. Cached shared work is intentional, but rapid cancellations can finish expensive unused decodes. | Rapidly request/cancel three large models under throttling; measure peak memory and duplicate work. Account for useful cache reuse before adding aborts. |
| Cache eviction has no explicit bitmap reclamation path | [model-resource.ts:32](../src/lib/model-inspector/model-resource.ts#L32) forgets entries; [gpu-resources.ts:12](../src/lib/model-inspector/gpu-resources.ts#L12) disposes GPU resources on detach. CPU images remain until references/GC release them. | Retained paths and native/image memory after two/three-model cycles. Do not close shared bitmaps while an instance or cache entry still uses them. |
| Audio diagnostics undercount total audio residency | [chunk-scheduler.ts:470](../src/features/listening/chunk-scheduler.ts#L470) totals only the buffer map. Scheduled sources can retain evicted buffers; active decodes and protected chunks add memory. `stopSources()` at line 408 stops nodes but does not explicitly disconnect them. | Count buffers referenced by sources and pending work, including rapid interrupted fades; determine when the browser releases stopped/ended nodes. Current stem/source sets are finite, so absence of explicit disconnect alone is not proof of a leak. |
| Main map context and partial construction failures | [OrchestraScene.ts:434](../src/features/orchestra-map/three/OrchestraScene.ts#L434) disposes renderer/resources but does not force context loss as the inspector does. [OrchestraMap.tsx:630](../src/features/orchestra-map/components/OrchestraMap.tsx#L630) cannot dispose a scene constructor that throws before returning. | Repeated root mounts and initialization/context-loss fault injection. Normal production owns one map for the page lifetime; the tested inspector contexts were released. |

Positive lifecycle evidence: map observers/listeners and animation frames are removed during disposal; inspector cleanup is extensive ([InstrumentModel.tsx:628](../src/features/instrument-explorer/viewer/InstrumentModel.tsx#L628)); preparation checks cancellation between uploads; GSAP timelines/tickers have cleanup ([SpatialTypography.tsx:260](../src/features/instrument-explorer/typography/SpatialTypography.tsx#L260)); performance iframes mount only while open ([PerformanceStage.tsx:199](../src/features/instrument-explorer/demonstration/PerformanceStage.tsx#L199)); node audio clears its source/listeners on stop ([node-audio.ts:35](../src/features/instrument-explorer/viewer/node-audio.ts#L35)).

## 5. Asset delivery and bundle-size findings

### R2 and media

Representative live HEAD responses advertised `Accept-Ranges: bytes` and appropriate JSON/audio/video/image types. The compact runtime profile returned `Content-Encoding: br`. GLBs returned `application/octet-stream`, which the current ArrayBuffer loader accepts; `model/gltf-binary` would be more descriptive, not a measured speed improvement.

The sampled responses had ETags and Last-Modified but no explicit Cache-Control, Age, CF-Cache-Status, or Vary. Therefore edge-cache hits and an intentional freshness policy were **not demonstrated**. This does not prove that browser heuristic caching or any other cache is absent. Asset URLs use a `pub-…r2.dev` host through [media-url.ts:5](../src/lib/media-url.ts#L5). Verify the deployed origin's CORS and edge delivery before recommending custom-domain/cache changes. Immutable caching should follow asset versioning; current URLs are replaced in place.

Observed representative body sizes: production atmosphere WebM **3,025,712 B**, lightweight **1,450,822 B**, full-orchestra first audio chunk **183,626 B**, strings artwork **781,776 B**, and its selected small variant **258,548 B**. Video range responses were observed; repeat partial requests are not automatically duplicate full downloads. Native media preload/autoplay behavior remains browser dependent.

The atmosphere waits for playback readiness before full preloading, chooses a smaller source on narrow viewports, and omits sources under reduced motion ([AtmosphereBackdrop.tsx:55](../src/features/orchestra-map/components/AtmosphereBackdrop.tsx#L55)). Artwork has `srcset`, async decode and orientation selection ([OrchestraMap.tsx:69](../src/features/orchestra-map/components/OrchestraMap.tsx#L69)). Technique audio uses M4A and loads on user action ([technique.ts:94](../src/features/instrument-explorer/content/technique.ts#L94)); local WAV masters are not the production playback path. These are existing strengths.

The one identity font is a **22,876 B** Latin WOFF2 using `font-display: swap` ([global.css:13](../src/styles/global.css#L13)); font delivery is not a leading concern in this inventory.

### Production output

Vite-reported decimal sizes:

| Output | Raw kB | Gzip kB |
|---|---:|---:|
| Application entry | 405.06 | 120.39 |
| Three core shared chunk | 306.09 | 90.69 |
| Renderer/OrbitControls shared chunk | 373.87 | 89.62 |
| OrchestraScene | 103.13 | 31.47 |
| InstrumentModel | 98.05 | 32.80 |
| Stylesheet | 68.21 | 14.34 |

The entry statically imports Three core. Before the functional map appears, the first four JavaScript chunks total about **1,188 kB raw / 332 kB gzip**; the inspector is an additional deferred chunk. Splitting exists, but Three core is still on the initial dependency path. Relevant boundaries: [App.tsx:2](../src/app/App.tsx#L2), [OrchestraMap.tsx:583](../src/features/orchestra-map/components/OrchestraMap.tsx#L583), [InstrumentExplore.tsx:27](../src/features/instrument-explorer/InstrumentExplore.tsx#L27), and the spatial-layout/typography imports. A module attribution build is needed before promising a particular shell-size saving.

Development inspector controls remain in the production inspector chunk: the built output contains “Copy lighting”, “Lighting controls” and “Hotspot” editor strings. [InstrumentModel.tsx:13](../src/features/instrument-explorer/viewer/InstrumentModel.tsx#L13) statically imports the debug panel; its hook-derived false debug flag prevents use but does not remove all bundled code. This is a **medium-priority confirmed delivery opportunity**, with no isolated byte saving measured. Development activity-review/orb/style routes themselves were excluded from this production build.

`npm ls --depth=0` also listed installed extraneous `lucide-react`, `tslib` and sharp/WASM-related packages. Installed-but-extraneous is not evidence they reach the browser; no removal is proposed without tracing actual consumers.

The local `dist/` tree contained **296,133,443 B across 118 files**, largely because Vite copies local ignored `public/` media, including staging models, analysis reports and masters. [.gitignore:14](../.gitignore#L14) excludes those media collections from Git; a Git-based deployment may have a much smaller public tree. This is a **local build/deployment artifact risk**, not a 296 MB initial page download. Audit the actual deploy artifact before changing `publicDir` or removing source assets.

## 6. Cross-system performance concerns

1. **The combined memory budget matters most.** Two large decoded models, an active inspector, map HDR targets, audio buffers, native video and browser compositing can overlap. Independent count/pixel/cache caps do not constitute a whole-tab budget. Confirm combined residency on lower-memory devices.
2. **Visual cadence must not own audio continuity.** H4 is reproducible even with a cheap/static scene; under load, pending per-frame `prepare().then(...)` continuations also repeat while a decode is awaited ([listening-engine.ts:267](../src/features/listening/listening-engine.ts#L267)). Shared in-flight work prevents duplicate fetches, but does not eliminate repeated continuations. Measure before treating those allocations as a bottleneck.
3. **Map and inspector overlap during preparation/transition.** The map intentionally remains alive until the handoff settles ([OrchestraMap.tsx:523](../src/features/orchestra-map/components/OrchestraMap.tsx#L523)), then becomes static. A heavy model's decode, texture upload and environment preparation compete with the loading-wave map and audio. Test cancellation and peak load here, not only settled views.
4. **Some background UI work is unconditional.** [PlaybackControls.tsx:44](../src/features/listening/PlaybackControls.tsx#L44) keeps a pulse-bar rAF loop while paused/reduced-motion, writing stable scale values. Inspector idle sway has its own rAF plus stage invalidation ([idle-orbit.ts:37](../src/features/instrument-explorer/scene/idle-orbit.ts#L37)). These are medium/low opportunities; no significant CPU bottleneck was established.
5. **Layout work is concentrated around transitions.** Map caption reads are mostly grouped, but the conductor callback writes styles then reads bounding boxes ([OrchestraMap.tsx:610](../src/features/orchestra-map/components/OrchestraMap.tsx#L610)); overlay placement can read after caption writes ([OrchestraScene.ts:1922](../src/features/orchestra-map/three/OrchestraScene.ts#L1922)). Inspector overlay writing also happens from both render and visibility tasks ([InstrumentModel.tsx:227](../src/features/instrument-explorer/viewer/InstrumentModel.tsx#L227)). Trace rapid navigation/orbit for forced layout before restructuring these paths.
6. **Paint/compositing remains a separate cost.** Large caption masks/blending, text effects, parallax, video and transparent canvas layers can be expensive without high JavaScript CPU time. [orchestra-map.css:286](../src/features/orchestra-map/orchestra-map.css#L286), [instrument-explore.css:71](../src/features/instrument-explorer/instrument-explore.css#L71), and the SVG miniature's grouped Gaussian blur ([ConstellationMiniature.tsx:27](../src/features/orchestra-map/components/ConstellationMiniature.tsx#L27)) deserve a paint trace, not an assumption that all transforms are free.

No runtime evidence justifies wholesale React memoization, replacing GSAP, introducing another state library, or deleting the legacy node renderer. The legacy path still supports fallback/configuration and conductor/seed behavior. Compatibility re-exports around the shared inspector are not duplicate active renderers.

## 7. Recommended focused audits, ranked by expected impact

| Rank | Focused audit | Why next | Evidence to collect |
|---:|---|---|---|
| 1 | Audio cancellation and scheduling ownership | Reproduced slot exhaustion and expired scheduling window can prevent or interrupt the main musical experience. | Deterministic race/dispose tests; real background-tab/lock tests; source schedule timelines; audible chunk joins and rapid navigation. |
| 2 | Startup activity data and delivery | A confirmed 5.67 MB uncompressed request gates initial preparation despite a compact visual file. | Production/local schema parity, response bytes, parse time, retained arrays, throttled cold/warm launch and first-Play latency. |
| 3 | Model textures and whole-tab memory | Largest confirmed structural memory burden; two-cache-entry cap permits hundreds of MiB of image data. | Bassoon/trombone/tuba native/GPU memory, texture identity, CPU cache bytes, cancellation peaks, ten-cycle post-GC retained paths. |
| 4 | Physical-device map GPU/postprocessing | Likely largest rendering risk, but software measurements cannot identify the real device bottleneck. | GPU frame time, target dimensions/formats/samples, per-pass draws, cache hits and overdraw; orchestra/tutti/selected/hover at several DPRs. |
| 5 | Transition/layout/paint interaction | Model preparation, two canvases, labels, GSAP and audio overlap at a critical interaction. | Main-thread traces, long tasks, layout/paint/compositor cost during rapid navigation, resize, orbit, focus and media-panel transitions. |
| 6 | Bundle boundaries and deploy artifacts | Measured entry dependency path and bundled dev controls; public media copying depends on environment. | Per-module output attribution, actual deployment file inventory, cold module loading on mobile, preview versus deployed CDN headers. |

## 8. Proposed optimization and validation sequence

Keep each implementation batch independently reviewable; no fixes were applied in this audit.

1. **Establish reliable fixtures and budgets.** Resolve the asset/test mismatch without synthesizing unsupported audio data. Record immutable asset hashes and production headers. Agree on desktop/mobile frame, first-interaction, decoded PCM, model and total-tab memory budgets; these are not yet established by this report.
2. **Fix scheduler slot accounting in isolation.** Add the demonstrated cancellation test, cover dispose/reconnect, and verify normal selection/fade behavior. Then address background scheduling in a separate batch, with explicit background playback policy and physical browser listening tests.
3. **Reduce runtime activity delivery.** Produce an appropriate compact gain representation preserving shared envelopes/masks, keep analysis files as sources, validate parity, then arrange compression/versioned delivery with approval. Compare cold/warm loading, payload, parse cost and playback behavior.
4. **Audit and optimize one heavy model first.** Start with bassoon texture duplication; compare candidate exports off the production path. Measure transfer, decode, uploads and native/GPU memory, then decide a cache byte budget. Visually validate materials, silhouette, close-up anatomy and attribution before any asset replacement.
5. **Tune GPU costs from device evidence.** Capture a reproducible physical baseline before adjusting target resolutions, MSAA, blur cadence or adaptive quality. Compare small screens/high DPR, full activity, hover, selected rims/halos, foreground overlap, reduced motion and contextual-map transitions.
6. **Trim confirmed noncritical delivery/background work.** Review production debug controls, initial shared imports, paused pulse-bar work and any trace-confirmed layout duplication individually. Rebuild and remeasure; preserve lazy-loading responsiveness and semantic UI.
7. **Integration regression pass.** Exercise orchestra → family → instrument → inspector → technique audio/performance → return; rapid cancellation, seeking, pause/resume, chunk boundaries, background/foreground, resize/orientation, reduced motion, keyboard and touch. Compare ten or more stabilized navigation cycles with intentional caches warm; inspect retained objects, context counts and native memory rather than inferring leaks from temporary peaks.

Remaining limitations: no physical mobile/desktop GPU or iOS profiling, no audible quality assessment, no deployed-origin CORS validation, no Cloudflare cache analytics, no complete native/GPU heap accounting, no long-duration lifecycle plateau test, and no before/after optimization comparison. These remain follow-up work, not implied passes.

## Implementation follow-up — 2026-10-29

At the user's subsequent request, H1 (loading-slot accounting), H4 (render-dependent scheduling), and H2 (startup profile transfer) were addressed. Model optimization remains deferred. The findings above describe the original audit baseline.

- Every granted loading slot now reaches cleanup, and scheduler generations isolate obsolete manifest/decode results. Initial engine loading is idempotent and cannot revive a disposed engine.
- One 25 ms audio timer maintains the existing AudioContext-based current/next chunk window, with one pending preparation continuation per command. Pause/end/dispose stop it. The late-start counter now counts actual new source starts rather than polls of existing sources.
- The engine uses a new lossless gain runtime, preserving original 10 ms samples and both envelope scales. Its Brotli object was added to R2 and verified by decoded SHA-256; detailed analysis and models were not overwritten. Combined gain/visual payload drops from 5,854,111 to 1,006,441 bytes (about 83%).

Validation: production build, focused listening-runtime/map/audio-review tests passed; lint retains its seven existing warnings. The full suite still stops on the original missing `full_orchestra` chunk-mask assertion. The production browser check fetched the new gain object without requesting the detailed source. After 31.5 seconds with animation frames suppressed, transport reached 31.569 s and chunks `[1,2,3]` were scheduled, with zero reported late starts. Pausing removed the audio timer. The browser used reduced motion/SwiftShader and a temporary local CORS response override; physical backgrounding and audible validation remain outstanding. The browser and preview server were closed after verification.
