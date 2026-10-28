# Audio analysis and review

Open `/dev/activity-review` with `npm run dev`, or follow **Review audio analysis**
from the orb prototype. This route is development-only. It does not connect the
production listening engine or change the current activity profile.

## Review a recording

1. Select the track whose current profile should be compared. Choose a local WAV
   and declare its provenance, or use **Analyze playback asset** to fetch the
   corresponding whole-file AAC. It prefers the local cache, then R2, with the
   older Opus file as a fallback.
2. Inspect the source and timeline. The chart shares one time axis across combined
   channel waveform peaks, raw RMS/peak dBFS, a log-frequency spectrogram, spectral
   onset strength, sounding spans, and the current profile's normalized intensity.
   The existing profile is a separate violet trace, not a raw loudness measurement.
   Choosing an arbitrary local recording does not establish its alignment with the
   catalog profile: verify it is the same performance, export and time origin.
3. Play the source with **Onset clicks**, use **Clicks only**, or loop the visible
   region. Source and click audio share one AudioContext clock. The cursor accounts
   for output latency. Seek with the slider or click the chart; keyboard users have
   the same seek and candidate controls outside canvas.
4. Review quiet entries, repeated notes, sustained sounds, accents and rests.
   Select a candidate in the visible region, accept/reject it, edit its timestamp,
   or add a missed onset at the playhead. Rejected candidates remain in the report
   but do not sound. The bulk timing correction moves marker timestamps only.
5. Adjust detection settings if needed. This runs event detection in a worker
   against the same raw measurements and replaces candidate edits. Raw RMS and
   spectral measurements are not changed or smoothed by those settings.
6. Add review notes and export **analysis + review JSON**. Importing the JSON later
   restores the measurements, parameters, provenance and edits. Attach the matching
   audio to audition it: the source bytes must match the report's SHA-256 hash.

The available R2 assets are M4A files under
`portfolio-media/orchestra-atlas/audio/beethoven-7th-2nd/stems/opus/`. All 15 catalog
files have been cached under `public/audio/beethoven-7th-2nd/stems/opus/` locally.
The review page analyzes those M4A files directly: no WAV conversion is needed.
The ignored `review/r2-downloads.json` records URLs, byte counts, SHA-256 hashes and
R2 ETags. Cached files are preferred over network requests.

The original WAV directory is empty, and the configured raw WAV URLs return 404.
These supplied M4A files are labelled **Encoded playback asset**. They are valid
sources for reviewing what the application actually plays; they are not labelled
as lossless masters. The provenance selector is a human declaration, not a licensing
or source-authenticity finding. Local files stay in the browser; they are not uploaded.

## Offline master reports

RIFF PCM/IEEE-float WAVs require no decoder dependency. M4As are also supported:
macOS uses its built-in `afconvert`; other platforms require FFmpeg. Encoded files
are decoded to temporary float PCM and remain labelled encoded sources:

```sh
npm run audio:review -- --input /path/to/cello.wav --track cello --kind master --output /tmp/cello-review.json
```

Analyze a directory sequentially (directory mode declares these WAVs to be masters):

```sh
npm run audio:review -- --directory public/audio/beethoven-7th-2nd/stems/raw --output public/audio/beethoven-7th-2nd/review
```

Optional `--gate-db -65` and `--sensitivity 3` tune event detection. Use `--help` for
usage. For a non-catalog filename, supply `--track` in single-file mode so the UI
can compare the right current profile. Directory mode recognizes `full_orchestra`
and `contrabass` aliases. Reports under `public/audio/` remain gitignored.

The command reads masters without editing, normalizing, trimming or re-encoding
them. It analyzes one decoded file at a time, holding its channel arrays in memory;
for very long/high-rate masters, memory use scales with decoded duration. RF64 and
compressed WAV formats are not supported by this reader and fail explicitly.
Browser import supports whatever formats the browser can decode. Browser decoding
may resample to its AudioContext rate, which is recorded in the report; CLI WAV
analysis retains the original sample rate. Both record the original file hash.

## Measurements and candidate detection

The shared `src/features/activity-review/analysis.ts` runs in a browser worker and
in the Node CLI. Defaults:

- 10 ms requested hop, rounded to exact whole samples. The exported hop is the
  actual sample-count/sample-rate ratio, so long excerpts do not accumulate drift.
- A Hann window with the power-of-two frame size nearest 40 ms. Frame timestamps
  denote the window center, with zero padding at the recording boundaries. The
  window support still limits temporal precision; a 10 ms grid does not imply
  independently verified 10 ms onset accuracy.
- Unsmoothened RMS and peak energy, in dBFS, without percentile normalization or
  clipping to an artistic 0–1 scale. Channel powers are averaged; opposing stereo
  phases cannot cancel activity as they would in a naive mono mixdown.
- A log-frequency display spectrogram (48 bands, every fourth frame), quantized
  only for the chart. RMS, peaks and onset strength retain separate raw series.
