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

Orchestra view streams `full_orchestra.m4a` through an `HTMLMediaElement` connected to the shared `AudioContext`.

Family and instrument views are solo focus modes. Once their focused chunks are ready, the mastered orchestra fades to zero and synchronized leaf stems become audible. The full-mix media element keeps advancing underneath so returning to orchestra requires no restart or seek.

Current scope gains are orchestra `1`, family `0`, and instrument `0`. Entering and leaving focus use a symmetric 0.6 s crossfade between separate orchestra and focus scope nodes. Their continuously tracked makeup gains live on separate nodes, so gain tracking cannot cancel the crossfade. Family↔instrument changes keep the departing stem audible until the arriving chunk is ready, then crossfade both stem gains over the same 0.6 s. Interrupted ramps continue from their instantaneous level.

Establishing focus schedules its stems' sources in small batches across a few animation frames rather than one synchronous pass, so a multi-stem family selection does not drop frames in the same tick as navigation's camera travel. Every batch targets the same frozen logical time, so audible onset is unaffected.

The orchestra layer receives continuous ensemble-intensity makeup gain. The focus bus receives a blend of selected-part and ensemble makeup gain. Both use the offline activity profile, emphasis 1, a 24 dB cap, and a 0.02 s smoothing constant. A limiter after the master bus protects boosted and overlapping transition peaks.

## Chunk loading

The chunk scheduler continuously maintains a bounded working set while playback runs:

- focused stems: current−1 through current+2 for the selected pre-mixed instrument or family stem. Playback waits for the current chunk, and for the next chunk when less than 2 s remain; the rest of that window loads ahead of speculation;
- fallback selections with more than two leaf stems narrow to current+next;
- speculative stems: the next navigation choices (family mixes, or the current family's instruments), low priority. Current chunks are requested before following ones, and only as many as still fit in the 24 MiB budget beside the rest of the focus window;
- four concurrent fetch/decode operations;
- 24 MiB decoded PCM budget for everything except the awaited focus chunks. Speculation is dropped before the rest of the focus window;
- queued and active obsolete requests cancelled on selection/window changes;
- current and next focused chunks scheduled on the shared clock.

Speculative work never gates focus playback. While paused, navigation warms only the current audible chunk of the selected stem; the rest of the window and speculative loads start when playback resumes. Focus sources are one-shot nodes and are clipped to each chunk's logical duration. Old buffers and expired chunks are pruned, while selection changes use explicit delayed `stopSources()` cleanup so audible fades complete.

## Assets and activity

Initial load starts the continuous mix, chunk manifest, and activity profile. Whole instrument AAC files are not decoded by production playback. Once playback begins, bounded speculative chunk preload runs even in orchestra view.

Master WAV stems generate:

- `full_orchestra.m4a` and whole-file stem AAC assets through `npm run audio:encode`;
- synchronized 15-second stem chunks through `npm run audio:chunks`;
- instrument, family, and full-orchestra activity envelopes, plus the raw-peak chunk mask, through `npm run audio:activity`.

See [audio-assets.md](audio-assets.md). The approved behavior is [specs/listening.md](../specs/listening.md).

## Validation

`npm test` covers selection, plans, gain math, transport, preload planning, cancellation-related generation tokens, and chunk expiry. Browser listening remains required for transitions, perceived level, drift, seek behavior, and chunk boundaries.
