# alphaTab worker / window / playhead evaluation

**2026-09-23 · alphaTab 1.8.4 · `/?score-poc`**

The runtime substantially reduces main-thread score computation. **Arbitrary bounded windows are not yet reliable:** alphaTab throws on some slurs/effects crossing window boundaries. This remains an evaluation, not a production recommendation. The [previous full-score POC report](score-poc.md) is retained as the baseline.

## Implementation and ownership

Changed `ScorePoc.tsx`, `score-adapter.ts`, and `score-poc.css`; added `score-runtime.worker.ts`, `score-protocol.ts`, `score-window.ts`, `score-playhead.ts`, `score-requests.ts`, and `tests/score-runtime.mjs`. `test:score` now includes the new tests. Vite's worker format is ES modules so the worker dynamically imports alphaTab. No new dependency.

The canonical navigation store now drives every score scope, including the three test buttons. No manual selection store remains. The canonical playback store supplies position/epoch; score measure clicks and the slider call its `seek`. Production stores, Listening, map, catalog, audio/activity assets, and MusicXML are unchanged.

### Worker topology and the built-in API limitation

One native module worker retains the full 19-part / 278-measure model and MIDI timing lookup. It uses alphaTab's **documented low-level** `ScoreLoader` and `ScoreRenderer`, the same rendering engine used by alphaTab's built-in worker. Main-thread messages contain scope part IDs, measure range, width, and generation. Replies contain only bounded SVG fragments, anchors, hit regions, and diagnostics—never the whole model.

**This requires additional worker glue, rather than just enabling the high-level API's `core.useWorkers`.** Installed-source inspection showed that `AlphaTabApi.load` imports the model on the main thread, and `AlphaTabWorkerScoreRenderer.renderScore` serializes that full model there before sending it to its worker. Its messages also lack request IDs. Using the public low-level APIs in a worker removes those main-thread stages and permits atomic, generation-checked commits without depending on alphaTab's private message protocol. The `useWorkers` setting alone is not evidence of off-thread work; the dedicated host is what establishes it here.

alphaTab's module installs its own message listeners, so coordinator messages carry an `atlasScore.*` command namespace for those listeners to ignore. Text metrics use an OffscreenCanvas through the public canvas `measureText` API; the stock low-level worker fallback otherwise uses approximate character widths. SVG glyphs use the existing Bravura font. There is **no alphaTab player, synthesizer instance, audio output, or independent clock**. MIDI generation is data-only, once at startup, for timing metadata.

### Window and request policy

- Orchestra: 2 behind + current + 3 ahead = **6 measures**.
- Families, including Strings: 2 + current + 5 = **8 measures**.
- Instruments, including Cello: 2 + current + 9 = **12 measures**.
- Windows shift at the penultimate measure, preserving overlap. Cello playback advances 1–12 → 9–20 → 17–28, rather than rebuilding at every bar.
- `display.startBar` and `barCount` bound actual engraving. Lazy fragment generation is disabled **inside that small window** so it is complete before presentation. Returned geometry is checked for out-of-window bars. There is no full-score offscreen render or CSS clipping workaround.
- One request executes; only the latest queued request survives. Navigation/seek/resize invalidate generations immediately. Both response handling and the later presentation frame recheck relevance.
- Scope dispatch waits 80ms to yield to map input; width changes debounce for 180ms. Seeks update transport immediately and request the destination directly. Worker rendering is not cancellable mid-call; correctness relies on rejection, not cancellation.
- The old valid sheet stays visible until detached SVG is ready for a single DOM replacement. If target geometry is absent, the playhead hides temporarily. Failures retain the prior sheet and appear in a bounded diagnostic history. Fatal worker failures terminate it without changing canonical stores.

### Playhead

The worker extracts beat/rest `onNotesX` positions across visible staves, median-merges simultaneous anchors, and adds measure-end anchors for sustained/resting spans. Times come from alphaTab's tick lookup integrated through its tempo changes. The main-thread animation loop reads **only the current store position**, binary-searches anchors, interpolates within a system, and writes a `translate3d` transform. At a system boundary it moves to the new system rather than interpolating diagonally.

There is no time extrapolation, React update, layout read, engraving, or worker message in the per-frame projection. Height/scroll changes happen at system/window transitions or horizontal viewport exits; scrolling is instant and there are no fades. Diagnostics refresh once per second. Smoothness is bounded by the existing logical-position update cadence and actual frame rate. Repeated traversal is explicitly rejected for this fixture-only resolver rather than silently mapped incorrectly. The original zero-offset timing finding remains applicable; no duration stretching was added.