- Positive log-magnitude spectral flux against a local maximum of the previous
  spectrum. Adjacent-bin suppression reduces responses to small frequency shifts.
  This follows the spectral-difference family of methods, rather than deriving
  note attacks from a smoothed loudness envelope. See
  [librosa's onset-strength definition](https://librosa.org/doc/0.11.0/generated/librosa.onset.onset_strength.html).
- Onset candidates are local peaks above an adaptive local median/MAD threshold,
  subject to an energy floor, minimum event gap, and a falling-energy veto to
  suppress release edges. This is a diagnostic detector, not a universal note
  transcriber. Bowed tones, tremolo, reverb and overlapping notes require review.
- Sounding spans use a configurable absolute RMS threshold, 3 dB hysteresis, gap
  merging and minimum duration. The spectrogram and source audition help reveal
  reverb/bleed and quiet entries that a threshold alone cannot classify reliably.

Keep sounding activity, dynamics and attacks independent. The click-audition
workflow is also described in [Essentia's onset review tutorial](https://essentia.upf.edu/tutorial_rhythm_onsetdetection.html).
A report includes algorithm version, source identity, all parameters, raw features,
candidates, reviewer edits and notes. Exporting one does **not** replace the orb's
profile or the production scheduler's chunk mask. A reviewed replacement format
and migration can follow once the errors and required calibration are understood.

## Validation

```sh
node --experimental-strip-types tests/activity-review.mjs
node --experimental-strip-types tests/review-player.mjs
npm run build
npm run lint
```

The fixtures check RMS calibration, opposite-phase stereo, silence, sounding spans,
known attack timing, constant-energy pitch changes, event rejection at releases,
report validation/edit round trips, and CLI output without changing master bytes.
The review player test checks source/click clock alignment, lookahead, loop timing,
seek and resource cleanup. Headless Chrome review covers browser-worker analysis,
marker edits/export, report import and hash matching, playback and mobile overflow.
Desktop/mobile screenshots were inspected. A derived 7:22 cello asset was also
analyzed end-to-end. These checks do not establish musical ground truth or audible
accuracy on every output device; human source comparison is the purpose of the page.

For the browser regression, first run `npm run test:audio-review` to generate the
owned temporary audio fixture, start Vite and a dedicated Chrome instance with
remote debugging, then run `node tests/activity-review-browser.mjs`. Configure
`REVIEW_CDP` (default `http://127.0.0.1:9224`) and `REVIEW_URL` (default
`http://127.0.0.1:4174/dev/activity-review`) for that instance. It uses a real pointer
gesture for source playback, intercepts report downloads for assertions, and writes
review screenshots to the system temporary directory.

## Run revised profiling for all cached assets

```sh
npm run audio:profile-all
```

This uses the excerpt catalog to analyze all 15 cached M4As sequentially (11
instruments, three distinct family mixes and the full orchestra; percussion reuses
its configured timpani source). Each report is written to
`public/audio/beethoven-7th-2nd/review/offline/`. Temporary decoded PCM files are
removed, and original encoded assets stay unchanged.

A separate `activity/beethoven-7th-2nd.revised.json` is generated with 10 ms raw-RMS
intensity envelopes, new sounding spans and explicit onset candidates. Individual
normalization uses the sounding 1st-percentile floor with a 3 dB margin and a
99.9th-percentile ceiling with 3 dB headroom, leaving room above normal peaks instead
of flattening the top 5%. Shared envelopes use one consistent range across stems.
No attack/release smoothing is baked into these dynamics. The original chunk mask
is copied without changes. Onsets and source hashes are included, and metadata
explicitly records that detections are automatic and not human-reviewed.

The command does not replace `activity/beethoven-7th-2nd.json`. The orb prototype
loads the separate revised file for visuals, including its explicit onset candidates;
production playback gains and the full map continue to use the original profile. `review/offline/summary.json` lists per-instrument candidate counts,
sounding spans and calibration ranges. Import individual `*-review.json` reports
in the review page with their matching M4As to inspect any suspicious passages.

## Compact visual runtime profile

Keep the detailed `beethoven-7th-2nd.json` as the 10 ms analysis source. Run:

```sh
npm run audio:compact
```

This writes `beethoven-7th-2nd.runtime.json` next to the source, plus `.json.gz`
and `.json.br` variants. The map and orb prototype use the runtime URL configured
in `excerpt.ts`; local audio gain scheduling continues to use `_legacy.json`.
Intensity arrays use 20 ms samples rounded to three decimals. Gates, explicit
onsets (including their strength), chunk flags and provenance retain full precision.
The output records the source SHA-256; the source is never overwritten.

For a freshly generated revised analysis, specify the source and stable runtime
output explicitly:

```sh
npm run audio:compact -- --input public/audio/beethoven-7th-2nd/activity/beethoven-7th-2nd.revised.json --output public/audio/beethoven-7th-2nd/activity/beethoven-7th-2nd.runtime.json
```

The current asset shrinks from 5,667,894 to 2,545,909 bytes (55.1%); gzip is
502,424 bytes and Brotli is 355,633 bytes. Across 486,145 instrument samples,
mean absolute reconstruction error is 0.00083 on the 0–1 intensity scale.
Individual fast transients can differ more (maximum 0.329); their exact onset
pulses and sounding gates remain intact. Keep the full-resolution source for review.

Generated audio assets remain ignored by Git and must be published separately to
the configured media host. The default script only prepares local files. Serve
`runtime.json` as JSON, with server-side gzip/Brotli negotiation, or configure the
host to serve the matching precompressed variant with `Content-Encoding: gzip`
or `br` and `Vary: Accept-Encoding`. Merely uploading `.gz`/`.br` siblings does
not enable negotiation. No R2 objects or hosting settings are changed by the script.

Validate the compactor with `node tests/compact-activity.mjs`.
