# alphaTab evaluation POC

Open `/?score-poc` after `npm run dev`, or build and use `npm run preview`. This is an isolated evaluation, not a production notation decision.

## Implementation

- alphaTab **1.8.4**, pinned in package.json/lockfile. `App.tsx` lazily imports the POC; the adapter separately imports alphaTab. Production map, navigation, playback, Listening, audio assets, activity profiles, and source MusicXML are unchanged.
- `src/features/score-poc/ScorePoc.tsx` places the existing map/player beside the score, with test scopes, optional navigation mirroring, transport seek, explicit audio offset, cursor following, and diagnostics.
- `selection.ts` maps the 19 XML part IDs explicitly. Catalog families compose instrument mappings; Atlas's actual bass ID is `doubleBass`. Orchestra = 19 parts, Strings = P14–P19, Cello = P17/P18. Instruments absent from this score show an empty state.
- `score-adapter.ts` fetches the original MusicXML as bytes, checks its part-list order, and uses semantic `renderTracks`. alphaTab preserves part-list order but does not expose the original XML IDs on Track, so this version-specific ordering bridge is explicit and validated. No per-part CSS hiding.
- Default SVG renderer, page layout, lazy fragment rendering, unscaled notation with a 760px minimum width and local scrolling. No Canvas comparison: this version's browser path is SVG; adding another renderer would expand the spike.
- Store subscriptions project logical seconds to the external-media output's **milliseconds**. MIDI/tick data provide score timing, but alphaTab never starts playback or owns a clock. No HTML audio currentTime or chunk-source timing is used. Cursor interpolation and smooth scrolling are disabled. The diagnostic rAF loop measures performance only.
- Clicking a note/rest resolves its measure's first occurrence in the tick lookup, integrates tempo changes into seconds, applies the visible offset, then calls `playbackStore.seek`. Existing Listening handles rebuilding playback. Native alphaTab seek/range interaction is disabled. The keyboard-accessible seek slider provides a non-pointer alternative; notation itself is not a complete accessible score reader.
- External-media mode still instantiates alphaTab's silent MIDI/timing player, needed for its cursor/tick lookup. Its packaged JS includes synthesis implementation, but no audio output, soundfont, audio worklet, or worker resource is started/loaded by this POC. Rendering workers are deliberately disabled for a small initial integration; measured main-thread stalls make worker evaluation a likely next experiment.

## Measurements

Production Vite preview, macOS, Headless Chrome **153.0.0.0**, desktop viewport **1440 × 857**, software WebGL (SwiftShader); mobile emulation **320 × 568**. Local delivery, no throttling. These are individual observations, not benchmark percentiles or physical-phone results. Software WebGL severely limits the usefulness of frame-rate conclusions.

| Desktop observation | Time |
|---|---:|
| Dynamic alphaTab import | 106.2 ms |
| Fetch full XML | 98.3 ms |
| Initial layout complete | 2,144.1 ms |
| First rendered fragment | 4,209.0 ms |
| Orchestra → Strings | 467.5 ms |
| Strings → Cello | 55.4 ms |
| Cello → Strings | 215.4 ms |
| Strings → Orchestra | 584.0 ms |
| Cello → Orchestra | 463.7 ms |

A subsequent load measured import 68.3ms, fetch 53.4ms, layout 3,162.6ms, first fragment 3,168.1ms. Results vary with map load, visible score fragments, viewport, and cache state. At the narrow viewport, one subsequent Orchestra → Strings → Cello sequence measured **82.0ms / 22.7ms**, with Cello → Orchestra **386.0ms**. Scope timings measure layout completion, not every page painting.

Initial layout and visible fragment completion are different events: with lazy rendering the former can precede the latter. The fragment event is an approximate first-usable proxy, not a browser-paint timestamp. There is intentionally no claim to measure painting all 278 measures. Only explicit scope requests enter the transition timings; viewport relayouts do not.

Observed full-score viewport: 2 SVGs / 1,946 descendants. Cello: 3 SVGs / 580 descendants; Strings: 2 SVGs / 839 descendants. Counts depend on lazy fragments and scrolling. Heap observations ranged roughly **65–159 MiB** across switches; GC was not controlled, and this does not establish leak-freedom. A **1,228ms** initial main-thread long task and substantial scope stalls were observed. Desktop frame samples were sometimes **2–5 FPS** with SwiftShader; later/narrow samples reached ~25 FPS. This environment does not establish smooth native-GPU or mobile performance, nor isolate alphaTab from Three.js costs.

### Production loading cost

Vite build sizes (decimal kB):

| Asset | Raw | Gzip |
|---|---:|---:|
| alphaTab JS chunk | 1,204.83 | 288.47 |
| POC UI/adapter JS | ~10.7 | ~4.1 |
| Bravura WOFF2 | 313.34 | already compressed |
| POC CSS | 1.56 | 0.64 |
| Normal entry JS, before | 987.40 | 276.07 |
| Normal entry JS, after | 989.14 | 276.82 |

