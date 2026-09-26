# Listening

**Status:** Approved behavior for the current production player  
**Feature:** `src/features/listening`  
**Related:** [listening-selection.md](../docs/listening-selection.md), [audio-assets.md](../docs/audio-assets.md)

Listening should feel like one continuous performance. Navigation selects which rendering of that performance is audible: the mastered orchestra at orchestra depth, or synchronized leaf stems at family and instrument depth.

---

## Established

### One transport

`src/store/playback-store.ts` owns playing / paused, logical position, duration, seek, and end-of-piece pause.

While playing, the engine clock is:

```text
position = clamp(origin + audioContext.currentTime, duration)
```

Neither `HTMLMediaElement.currentTime` nor chunk source nodes define application time. Duration comes from the chunk manifest, then the activity profile. Public controls remain `play`, `pause`, `toggle`, and `seek`; UI components do not own chunk indices, buffers, or scheduling.

Pointer scrubbing is local UI state until release, so dragging across the timeline does not start a preload cycle for every intermediate value. Keyboard changes commit immediately.

### Audio graph and modes

```text
full-orchestra.opus
  → HTMLMediaElement
  → MediaElementAudioSourceNode
  → orchestraGain (scope fade)
  → orchestraBoost (continuous ensemble makeup)
  ┐
  ├→ master → DynamicsCompressorNode limiter → destination
  │
chunked focus stems
  → per-stem gain
  → focusBus (continuous selected-part makeup)
  ┘
```

One `AudioContext` is shared.

- **Orchestra:** the continuous full mix is audible; no focus stems are scheduled.
- **Family / instrument:** the full mix fades to zero and synchronized leaf stems become the audible solo layer.
- **Full-orchestra lock:** navigation remains unchanged, but `effectiveAudioSelection()` forces orchestra audio.

Solo focus is the current product behavior. The older additive highlight mix is not implemented.

### Selection → stems

Navigation is the normal selection input through `connectListeningEngine()`. `playbackPlan()` maps selected instrument IDs to leaf stem IDs from `excerpt.ts`, filtered by the chunk manifest.

| Navigation | Focus stems (Beethoven 7 II) |
|---|---|
| Orchestra | none |
| Woodwinds | flute-1/2, oboe-1/2, clarinet-1/2, bassoon-1/2 |
| Flute | flute-1, flute-2 |
| Strings | violin-1/2, viola, cello-1/2, contrabass |
| Cello | cello-1, cello-2 |
| Brass | horn-1/2, trumpet-1/2 |
| Other / missing files | none; remain on the full mix |

IDs come from the excerpt catalog. Do not hard-code family membership in the scheduler. Missing stems are not inferred, and asset rights are not inferred.

### Scope gains and transitions

`listeningMix` currently uses:

| Depth | Full-orchestra scope gain |
|---|---:|
| Orchestra | 1.0 |
| Family | 0.0 |
| Instrument | 0.0 |

The full mix stays audible until the requested focus window is decoded. Entering focus then fades the orchestra scope gain over `BACKGROUND_FADE_SECONDS` (0.6 s), starts focus sources with an 80 ms scheduling lead, and brings their per-stem gains in over the short handoff interval.

Returning to orchestra performs the inverse 0.6 s gain transition without seeking or restarting the media element. Scheduled focus sources must remain alive for the entire audible fade. `stopSources()` owns selection cleanup after the handoff; cache pruning may retire only chunks genuinely behind the playhead. Do not use the desired selection alone to stop sources during a transition.

Focus-to-focus changes fade departing stem gains, prepare the new focus window, schedule the new sources, and remove departed sources after the handoff.

Establishing focus schedules its stems' sources a few at a time across animation frames rather than in one synchronous pass, bounded by `FOCUS_ROLLOUT_BATCH_SIZE`. Every batch targets the same frozen logical time, so audible onset is unaffected; only the per-frame `AudioBufferSourceNode` creation work is spread out. An instrument-level focus (at most two stems) always completes in a single batch.

### Intensity-aware gain

Musical intensity comes from `public/{excerpt}/activity/{excerpt}.json` at transport time, in the range 0…1 per instrument. There is no runtime `AnalyserNode` path.

- `ensembleIntensity()` is the maximum current instrument intensity and drives `orchestraBoost`.
- Family selected intensity is the average of sounding selected instruments; stem count does not increase it.
- `soloIntensityGain()` maps intensity to makeup gain using emphasis **1** and a **24 dB** ceiling. Intensity 1 gives unity; quieter non-zero values receive progressively more gain; zero returns unity.
- `focusBoostGain()` blends selected-part and ensemble makeup gains using `soloEnsembleBlend` (**0.5**), reducing the level discontinuity between focus and orchestra while retaining support for quiet selected material.
- `orchestraBoost` and `focusBus` track their targets with a 0.02 s `setTargetAtTime` constant.

A fast limiter after `master` protects the sum during transitions and boosted passages: threshold −1 dB, knee 0, ratio 20:1, attack 3 ms, release 250 ms.

### Chunk scheduler

`createChunkScheduler()` is shared by production and `/?chunk-poc`.

Playback-critical focus work:

- logical chunks are 15 s, as declared by the manifest;
- the focused preload window is current−1 through current+2 for one or two focused stems (instrument-level focus); a family focus of more than two stems narrows to current+next to bound simultaneous decoded PCM;
- focused loads have priority and are awaited before focus playback starts;
- current and next chunks are scheduled on the shared AudioContext clock;
- each one-shot source is clipped to its chunk's logical duration so adjacent Opus chunks neither overlap nor leave a gap.

Bounded speculative work:

- at most eight rotating, non-focused stems receive current + next preloads;
- speculative loads are lower priority and never gate playback;
- at most four fetch/decode operations run concurrently;
- decoded background PCM is capped at 24 MiB; focused buffers are protected from that budget;
- obsolete queued requests are removed and obsolete active fetches are aborted when the window or selection changes;
- duplicate loads share one in-flight promise.

`prepare()` and `prune()` are called while playback runs, including orchestra mode. Their signatures avoid rebuilding a settled window on every animation frame. Buffer pruning follows the current desired window. Scheduled-source pruning is intentionally separate: only sources older than the previous chunk are retired automatically; selection transitions stop their sources after their audible fade.

### Loading

Initial repertoire load starts these independently:

- continuous `full-orchestra.opus` through the media element;
- chunk `manifest.json`;
- `activity.json`.

The player does not decode whole-file instrument stems. Once playback runs, the scheduler maintains its bounded speculative chunk cache even in orchestra view. Selecting a family or instrument promotes its required chunks to the focused priority and waits only for those chunks.

### Seek, pause, and end

Seek increments transport `epoch`, seeks the media element, cancels obsolete chunk work, stops scheduled sources, and rebuilds focus playback at the destination. Pause records one logical position, pauses media, and stops focus sources. Resume recreates focus sources and resumes media from that position. At excerpt duration, media and focus scheduling stop.

### Failure and races

Only the newest selection or transport command may change audible state. Async work captures a command token before it starts and checks it before scheduling or pruning. Focus load failure preserves the previous valid audible state and restores the orchestra when no focus remains valid.

Chunk requests use `AbortController`. Cancellation is expected and must not be reported as a playback failure.

### Activity vs selection

| Concept | Source |
|---|---|
| Musical activity / intensity | activity profile + transport |
| User focus | navigation, overridden only by full-orchestra lock |
| Audible scope | playback plan + transition state |
| Continuous gain | ensemble and selected intensity |
| Visual emphasis | map materials / ghosts / rings |

Keep these independent. Map activity must work when stems are not loaded.

### Autoplay and browser behavior

Playback begins from the user's Play gesture through `audioContext.resume()` and `media.play()`. Do not bypass autoplay rules.

The media element cannot start at an exact AudioContext time. Alignment uses an approximately 80 ms lead. Diagnostics report `media.currentTime − transport`; the engine logs sustained drift above 80 ms but does not apply an automatic correction loop.

Safari, Opus, and `MediaElementAudioSourceNode` remain device-test concerns.

---

## Current implementation

| Concern | Location |
|---|---|
| Engine and graph | `src/features/listening/listening-engine.ts` |
| Selection and gain curves | `audio-selection.ts` |
| Playback plan | `playback-plan.ts` |
| Handoff constants | `playback-transition.ts` |
| Fetch, decode, cache, and scheduling | `chunk-scheduler.ts` |
| Chunk transport math | `chunk-playback/transport.ts` |
| Excerpt and asset URLs | `excerpt.ts` |
| Activity lookup | `activity-profile.ts` |
| Offline activity generation | `offline-activity.ts`, `npm run audio:activity` |
| Asset generation | `npm run audio:encode`, `npm run audio:chunks` |
| Transport and load UI | `src/store/playback-store.ts`, `listening-load-store.ts` |
| Full-orchestra override | `src/store/listening-lock-store.ts`, `FullOrchestraLock.tsx` |
| Diagnostics | `ListeningDiagnostics.tsx` (`D` or `?debug=true`) |
| Isolated scheduler harness | `/?chunk-poc` |
| Tests | `tests/listening-state.mjs`, `playback-plan.mjs`, `chunk-playback.mjs`, `activity-profile.mjs`, `offline-activity.mjs` |

Current excerpt: Beethoven 7 II (`beethoven-7th-2nd`). Master WAVs remain under `public/beethoven-7th-2nd/audio/raw/` and are gitignored.

---

## Out of scope

- Regenerating assets or changing chunk duration / bitrate as part of runtime work
- An additive highlight mode alongside the current solo focus
- Real-time RMS / `AnalyserNode` analysis
- EQ or loudness normalization
- Automatic long-term clock-drift correction
- Service workers, MSE, AudioWorklets, or IndexedDB audio caches
- Deleting master WAVs or derived whole-file stem Opus files
- Redesigning map navigation

---

## Open questions

- Is the media/Web Audio alignment stable during long playback on target browsers?
- Are transitions between mastered media and decoded Opus stems perceptually clean across devices?
- Should the intensity curve, blend, limiter, or scope fade be retuned after longer listening?
- Physical iOS Safari behavior

---

## Validation

Automated tests cover plans, gain math, activity lookup, transport math, preload planning, cache-window math, stale tokens, and scheduled-source expiry. They cannot judge perceived loudness or phase alignment.

Listen after changes: orchestra; orchestra → strings/woodwinds; family → instrument and back; focus → orchestra through the full fade; quiet versus loud focus; chunk boundaries; seek while focused; pause/resume; rapid navigation; long playback with diagnostics open.
