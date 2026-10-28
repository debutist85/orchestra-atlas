# Liquid light orb study

Run `npm run dev` and open `/dev/liquid-orb`. This development-only route is lazy
loaded, skips navigation synchronization, and does not mount the orchestra map.
It connects the existing listening engine for synchronized music playback. The existing constellation material is unchanged.

## Technique

Each orb uses one camera-facing plane and one GLSL material. The comparison uses
one shared WebGL renderer and geometry, with five scissored views / draw calls. Up to eight analytic
radial crests sample continuous fields on a unit circle (no angular seam). Coupled
fields evolve at different rates, forming inward pleats and small outward
excursions. Independently gated crests accumulate light at overlaps. A hemisphere
mapping adds faint interior folds; one-sided diffusion suggests translucent silk
beneath each crest. Exponential distance falloff supplies local glow without
render targets or bloom passes. Exponential light rolloff and sRGB output keep
bright overlaps from clipping abruptly.

The parameter state belongs to React, while the renderer owns elapsed animation
time. Speed changes preserve phase. Pause preserves time while controls and resize
still redraw. Reset restores the base parameters, comparison controls, and starting phases,
preserving the user's pause preference. Reduced motion starts paused and changing the system
preference to reduced motion pauses it. Background tabs do not advance time.
The renderer disposes its geometry, material, observers and animation loop on exit.

## Reference defaults

| Control | Default |
|---|---:|
| Animation speed | 0.65 |
| Flow complexity | 1 |
| Flow distortion | 1 |
| Strand density | 5 |
| Strand thickness | 1 |
| Strand brightness | 1.2 |
| Internal folds | 0.18 |
| Interior ambient | 0.05 |
| Highlight concentration | 2.4 |
| Glow intensity | 0.65 |
| Glow radius | 1 |
| Orb opacity | 1 |
| Orb color | `#35c9ff` |

Values are artistic multipliers, not physical units. Higher highlight concentration
narrows the brightly illuminated portions of each strand. Density activates up to
eight crests. Opacity fades the result against the black study background.

## Reference and review status

The supplied `watery-orb.gif` has 63 frames, roughly 2.6 seconds per loop. Frames
0, 10, 20, 30, 40 and 50 were inspected. They show local inward pleats and shifting
overlaps rather than whole-object motion, an almost black center, faint folded
membranes, and a tight blue glow. The GIF is a local visual reference only; it is
not copied into the site and its reuse rights have not been determined.

TypeScript/build and lint were run. No browser was connected to the available
browser automation tool, so runtime GLSL compilation, rendered appearance,
interactive controls, animation smoothness and mobile layout still require browser
review. No visual match or measured frame rate is claimed. In particular, verify
that the procedural crests read as liquid folds rather than nested rings, that
bright overlaps remain selective, and that interior folds are visible but subtle.
The analytic technique does not reproduce the reference's actual fluid surface,
fine texture or true front/back occlusion.

Review at desktop and mobile sizes, at several animation moments, with pause,
reset, each control and reduced motion. Five orbs sit in one row on wide desktop screens. Smaller screens wrap to three,
two, or one column, keeping each orb square with controls below the comparison.

## Scaling assessment

The technique is a plausible candidate for smaller nodes, not a validated
60-instance solution. Cost is dominated by fragment shading: eight bounded field
iterations, trigonometric evaluations, and exponential glow falloffs per pixel.
The prototype caps device pixel ratio at 2. It allocates no geometry or simulation
objects per frame and uses no textures or extra render targets. The comparison
shares one WebGL context and caches tile positions on resize rather than measuring
the DOM every frame.

Before production integration, profile representative mobile GPUs. Opportunities
include a smaller fixed strand count for tiny nodes, eliminating interior folds
below a screen-size threshold, rendering tight billboards with instancing and
per-instance phase/color, and reducing pixel ratio. Sixty separate copies of this
600 CSS pixel canvas would be inappropriate; small instanced billboards have a
very different fill-rate budget. No orchestra integration is included here.


## State comparison

The route now compares the approved reference with dimmed, highlighted, playing,
and idle variants. These are experimental appearance mappings, not new production
map behavior. The shared material sliders and color apply to all five variants.
The shader itself is unchanged.

| State | Response relative to shared base |
|---|---|
| Reference | Unmodified |
| Dimmed | Opacity ×0.28, glow ×0.3, glow radius ×0.75, speed ×0.55 |
| Highlighted | Hover/focus or Active: glow up to ×3.5, glow radius ×1.65, brightness ×1.4 |
| Playing | Intensity 0→1: speed ×0.45→2, distortion ×0.55→1.6, complexity ×0.7→1.4, density ×0.5→1.6 (clamped 1–8), glow ×0.75→1.4 |
| Idle | Identical to Playing at intensity 0: speed ×0.45, distortion ×0.55, complexity ×0.7, density ×0.5 (clamped 1–8), glow ×0.75 |

Hover or keyboard-focus the highlighted orb. Click/tap it or use its Active button
to hold the state. Hover, focus and Active are combined, so it stays highlighted
until all three have released. Intensity and highlight transitions use exponential
smoothing with a faster rise than fall. Speed is integrated into each orb's own
phase; changing intensity never multiplies absolute elapsed time and jumps phase.
Fractional strand density fades strands into the existing shader rather than
switching whole strands abruptly.

