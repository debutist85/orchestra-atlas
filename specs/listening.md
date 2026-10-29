# Listening

**Status:** Approved behavior for the current production player  
**Feature:** `src/features/listening`  
**Related:** [listening-selection.md](../docs/listening-selection.md), [audio-assets.md](../docs/audio-assets.md)

Listening should feel like one continuous performance. Navigation selects which rendering of that performance is in front: the mastered orchestra at orchestra depth, or one synchronized pre-mixed stem over a quiet bed of the full mix at family and instrument depth.

---

## Established

### One transport

`src/store/playback-store.ts` owns playing / paused, logical position, duration, seek, and end-of-piece pause.

While playing, the engine clock is:

```text
position = clamp(origin + audioContext.currentTime, duration)
```

Every audible layer, including the full mix, is a chunked `AudioBufferSourceNode` scheduled on that clock, so the layers and the visuals cannot drift apart. Source nodes do not define application time. Duration comes from the chunk manifest, then the activity profile. Public controls remain `play`, `pause`, `toggle`, and `seek`; UI components do not own chunk indices, buffers, or scheduling.

Pointer scrubbing is local UI state until release, so dragging across the timeline does not start a preload cycle for every intermediate value. Keyboard changes commit immediately.

### Audio graph and modes

```text
chunked full mix (bed, stem `full_orchestra`)
  → bed stem gain (unity)
  → orchestraGain (scope fade)
  → orchestraBoost (continuous ensemble makeup)
  ┐
  ├→ master → DynamicsCompressorNode limiter → destination
  │
chunked focus stems
  → per-stem gain
  → focusScope (zoom crossfade)
  → focusBoost (continuous selected-part makeup)
  ┘
```

One `AudioContext` is shared.

- **Orchestra:** the full-mix bed is audible; no focus stems are scheduled.
- **Family / instrument:** the full mix ducks to a quiet bed (−18 dB / −24 dB) and the selection's synchronized pre-mixed stem becomes the dominant solo layer.
- **Full-orchestra lock:** navigation remains unchanged, but `effectiveAudioSelection()` forces orchestra audio.

Solo focus over a ducked bed is the current product behavior. The older additive highlight mix (selected part at full level over a lightly attenuated orchestra) is not implemented.

### Selection → stems

Navigation is the normal selection input through `connectListeningEngine()`. `playbackPlan()` maps a family to its premix and an instrument to its stem from `excerpt.ts`, filtered by the chunk manifest. A focus is exactly one stem or none; instrument stems are never summed at runtime.

| Navigation | Focus stems (Beethoven 7 II) |
|---|---|
| Orchestra | none |
| Woodwinds | woodwinds |
| Flute | flute |
| Strings | strings |
| Cello | cello |
| Brass | brass |
| Other / no stem in this recording | none; treated as a rest, so the bed still ducks |

IDs come from the excerpt catalog. Do not hard-code family membership in the scheduler. Every family with instruments in an excerpt needs its own premix (`missingFamilyStems()`); `audio:chunks` and `audio:activity` refuse to run without one. Missing stems are not inferred, and asset rights are not inferred.

### Scope gains and transitions

`listeningMix` currently uses:

| Depth | Full-orchestra scope gain |
|---|---:|
| Orchestra | 1.0 |
| Family | −18 dB (≈0.126) |
| Instrument | −24 dB (≈0.063) |

The full mix stays audible until the requested focus chunk is decoded. Entering focus then ramps the orchestra scope from 1 down to the depth's bed gain and the focus scope from 0→1 over `BACKGROUND_FADE_SECONDS` (0.6 s), with an 80 ms scheduling lead. Scope fades and continuously tracked makeup gains use separate `GainNode`s so one automation does not cancel the other.

Returning to orchestra performs the inverse 0.6 s gain transition (bed → 1, focus 1 → 0) without rescheduling the bed. After the fade, only the departing focus stems' sources stop. Scheduled focus sources must remain alive for the entire audible fade. `stopSources()` owns selection cleanup after the handoff; cache pruning may retire only chunks genuinely behind the playhead. Do not use the desired selection alone to stop sources during a transition.

Focus-to-focus changes keep the departing stem audible while the new focus chunk loads, then crossfade departing and arriving stem gains together over 0.6 s. Interrupted fades hold their instantaneous values before a new ramp begins, avoiding jumps during rapid navigation.

### Intensity-aware gain

Musical intensity comes from `public/audio/{excerpt}/activity/{excerpt}.json` at transport time, in the range 0…1. The file contains the full-orchestra envelope, one envelope per family mix, and one envelope per instrument. Runtime gain uses the instrument envelopes. Map activity takes its on/off timing from per-instrument onset `gates` (sounding spans measured at 5 ms against an absolute −70 dBFS floor) and its strength from the instrument envelopes. Gates never affect gain. There is no runtime `AnalyserNode` path.

