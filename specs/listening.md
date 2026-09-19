# Listening

**Status:** Approved behavior for the current production player  
**Feature:** `src/features/listening`  
**Related:** [listening-selection.md](../docs/listening-selection.md), [audio-assets.md](../docs/audio-assets.md)

Listening should feel like one continuous performance. Selection highlights a part of that performance. It does not solo or isolate it.

---

## Established

### One transport

`src/store/playback-store.ts` owns playing / paused, logical position, duration, seek, and end-of-piece pause.

While playing, the engine clock is:

```text
position = clamp(origin + audioContext.currentTime, duration)
```

Neither `HTMLMediaElement.currentTime` nor chunk source nodes define application time. Duration comes from the chunk manifest, then the activity profile — not from media duration alone.

Public controls stay on the store: `play`, `pause`, `toggle`, `seek`. UI components must not see chunk indices, AudioBuffers, or backend switching.

### Two layers, not two backends

```text
full-orchestra.opus
        │
 HTMLMediaElement → MediaElementAudioSourceNode → orchestraGain (background)
        │
        └────────────── master ──────────────┐
                                             │
chunked focus stems → focusBus (dynamicFocusGain)
```

One shared `AudioContext`. Orchestra mode plays only the continuous mix. Family or instrument highlight **keeps that mix playing** and adds leaf stems as an emphasis layer.

This is Highlight, not Solo. Vision still allows a future Solo mode; it is not implemented.

### Selection → stems

Navigation is the only selection input (`connectListeningEngine`).

`playbackPlan()` maps highlighted instrument IDs to leaf stem IDs from `excerpt.ts`, filtered by the chunk manifest.

| Navigation | Focus stems (Beethoven 7 II) |
|---|---|
| Orchestra | none |
| Woodwinds | flute-1/2, oboe-1/2, clarinet-1/2, bassoon-1/2 |
| Flute | flute-1, flute-2 |
| Strings | violin-1/2, viola, cello-1/2, contrabass |
| Cello | cello-1, cello-2 |
| Brass | horn-1/2, trumpet-1/2 |
| Other / missing files | none; stay on the full mix |

IDs come from the excerpt catalog. Do not hard-code family lists in the scheduler. Instruments without files (trombone, tuba, harp, celesta, extra percussion) contribute no stems. Rights are not inferred.

### Background attenuation

Configured on `listeningMix` in `audio-selection.ts`:

| Depth | `backgroundGain` |
|---|---|
| Orchestra | 1.0 |
| Family | 0.25 |
| Instrument | 0.20 |

The bed stays at 1.0 until the requested focus chunks are ready. Then it ramps (50 ms). Failure must not leave an attenuated bed with no focus layer.

### Intensity-aware focus gain

Musical intensity comes from `public/activity/{excerpt}.json` at transport time. Range 0…1 per **instrument**. There is no runtime AnalyserNode path.

Family intensity is the average of sounding selected instruments (`orchestraAverageIntensity`). Stem count does not raise it.

`relativeInstrumentBoostDb` compares selected intensity to the orchestral average:

- rest (intensity 0) → no focus layer
- already at/above average, including fortissimo → no boost curve; only `minActiveFocusGain` (0.35) while active
- quieter than average → `min(maxInstrumentBoostDb, matchDb × instrumentBoostEmphasis)`

Current defaults: emphasis **3**, cap **24 dB**. Additive gain is `linear(boostDb) − 1` because the part is already in the full mix. Smoothing is the existing `setTargetAtTime` time constant (0.05 s). Do not add a second smoother.

### Chunk scheduler

`createChunkScheduler()` is shared by the production engine and `/?chunk-poc`. Proven properties to keep:

- 15 s logical chunks from the manifest
- shared start times on the AudioContext clock
- one-shot `AudioBufferSourceNode`s
- preload current−1 … current+2
- schedule current and next
- prune old buffers
- generation tokens so stale loads cannot start audio

Do not shrink the preload window to save memory unless a measured problem appears.