Music activity profile is now the default intensity source. The existing
`PlaybackControls` supplies Play/Pause and seek for Beethoven 7 II on the shared
listening-engine clock. Choose the full-orchestra envelope (default) or an
instrument's calibrated envelope and onset gates. Instrument selection changes
only the visual profile; the full recording remains audible. Missing profile data
is reported explicitly, never replaced by a fabricated envelope.

The engine's `orchestraIntensity()` reads the profile at the current audio clock
minus output latency, matching the existing instrument-activity timing. Music
pause and instrument rests return the playing orb toward its zero-intensity idle
appearance through the existing attack/release response. Seeking snaps the intensity
to the destination without resetting the flowing material's phase.

Automatic demo and manual intensity remain available for comparison. Switching
away from music pauses playback. The demo is a smooth 14-second phrase with smaller
swells; manual intensity holds 0–100%. The current smoothed intensity is displayed
without screen-reader live announcements. Pause animation freezes the material and
intensity frame independently of audio playback. Reduced motion starts animation
paused; Resume animation explicitly opts into motion. Reset restores music mode,
full-orchestra profile, 50% manual value, inactive highlight and starting phases,
while preserving animation pause and the audio transport position/status.

The dev listening engine intentionally reads the activity JSON from local public
assets, even when audio comes from `VITE_MEDIA_URL`. The existing CDN activity
profile and chunk manifest were restored locally for this experiment:

- `public/audio/beethoven-7th-2nd/activity/beethoven-7th-2nd.json`
- `public/audio/beethoven-7th-2nd/stems/chunks/manifest.json`

These remain gitignored media assets. Their source is the same configured project
media CDN and excerpt paths, not newly generated analysis. Another checkout needs
the matching local profile (restored from the project's media store or generated
through the established offline pipeline). Audio chunks continue to resolve through
the existing `VITE_MEDIA_URL` configuration. No recording rights metadata or
musical content was changed.

State logic is in `src/features/liquid-orb/orb-states.ts`; rendering and interaction
are in `OrbComparison.tsx`; the page and shared controls are in `LiquidOrb.tsx`.
Run `node --experimental-strip-types tests/liquid-orb.mjs` to verify state contrast,
monotonic intensity response, bounded density, idle/zero-intensity equivalence and frame-rate-independent
attack/release, plus music-envelope interpolation, seek lookup, instrument gates
and paused activity. Build, lint and this focused check pass (lint retains existing map
warnings). Browser review remains pending because the preview tool has no connected
browser. Review hover/blur, keyboard focus, click/tap persistence, manual 0/50/100%,
automatic swells, Play/Pause, seek, orchestra/instrument profiles, source switching,
animation pause/reset, mobile wrapping and resizing while paused.


Music integration validation: the configured CDN serves the profile, manifest and
first full-orchestra AAC chunk. The focused tests pass. The broader `npm test`
suite stops on the downloaded profile's missing `chunks.stems.full_orchestra`
flags (the manifest includes that stem). The existing scheduler conservatively
loads chunks when a mask entry is absent; no flags were synthesized. Runtime
playback, audible synchronization and mobile interaction still need browser
review because no browser is connected to the automation tool.


Local playback fix: development `mediaUrl()` requests now use Vite's `/__media`
proxy when `VITE_MEDIA_URL` is configured. The bucket's manifest response did not
include a cross-origin access header for the local preview origin, so direct browser
requests failed despite successful command-line downloads. The proxy targets only
the configured media base and leaves production URLs unchanged. The manifest,
first full-orchestra chunk, and local profile were successfully fetched through
the development server after this change.


## Attack response

Attack response is enabled by default, with Strand amplitude response at 1×
(adjustable 0–2×). It affects only the playing orb. The existing intensity mapping
still controls sustained energy; a separate transient increases strand distortion
by up to 45% at default strength, or 90% at maximum strength. It changes local
fold amplitude without scaling the orb, adding brightness flashes or altering its
flow phase. The toggle and zero strength restore the pre-attack behavior.

`attack-response.ts` compares the selected activity envelope with its value 80 ms
earlier, rejecting rises below 0.02 and reaching full response at a rise of 0.2.
Instrument onset gates suppress rests and add a modest accent for quiet entries.
The full-orchestra envelope uses rises only, since it has no instrument gate.
Attack smoothing uses a 45/s rise and 8/s decay (roughly 22 ms and 125 ms time
constants). Repeated envelope rises can retrigger the response during a phrase.
No metronomic beat or tempo-driven pulse is added. The automatic demo uses the
same rise detector; manual mode supplies no artificial attacks.

The lookup shares the listening engine's latency-compensated `activityPosition()`
with the intensity lookup. Seek, track/source changes, reset, animation resume and
long frame gaps clear the held transient. Animation pause holds the current
response; disabling attack removes its effect even while paused. Reduced motion
continues to start the whole animation paused. Reset restores enabled/1×.

The source envelope is sampled at 50 ms, so this approximates articulation rather
than detecting every note onset in dense textures. Build and focused tests verify
rise detection, repeated accents, sustain/release rejection, smooth decay,
frame-rate independence, and amplitude-only application to the playing state.
Visual and audible tuning still requires browser review; the browser automation
surface remains unavailable in this session.