- `ensembleIntensity()` is the maximum current instrument intensity and drives `orchestraBoost`.
- Family selected intensity is the average of sounding selected instruments; stem count does not increase it.
- `soloIntensityGain()` maps intensity to makeup gain using emphasis **1** and a **24 dB** ceiling. Intensity 1 gives unity; quieter non-zero values receive progressively more gain; zero returns unity.
- `focusBoostGain()` blends selected-part and ensemble makeup gains using `soloEnsembleBlend` (**0.5**), reducing the level discontinuity between focus and orchestra while retaining support for quiet selected material.
- `orchestraBoost` and `focusBoost` track their targets with a 0.02 s `setTargetAtTime` constant.

A fast limiter after `master` protects the sum during transitions and boosted passages: threshold −1 dB, knee 0, ratio 20:1, attack 3 ms, release 250 ms.

### Chunk scheduler

Playback-critical work:

- logical chunks are 15 s, as declared by the manifest;
- the full-mix bed is awaited whenever playback starts and is kept over current+next: the current chunk is awaited, and the next one joins the wait within 2 s of the boundary. It is never speculative, never pruned out, and its non-awaited next chunk shares the 24 MiB budget like the rest of the focus window;
- the focused preload window is current−1 through current+2 for the focus stem (and, while a swap loads, the departing one);
- a chunk whose raw peak is at or below one 16-bit sample is not fetched or decoded. The mask is `chunks` on the activity profile, keyed by chunk stem id. A missing mask, an unknown stem, or a chunk duration that does not match the mask loads the chunk. The visual intensity envelope does not make this decision;
- focus playback waits for the current audible chunk. The next audible chunk joins that wait when less than 2 s remain in the current chunk. The previous chunk and the chunk two ahead stay in the focus window and load ahead of speculation, without holding up the fade. A silent chunk counts as ready;
- current and next chunks of the bed and the focus stem are scheduled on the shared AudioContext clock;
- each one-shot source is clipped to its chunk's logical duration so adjacent AAC chunks neither overlap nor leave a gap. Chunks must therefore contain exactly their slot's samples: `chunkTrimFilter()` passes ffmpeg's exclusive `end_sample` as-is.

Bounded speculative work:

- speculative preloads follow navigation: family mixes from orchestra view, that family's instruments from a family view, and the family mix plus sibling instruments from an instrument view. A decoded 15 s chunk is counted as 5.49 MiB. Speculation requests only the chunks that still fit in the 24 MiB budget after the non-awaited focus window, current chunks before the following ones;
- speculative loads are lower priority and never gate playback;
- at most four fetch/decode operations run concurrently;
- decoded PCM outside the awaited focus chunks is capped at 24 MiB. The awaited chunks are not counted. The rest of the focus window shares that cap with speculation, and speculation is dropped first;
- obsolete queued requests are removed and obsolete active fetches are aborted when the window or selection changes;
- duplicate loads share one in-flight promise.

`prepare()` and `prune()` are called by one 25 ms audio timer while playback runs, including orchestra mode. Scheduling and continuous gain tracking do not depend on `requestAnimationFrame`; visuals sample the shared transport independently. Only one pending preparation continuation is retained per command. Timer delays do not set audio start times: sources still use the AudioContext clock and the current/next 15-second chunk window. Pausing, reaching the end, and disposal clear the timer. Background timer throttling is tolerated by that window, but an operating-system-frozen page cannot fetch/decode new chunks.

Plan signatures avoid rebuilding a settled window on every tick. Every granted fetch/decode slot is released, including a request cancelled before its async continuation begins. Disposal invalidates pending manifest/decode results so they cannot overwrite a new scheduler generation. Buffer pruning follows the current desired window. Scheduled-source pruning is intentionally separate: only sources older than the previous chunk are retired automatically; selection transitions stop their sources after their audible fade.

### Loading

Initial repertoire load fetches the chunk `manifest.json` and the gain activity profile in parallel, then decodes the bed chunk under the playhead before reporting ready, so the first Play waits only for scheduling. Without bed chunks in the manifest, loading reports an error.

The excerpt's `gainActivityUrl` selects a separate lossless gain runtime artifact in development and production. It preserves the detailed source's original sample interval, calibrated and shared instrument envelopes, orchestra envelope, gates, instrument/orchestra onsets and chunk mask, excluding unused family envelopes and analysis metadata. `npm run audio:compact` generates it alongside the visual runtime and compression sidecars. Production serves the gain artifact from R2 with Brotli content encoding; startup does not request the full analysis JSON. Do not substitute the visual runtime, whose shared gain envelopes are intentionally empty. Repeated `load()` calls reuse the same initial load; disposal aborts profile loading and ignores stale completion.