## Measured evidence

Production preview, **Headless Chrome 153, macOS x86_64, SwiftShader software WebGL**, local assets, no throttling. Desktop 1440×857; emulated portrait 320×568 and landscape 844×390. These are individual runs, not statistical or physical-device benchmarks.

### Thread placement verified

Chrome trace user-timing events identified renderer main thread **3327984** and dedicated worker **3468259** in process 4247:

| Stage | Execution evidence |
|---|---|
| XML parse + model construction | `score-worker-parse-model`, worker thread; 459.15ms in traced desktop run |
| Full timing lookup + renderer setup | `score-worker-timing-setup`, same worker; 73.14ms |
| Layout, engraving, SVG string generation | `score-worker-1`, same worker; 68.65ms combined |
| Window anchor / hit-region extraction | Same synchronous worker request, before reply; separately reported `anchorsMs` |
| SVG parsing/insertion + presentation setup | `score-dom-commit`, main thread; 16.98ms first commit |
| Continuous playhead | Main thread; store projection only |

Trace categories: `devtools.timeline,blink.user_timing,toplevel`. These named marks remain available for repeat profiling. Parsing, layout, and SVG generation are not inferred merely from a worker checkbox. Final DOM/style/paint, font presentation, structured-clone delivery, and the existing map/audio application still require browser main-thread work. The trace does not separate alphaTab layout from engraving internally; `renderMs` measures both plus SVG generation.

### Raw timings

Traced desktop startup: alphaTab import **113.0ms**, XML fetch **63.7ms**, parse/model **459.2ms**, timing/setup **73.2ms**, first presented window **3,034.3ms**. A separate narrow-view run measured **98.3 / 56.8 / 275.9 / 62.3ms**, first window **1,941.3ms**.

Desktop trace, milliseconds:

| Scope / request | Measures / staves | Worker render | Anchors | Worker total | Round trip | DOM commit | Dispatch → presented frame |
|---|---:|---:|---:|---:|---:|---:|---:|
| Orchestra initial | 1–6 / 19 | 68.0 | 0.7 | 68.7 | 69.9 | 17.1 | 2282.4 |
| Orchestra resize | 1–6 / 19 | 26.1 | 0.4 | 26.5 | 27.4 | 14.9 | 97.2 |
| Strings scope | 1–8 / 6 | 12.7 | 0.2 | 12.9 | 13.7 | 10.9 | 478.4 |
| Cello scope | 1–12 / 2 | 9.4 | 0.1 | 9.5 | 10.6 | 6.4 | 318.5 |

Separate warmed narrow-view scope sequence (worker render / DOM commit): Orchestra → Strings **18.8 / 9.6ms**; Strings → Cello **8.1 / 5.7ms**; Cello → Strings **10.6 / 8.3ms**; Strings → Orchestra **18.2 / 15.4ms**. Cello window changes during desktop playback:

| Window | Worker total | DOM commit | Dispatch → presented frame |
|---|---:|---:|---:|
| 9–20 | 6.3ms | 6.5ms | 483.9ms |
| 17–28 | 7.7ms | 9.1ms | 502.4ms |
| 33–44 | 9.6ms | 8.3ms | 501.4ms |
| 65–76 | 7.7ms | 7.0ms | 467.2ms |

Presentation latency includes waiting for animation frames and is **not** engraving cost; scope defer/queue waiting before worker dispatch is excluded. Software WebGL produced ~3–5 desktop FPS and ~20 narrow-view FPS, so cheap worker results did not guarantee prompt presentation. The previous POC reported 467.5ms Orchestra→Strings, 55.4ms Strings→Cello, and 584.0ms Strings→Orchestra full-layout costs. New scope costs are much smaller, but renderer configuration, visible work, viewport, tracing, and cache state differ: do not treat these as controlled speedup ratios.

The traced initial load/scope sequence recorded **zero main-thread tasks over 50ms**, versus a **1,228ms** initial task in the baseline. A separate longer session recorded one **242ms** task around viewport/layout changes. This does not establish that the whole application is hitch-free. DOM commits still consume ~6–17ms plus subsequent browser style/paint work.

Playhead CPU mean **~0.01ms**, observed max **0.7ms** across 4,364 frames; only 15 window messages had been sent in that session. Coordinates changed within sustained musical intervals. A pause at **111.84s** retained exactly `translate3d(227.439px, 510px, 0px)` across repeated observations.