### Loading

Initial repertoire load: UI, `full-orchestra.opus`, chunk `manifest.json`, `activity.json`. Do not fetch or decode all instrument stems.

Interactive highlight: keep the mix playing, prepare the required window, then attenuate and fade focus in. Returning to Orchestra is a gain transition; do not seek or restart the media element.

### Seek, pause, end

Seek updates transport `epoch`, seeks the media element, and rebuilds focus sources from the new position. Pause freezes one logical time and stops both layers. Resume recreates focus sources and resumes media from that position. At excerpt duration, playback pauses and no further chunks are scheduled.

### Failure and races

Only the newest selection/transport command may change audible state. Focus load failure keeps the previous valid audio (usually unattenuated orchestra). Log the error; do not corrupt transport.

### Activity vs selection

| Concept | Source |
|---|---|
| Musical activity / intensity | activity profile + transport |
| User focus | navigation |
| Audio emphasis | background + dynamic focus gain |
| Visual emphasis | map materials / ghosts / rings |

Do not collapse these into one variable. Map activity must work when stems are not loaded.

### Autoplay and browsers

Playback starts from the user’s Play gesture (`audioContext.resume()` and `media.play()`). Do not bypass autoplay rules.

`HTMLMediaElement` cannot start at an exact `AudioContext.currentTime`. Alignment uses an ~80 ms lead. Overlay `drift` is `media.currentTime − transport`. If drift grows over minutes or becomes audible, stop and report it; do not add a correction loop in passing.

Safari/Opus/`MediaElementAudioSourceNode` is a known concern. Do not claim iOS compatibility without a device test.

---

## Current implementation

| Concern | Location |
|---|---|
| Engine | `src/features/listening/listening-engine.ts` |
| Mix / boost | `audio-selection.ts` (`listeningMix`) |
| Plan | `playback-plan.ts` |
| Handoffs | `playback-transition.ts` |
| Scheduler | `chunk-scheduler.ts` |
| Excerpt / URLs | `excerpt.ts` |
| Activity lookup | `activity-profile.ts` |
| Offline generation | `offline-activity.ts`, `npm run audio:activity` |
| Assets | `npm run audio:encode`, `npm run audio:chunks` |
| Transport / load UI | `src/store/playback-store.ts`, `listening-load-store.ts` |
| DEV overlay | `ListeningDiagnostics.tsx` (`D` or `?debug=true`) |
| Isolated scheduler harness | `/?chunk-poc` |
| Tests | `tests/listening-state.mjs`, `playback-plan.mjs`, `chunk-playback.mjs`, `activity-profile.mjs`, `offline-activity.mjs` |

Current excerpt: Beethoven 7 II (`beethoven-7th-2nd`). Master WAVs stay in `public/audio/.../raw/` and are gitignored.

---

## Out of scope

- Regenerating assets or changing chunk duration / Opus bitrate
- Solo / mute-the-rest mode
- Real-time RMS / AnalyserNode analysis
- EQ, compressors, limiters, loudness normalization
- Elaborate clock-drift correction
- Service workers, MSE, AudioWorklets, IndexedDB audio cache
- Deleting WAV masters or unused whole-file Opus stems until playback is fully validated
- Redesigning the map

---

## Open questions

- Is the 80 ms media/Web Audio offset stable, or does it accumulate?
- Are layered Opus mix + stems perceptually clean (phase, comb, doubled attacks)?
- Should `minActiveFocusGain` / background gains be retuned after longer listening?
- Physical iOS Safari behavior

---

## Validation

Automated tests cover plans, gains, boost curve, rests, family aggregation, transport math, and stale tokens. They cannot judge mix quality.

Listen after changes: orchestra bed; orchestra → strings/woodwinds; family → instrument and back; highlight → orchestra (no restart); quiet vs fortissimo vs rest; crescendo (intensity up, focus gain down); long overlay for drift/phase; seek near 15 s boundaries; pause/resume; rapid navigation.
