# Instrument exploration performance

The current pass preserves simultaneous canvas resizing and camera zoom,
the existing DPR cap of 1.5, and all panel transitions.

## Confirmed changes

- Apply drawing-buffer dimensions and DPR in a single operation; ignore
  duplicate dimensions/DPR. Preserve synchronous redraw after resizing to
  prevent blank frames. Only update camera projection when aspect changes.
- Raycast all hotspots in overview, only the selected hotspot during anatomy,
  and none during performance. Refresh markers when performance closes.
- Update hotspot coordinates through element refs. React still owns buttons,
  labels, selection and the visible hotspot set, preserving semantic access.
- Keep the renderer mounted across overview/anatomy/performance. Its existing
  cleanup, asset cache policy and render scheduling are unchanged.

## Evidence and limits

A Node harness executed the installed Three.js sizing methods with counted
canvas dimension setters. Across 36 changing widths at stable DPR:

| Path | Canvas dimension assignments |
|---|---:|
| Previous `setPixelRatio()` + `setSize()` | 144 |
| Current guarded `setDrawingBufferSize()` | 72 |

Identical observations now cause zero additional buffer updates. These are
method-level measurements, not GPU allocation counts or browser timings.

Build and six exploration test groups pass, including the drawing-buffer and
diagnostic tests in `tests/instrument-rendering.mjs`. The full `npm test` run
stops at the existing identity-layout assertion in `tests/listening-state.mjs`.

The violin `arco.mp4` test clip is available locally: 1,391,982 bytes,
720×1280, H.264 (`avc1`), 24fps, six seconds, with an `mp4a` audio track.
Its `moov` atom precedes `mdat`, supporting progressive playback. These values
were read from MP4 metadata; decoding performance has not been measured.

Browser profiling and visual checks remain pending: this session has no connected
browser or local instrument GLB. No FPS, GPU-time, thermal, React-commit, or
real-asset memory improvement has been established.

## Opt-in instrumentation

Append `explorePerf=true` to the app URL (development or production preview).
Inside exploration, inspect the hidden `output[data-explore-performance]`:

```js
JSON.parse(document.querySelector('[data-explore-performance]').textContent)
```

The snapshot refreshes every 500ms without React state updates. Counters reset
when the renderer mounts and include renders, resize callbacks, buffer updates,
anchor passes, raycasts and publications of hotspot membership to React.
`cpuRenderMs` is cumulative CPU time inside scene rendering, not GPU time.
Draw calls, triangles, geometries and textures are the latest Three.js counters;
resource counts do not represent bytes. Frame percentiles use at most 600 active
RAF intervals, excluding idle gaps; they are not a replacement for a browser trace.
`anchorPublications` counts state publications, not React commits.

Compare counter deltas over the same interaction, viewport, DPR and recording.
Use a production build for timing; React Strict Mode affects development startup.
Use the React Profiler separately for commit measurements, and the browser's
performance tools for long tasks and video frame statistics.

## Browser validation still required

- Record overview → anatomy → performance → anatomy → overview in both orientations.
- Check selected hotspot centering, occlusion, floor light, and first-frame rendering.
- Reverse panels mid-animation; rapidly select different hotspots.
- Rotate/resize while focused; test DPR changes and reduced motion.
- Verify video startup/close and main audio pause/resume.
- Compare p95/p99 frame times, long tasks, render/resize counts, React commits,
  and real-device responsiveness against the same baseline interactions.
- Repeat exploration entry/exit and inspect resource/memory trends.

Further scheduling, quality adaptation, asset compression and cache changes are
deferred until real-device traces demonstrate a need.

## Panel motion ownership

`InstrumentExplore.tsx` owns one GSAP timeline for the anatomy/performance rail,
canvas reservation, scene dimming, and boundary chevrons (0.6s, `power2.inOut`).
CSS resolves layout from `--anatomy-progress` and `--performance-progress`,
including portrait sheets and viewport changes; it does not transition the rail.
Interrupted timelines retain their current progress. Media stays mounted through
closing and is released by timeline completion, rather than a separate timer.
Reduced motion settles immediately. The existing model camera focus timeline and
top-level map/explore choreography remain separate GSAP controllers.

## All-instrument preview mode

All 17 catalog instruments currently load the same cached violin GLB. Only the
violin entry represents its real geometry; other overviews explicitly label the
borrowed model and temporary hotspot positions. Instrument accents and engraving
mappings remain tied to the selected instrument.

`preview-instrument-content.ts` holds draft, instrument-specific two-sentence
summaries, anatomy descriptions, techniques, source URLs, and temporary anchor
bindings. The text needs musical/editorial review before publication. These
anchor names represent test positions on the violin, not the anatomical location
of the described part. Unused violin anchors are hidden for each preview.

Sources: Vienna Symphonic Library Academy instrument pages (URLs retained in each
entry), and the Philharmonia percussion guide for the two percussion groups.
No source media is downloaded or licensed by this change.

Existing violin and timpani techniques/media remain available. New techniques
link to a shared, explicitly labeled violin test clip so Performance can be
exercised; this clip does not demonstrate the selected technique. It relies on
the existing local `videos/instruments/violin/arco.mp4` file, not new recordings.

`tests/instrument-previews.mjs` checks catalog coverage, shared model URL,
instrument-specific labels and descriptions, technique/media integrity, and
opening and closing Performance from each preview hotspot. Run it with the
existing Vite SSR harness; it is also registered in `npm test`.