Initial bounded orchestra sheet: **4 SVGs / 1,590 descendants**; first cello sheet: **5 SVGs / 513 descendants**; later cello window: **7 SVGs / 659 descendants**. SVG count includes headers/footer, not just systems. Main-realm heap was roughly **44–52MiB** across observed sessions. This excludes worker model memory; worker debugger heap retrieval was unavailable, so **total-memory improvement or leak-freedom is unproven**.

## Important library failures

A browser seek to **109.0s in Orchestra** resolves to **measures 68–73** and fails with `Cannot read properties of null (reading 'getBeatDirection')` in `ScoreSlurGlyph.calculateTieDirection`. It reproduced with a fresh standalone renderer at start measures **68 and 72**, both Orchestra and Strings. A rapid-navigation playback run also produced a `topEffects` null-reference error. Source inspection shows effects/slurs reaching for a renderer outside the requested range.

The browser retained its previous cello window while reporting the failed orchestra request. Selecting Cello then successfully rendered **68–79**, with transport still exactly **109.0s**. Later requests also recovered after the rapid-navigation failure. No source-score modification, glyph suppression, vendor patch, or unbounded lookbehind was added to conceal this.

Minimal reproduction with the unchanged score model, fresh `ScoreRenderer`, width 860, SVG/Page settings: set `display.startBar = 68`, `display.barCount = 6`, then `renderScore(score, [0,1,…,18])`; observe `renderer.error`. This is an explicit **production blocker for arbitrary moving windows**, even though many other bounded ranges work well.

## Validation and decision

- All scopes and canonical map transitions exercised, including rapid Orchestra→Strings→Cello→Strings→Cello during playback. One obsolete worker response was discarded; deterministic tests additionally cover in-flight/queued replacement, invalidation, and late/out-of-order completion.
- ~112 seconds of cello playback crossed eight overlapping thresholds without resetting transport; pause/resume and seeks at 50/300/420/10 seconds preserved logical behavior and requested destination windows directly.
- Portrait: page stayed 320px, local score viewport ~301px with 760px notation and working two-axis scrolling. Landscape: page 844px, local viewport 491×254px, notation 760px. Resizing is bounded/debounced. Dense full-score windows still require scrolling; headings/credits repeat with each window. No mobile UX redesign or full engraving audit.
- Existing tests, score tests, production build, lint, and diff checks run. Lint retains four pre-existing warnings. Tests cover Atlas window policy, timing lookup, interpolation/system boundaries, selection mapping, and request correctness, not alphaTab engraving snapshots.

### Answers to the evaluation questions

1–3. Parsing, model construction, timing, layout, SVG preparation, and anchor extraction moved off-thread. Main work is bounded SVG presentation, input, and playhead projection; the large score-compute stall disappeared in the measured load, but commits and software GPU frame starvation still matter.

4–6. True partial engraving is supported and measurably cheaper; full-model parse/timing costs remain once at startup. Overlapping preparation is practical **where alphaTab can render the boundary**. The exceptions above prevent claiming general reliability.

7–10. Beat/rest geometry plus bar-end anchors is sufficiently dense for this fixture's continuous projection. Notes/rests/sustains interpolate; systems switch explicitly, and windows replace atomically. Per-frame CPU is small; actual visual smoothness remains frame-rate dependent, with no independent clock used to mask it.

11–13. Worker work can run alongside map navigation without the earlier main-thread parse/layout stall. Logical playback remained correct through successful windows, failures, navigation, and seeks. Hitch-free animation and audible glitch-freedom are not established by this software-rendered test. Physical mobile/native-GPU and sustained listening tests remain required.

14–15. This strengthens the **runtime-isolation** case but exposes a serious **window-correctness** weakness. Next: reproduce/report the slur/effect boundary failures upstream and compare Verovio using the same fixture, measure 68/72 cases, horizons, transport, and presentation metrics. Include cross-boundary semantics, off-thread parsing/layout, cancellation/stale results, total worker memory, and anchor fidelity as explicit comparison criteria. Offline timing/model preparation is a future possibility, not implemented here.

## References

[Official low-level APIs](https://docs.alphatab.net/docs/guides/lowlevel-apis), [worker setting](https://alphatab.net/docs/reference/settings/core/useworkers), [startBar/barCount](https://alphatab.net/docs/reference/types/displaysettings/). Installed 1.8.4 source was inspected for the high-level worker serialization path and boundary failures. Existing licenses/provenance remain unchanged.
