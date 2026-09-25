# Map navigation and listening mix

## State ownership

- `src/store/navigation-store.ts` owns spatial navigation. The URL projects that state (`/strings/cello`), and opening a route restores the same navigation and audio selection.
- There is no separate listening-selection store. `audioSelection()` derives selection from navigation; `effectiveAudioSelection()` applies the full-orchestra lock when enabled.
- `playbackPlan()` resolves selected instruments to the leaf stems available in the current chunk manifest.
- Playback transport lives in `src/store/playback-store.ts`; load progress lives in `src/store/listening-load-store.ts`; the Web Audio graph stays inside `listening-engine.ts`.
- Musical activity comes from the offline activity profile and remains independent of navigation, source loading, and the audible mix.

## Interaction

Map click/tap, spatial labels, Back, and Escape change navigation. Zooming changes the listening selection unless Full orchestra is locked. The lock affects audio only; it does not move the camera or change the URL.

The top-bar transport plays, pauses, and seeks the shared timeline. Pointer scrubbing commits once on release so intermediate drag positions do not trigger chunk loading. Keyboard range changes commit immediately.

## Audio contract

Orchestra view streams `full-orchestra.opus` through an `HTMLMediaElement` connected to the shared `AudioContext`.

Family and instrument views are solo focus modes. Once their focused chunks are ready, the mastered orchestra fades to zero and synchronized leaf stems become audible. The full-mix media element keeps advancing underneath so returning to orchestra requires no restart or seek.

Current scope gains are orchestra `1`, family `0`, and instrument `0`. Both entering and leaving focus use the 0.6 s background transition. Focus sources remain scheduled until the transition cleanup runs; cache pruning does not stop a departing selection early.

Establishing focus schedules its stems' sources in small batches across a few animation frames rather than one synchronous pass, so a multi-stem family selection does not drop frames in the same tick as navigation's camera travel. Every batch targets the same frozen logical time, so audible onset is unaffected.

The orchestra layer receives continuous ensemble-intensity makeup gain. The focus bus receives a blend of selected-part and ensemble makeup gain. Both use the offline activity profile, emphasis 1, a 24 dB cap, and a 0.02 s smoothing constant. A limiter after the master bus protects boosted and overlapping transition peaks.

## Chunk loading

The chunk scheduler continuously maintains a bounded working set while playback runs:

- focused stems: current−1 through current+2 for one or two focused stems, narrowing to current+next once a family focus exceeds two stems, high priority and awaited;
- speculative stems: current and next for up to eight rotating non-focused stems, low priority;
- four concurrent fetch/decode operations;
- 24 MiB decoded background PCM budget;
- queued and active obsolete requests cancelled on selection/window changes;
- current and next focused chunks scheduled on the shared clock.

Speculative work never gates focus playback. Focus sources are one-shot nodes and are clipped to each chunk's logical duration. Old buffers and expired chunks are pruned, while selection changes use explicit delayed `stopSources()` cleanup so audible fades complete.

## Assets and activity

Initial load starts the continuous mix, chunk manifest, and activity profile. Whole instrument Opus files are not decoded by production playback. Once playback begins, bounded speculative chunk preload runs even in orchestra view.

Master WAV stems generate:

- `full-orchestra.opus` and whole-file stem Opus assets through `npm run audio:encode`;
- synchronized 15-second stem chunks through `npm run audio:chunks`;
- instrument activity envelopes through `npm run audio:activity`.

See [audio-assets.md](audio-assets.md). The approved behavior is [specs/listening.md](../specs/listening.md).

## Validation

`npm test` covers selection, plans, gain math, transport, preload planning, cancellation-related generation tokens, and chunk expiry. Browser listening remains required for transitions, perceived level, drift, seek behavior, and chunk boundaries.