The player never loads whole-file AAC. Once playback runs, the scheduler maintains its bounded speculative chunk cache even in orchestra view. Selecting a family or instrument promotes its window to the focused priority and waits for the current audible chunk, plus the next one when the playhead is within 2 s of the chunk boundary.

### Seek, pause, and end

Play, resume, and seek all restart the transport the same way: the clock holds at the target position while the bed chunk (and the focus stem's, when focused) is awaited, then `origin` is set so every layer starts at one instant 80 ms ahead. Seek also increments transport `epoch`, cancels obsolete chunk work, and stops scheduled sources first. Pause records one logical position and stops all sources. While paused, including after a seek or while browsing to another part, the scheduler fetches only the current audible bed chunk and the selected stem's, and cancels the rest of the window and any speculative loads. If a start fails to load, the transport returns to paused. At excerpt duration, scheduling stops.

### Failure and races

Only the newest selection or transport command may change audible state. Async work captures a command token before it starts and checks it before scheduling or pruning. Focus load failure preserves the previous valid audible state and restores the orchestra when no focus remains valid.

Chunk requests use `AbortController`. Cancellation is expected and must not be reported as a playback failure.

### Activity vs selection

| Concept | Source |
|---|---|
| Musical activity / intensity | activity profile + transport (onset gates for timing, envelopes for strength) |
| User focus | navigation, overridden only by full-orchestra lock |
| Audible scope | playback plan + transition state |
| Continuous gain | ensemble and selected intensity |
| Visual emphasis | map materials / ghosts / rings |

Keep these independent. Map activity must work when stems are not loaded.

### Autoplay and browser behavior

Playback begins from the user's Play gesture through `audioContext.resume()`. Do not bypass autoplay rules.

Map visuals sample the transport minus the context's output latency (`outputLatency`, else `baseLatency`), so they follow what is heard; diagnostics show that latency.

Web assets are AAC (`.m4a`), not Opus — Safari/iOS has no Ogg demuxer, so Opus-in-Ogg silently failed on iOS while working everywhere else; AAC in an MP4 container is universally supported, including by `decodeAudioData()`.

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
| Asset generation | `npm run audio:chunks` (playback), `npm run audio:encode` (whole-file AAC, not loaded by the player) |
| Transport and load UI | `src/store/playback-store.ts`, `listening-load-store.ts` |
| Full-orchestra override | `src/store/listening-lock-store.ts`, `FullOrchestraLock.tsx` |
| Diagnostics | `ListeningDiagnostics.tsx` (`D` or `?debug=true`) |
| Tests | `tests/listening-state.mjs`, `playback-plan.mjs`, `chunk-playback.mjs`, `activity-profile.mjs`, `offline-activity.mjs` |

Current excerpt: Beethoven 7 II (`beethoven-7th-2nd`). Master WAVs remain under `public/audio/beethoven-7th-2nd/stems/raw/` and are gitignored.

---

## Out of scope

- Regenerating assets or changing chunk duration / bitrate as part of runtime work
- An additive highlight mode alongside the current solo focus
- Real-time RMS / `AnalyserNode` analysis
- EQ or loudness normalization of the audio signal itself at runtime (the
  offline activity pipeline's per-instrument dB calibration — see
  `offline-activity.ts`'s `calibrateInstrumentAnalysis` — is a visualization/
  mix-weighting concern over precomputed intensity envelopes, not this)
- Service workers, MSE, AudioWorklets, or IndexedDB audio caches
- Deleting master WAVs or derived whole-file stem AAC files
- Redesigning map navigation

---

## Open questions

- Are chunk joins and bed/stem crossfades perceptually clean across devices?
- Does decoding the bed alongside focus stems stay within memory on low-end mobile?
- Should the intensity curve, blend, limiter, or scope fade be retuned after longer listening?
- Physical iOS Safari behavior

---

## Validation

Automated tests cover plans, gain math, activity lookup, transport math, preload planning, cache-window math, stale tokens, and scheduled-source expiry. They cannot judge perceived loudness or phase alignment.

Listen after changes: orchestra across several 15 s chunk joins; first Play latency; orchestra → strings/woodwinds; family → instrument and back; focus → orchestra through the full fade; quiet versus loud focus; chunk boundaries; seek while focused; pause/resume; rapid navigation; long playback with diagnostics open.