The initial JS increase is **1.74kB raw / 0.75kB gzip**, including lazy-route support, not alphaTab itself. Normal CSS changed from 20.16 to 20.19kB through utility scanning. Browser resource entries on `/` contained **no ScorePoc, alphaTab, Bravura, or MusicXML requests**. Entering the POC loads those resources. No WASM, soundfont, worker, or audio-worklet assets were requested. Static license files are also included in the build, without automatic requests.

XML is **4,209,563 bytes** unchanged on disk/build. Preview's observed encoded response was **200,066 bytes** (compression depends on hosting). Observed encoded alphaTab response was 286,819 bytes, font 313,348 bytes; these browser response sizes differ from Vite's gzip estimates.

## Timing and musical alignment

alphaTab imports **278 measures**, quarter-note tempo **76**, duration **438.95s**. Atlas audio duration is **441.95s**. No automatic scaling fits one duration to the other; the score clamps at its end while Atlas continues. The ~3-second difference may include an audio tail, but duration alone does not prove that.

A read-only inspection of the existing 50ms activity profile compared flute entrances after rests against P1's XML timing (threshold 0.12 in the already normalized combined flute envelope). No audio analysis/profile regeneration was performed:

| Measure | XML onset | Existing activity crossing |
|---|---:|---:|
| 73 | 114.474s | 114.500s |
| 135 | 211.579s | 211.650s |
| 210 | 330.000s | 330.100s |
| 263 | 413.684s | 413.750s |

Other sampled isolated entrances at measures 93, 110, 149, 233, and 251 were also within 0.10s. This is sufficient to evaluate following at **zero offset**, with no growing discrepancy apparent in these samples. It is coarse evidence: a combined part envelope, attacks, smoothing, release tails, and 50ms quantization prevent precise alignment judgments. A candidate at measure 254 was already active before the search window (another part/release may contribute), so it is not a usable onset measurement. No acoustic or complete note-by-note alignment audit is claimed. Positive offset in the UI means the audio event occurs later than the corresponding notation event.

API projection delta was **0.000s** in pause, playback, and seek checks. That compares values sampled together; the score diagnostic refreshes once per second while the visible Atlas transport updates more often. This proves transport projection, not musical accuracy or frame latency.

## Validation and findings

- Imported all expected 19 track names; selected only six string parts and both cello parts; repeated the requested six-scope sequence while playing and paused, without stale track selections or displayed errors.
- Existing map controls started audio; score advanced from logical transport. Pause held both positions at 16.70s across repeated observations; resume advanced correctly.
- Seek slider tests at 120, 300, 420, and 0s projected matching positions, including backwards seeks. Clicking a note in cello measure 5 sought Atlas to **6.32s** (4 × 2 quarter notes at 76 BPM), with no second transport.
- Optional mirror followed map Strings → Cello, reporting 6/19 then 2/19 tracks.
- At 320 × 568, page width remained 320px, score viewport ~301px, notation 760px. Local horizontal and vertical scroll reached 200px / 400px. All three scopes rendered. POC-only paint containment prevents the existing map overlay from escaping over the mobile score.
- `npm test` passed the existing suite; `npm run test:score` passed mapping/family/navigation/absent-part checks; production build passed; lint passed with four existing warnings; `git diff --check` passed.

No fatal MusicXML import failure was observed. Inspected opening full-score and cello notation rendered clefs, rests, notes, ties, accidentals, dynamics, and both cello staves. Abbreviated vertical track labels and dense full-score systems need design/engraving review; small isolated text markings in the opening full score also warrant source comparison. This is **not** a certified transcription/engraving audit of all 278 measures.

Primary production risks are the large lazy payload, first-render main-thread stall, slower full-orchestra scope changes, API coupling through generated MIDI timing and XML track order, and unverified physical-device performance. Browser automation cannot certify audible glitch-freedom. Physical mobile, native-GPU, screen-reader, full engraving, and sustained musical listening reviews remain necessary before any production decision. The POC deliberately does not add alignment infrastructure, optimized score assets, or production navigation/audio changes.

## Sources and notices

- [alphaTab external-media mode](https://www2.alphatab.net/docs/reference/types/playermode/), [external-position output](https://docs.alphatab.net/docs/reference/types/synth/iexternalmediasynthoutput/), and [timePosition API](https://alphatab.net/docs/reference/api/timeposition). Installed 1.8.4 type declarations/source were checked for actual behavior and units.
- alphaTab package source: https://github.com/CoderLine/alphaTab (version 1.8.4). Package license and bundled notices copied unmodified to `public/score-poc/alphaTab-LICENSE.txt` and `alphaTab-NOTICES.txt` (upstream notice header contains template placeholders).
- Bravura font supplied by alphaTab; [Steinberg upstream OFL notice](https://github.com/steinbergmedia/bravura/blob/master/LICENSE.txt) retained in `public/score-poc/Bravura-LICENSE.txt`. No font modification. Upstream license fetched 2026-09-23; this is provenance retention, not final legal review.
- Existing [score/audio provenance](licensing/beethoven-7-score-audio-provenance.md) is unchanged.
