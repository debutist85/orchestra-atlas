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
