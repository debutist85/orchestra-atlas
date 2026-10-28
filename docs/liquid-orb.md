# Liquid light orb study

Run `npm run dev` and open `/dev/liquid-orb`. This development-only route is lazy
loaded, skips navigation synchronization, and does not mount the orchestra map.
It connects the existing listening engine for synchronized music playback.
The current prototype is a filled orb that responds to music through brightness
and optional bloom. The constellation shares the filled disc and eclipse corona. See “Brightness-only music response” below for the current prototype controls.

## Legacy strand technique (constellation)

Each orb uses one camera-facing plane and one GLSL material. The prototype uses
one WebGL renderer, scene, geometry and material, with one draw call. Up to eight analytic
radial crests sample continuous fields on a unit circle (no angular seam). Coupled
fields evolve at different rates, forming inward pleats and small outward
excursions. Independently gated crests accumulate light at overlaps. A hemisphere
mapping adds faint interior folds; one-sided diffusion suggests translucent silk
beneath each crest. Exponential distance falloff supplies local glow without
render targets or bloom passes. Exponential light rolloff and sRGB output keep
bright overlaps from clipping abruptly.

The parameter state belongs to React, while the renderer owns elapsed animation
time. Speed changes preserve phase. Pause preserves time while controls and resize
still redraw. Reset restores the base parameters, state controls, and starting phase,
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
| Interior brightness | 0.9 (current config) |
| Highlight concentration | 2.4 |
| Glow intensity | 0.65 |
| Glow radius | 1 |
| Orb opacity | 1 |
| Orb color | `#35c9ff` |

Values are artistic multipliers, not physical units. Higher highlight concentration
narrows the brightly illuminated portions of each strand. Density activates up to
eight crests. Opacity fades the result against the black study background.
Interior brightness controls the ambient light inside the orb independently of
strand brightness and glow, from 0 to 2. Its initial value comes from
`liquidOrbConfig.material.ambient`; it updates all preview sizes and states,
including while animation is paused.

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
reset, each control and reduced motion. One square orb scales to the available width, capped at 520 CSS pixels, with a
keyboard-accessible state selector above and tuning controls below.

## Scaling assessment

The technique is a plausible candidate for smaller nodes, not a validated
60-instance solution. Cost is dominated by fragment shading: eight bounded field
iterations, trigonometric evaluations, and exponential glow falloffs per pixel.
The prototype caps device pixel ratio at 2. It allocates no geometry or simulation
objects per frame and uses no textures or extra render targets. The preview
uses one WebGL context and measures its square viewport on resize rather than
measuring the DOM every frame.

Before production integration, profile representative mobile GPUs. Opportunities
include a smaller fixed strand count for tiny nodes, eliminating interior folds
below a screen-size threshold, rendering tight billboards with instancing and
per-instance phase/color, and reducing pixel ratio. Sixty separate copies of this
600 CSS pixel canvas would be inappropriate; small instanced billboards have a
very different fill-rate budget. The first constellation integration now uses these instanced billboards; device profiling remains pending.


## State preview

The route shows one persistent orb. The Orb state selector applies Reference,
Dimmed, Highlighted, Selected, Playing or Idle to that same material instance. It opens in
Idle; Reset to Reference restores Reference. State changes preserve the animation
phase and material settings. Selecting Highlighted applies the full highlight
without requiring hover or a separate active toggle.
The prototype and constellation share the fragment shader; the constellation adds instanced attributes, camera-facing geometry and transparent compositing.

| State | Response relative to shared base |
|---|---|
| Reference | Unmodified |
| Dimmed | Opacity ×0.28, glow ×0.3, glow radius ×0.75, speed ×0.55 |
| Highlighted | Selected: glow ×4, glow radius ×1.65, brightness ×1.5 (current config) |
| Playing | Intensity 0→1: speed ×0.45→2, distortion ×0.55→1.6, complexity ×0.7→1.4, density ×0.5→1.6 (clamped 1–8), glow ×0.75→1.4 |
| Idle | Same motion as Dimmed: speed ×0.55 with base distortion, complexity and density; retains opacity and glow ×0.75 |

Intensity and highlight transitions use exponential smoothing with a faster rise
than fall. Speed is integrated into the orb's persistent phase; changing state or
intensity never multiplies absolute elapsed time and jumps phase.
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
pause and instrument rests return the playing orb toward its zero-intensity
appearance through the existing attack/release response. Seeking snaps the intensity
to the destination without resetting the flowing material's phase.

Automatic demo and manual intensity remain available for comparison. Switching
away from music pauses playback. The demo is a smooth 14-second phrase with smaller
swells; manual intensity holds 0–100%. The current smoothed intensity is displayed
without screen-reader live announcements. Pause animation freezes the material and
intensity frame independently of audio playback. Reduced motion starts animation
paused; Resume animation explicitly opts into motion. Reset restores music mode,
full-orchestra profile, 50% manual value, Reference state and starting phase,
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
are in `OrbPreview.tsx`; the page and shared controls are in `LiquidOrb.tsx`.
Run `node --experimental-strip-types tests/liquid-orb.mjs` to verify state contrast,
monotonic intensity response, bounded density, idle/dimmed motion equivalence and frame-rate-independent
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


## Constellation integration

The main map now renders liquid orbs for every visible player/grid node, using
`src/features/orchestra-map/three/liquid-node-material.ts`. The conductor retains
its existing playback-marker appearance. The production scene uses one instanced
billboard batch per existing section, not one material/draw call per instrument.
Both the isolated study and the map share the procedural fragment shader.

All exposed orb material values and visual response settings live in
`src/features/liquid-orb/config.ts`:

- `material`: speed, complexity, distortion, density, strand thickness/brightness,
  folds, ambient, highlights, glow intensity/radius, opacity and preview color.
- `states`: dimmed multipliers, highlight boosts, and intensity ranges. Idle
  shares dimmed motion while preserving its own brightness and glow.
- `response`: intensity rise/release smoothing.
- `attack`: enablement, strength/limit, amplitude, profile lookback, rise threshold,
  entry accent limits and attack/release rates.
- `rendering`: maximum strands (shader loop limit), billboard half-extent,
  dark-volume alpha, initial phase and per-node phase spread.
- `constellation`: integration switch, legacy effect switches and reduced-motion
  intensity. Set `enabled: false` to restore the legacy material on a scene rebuild.

Player colors are intentionally supplied by the existing authored palette in
`orchestra-map/config.ts`: node color band, then instrument color, then section
color. They are shared with the semantic miniature; the cyan material color is
only the preview default. No player colors were invented or changed.

The legacy disk/sphere meshes remain invisible picking/capture proxies. Their
instance transforms and palette buffers are shared by the visible orbs, preserving
seats, radii, loading motion, camera framing and navigation targets. The glow quad
cannot enlarge hit areas. The visual shader is camera-facing, uses premultiplied
transparency for dark interiors over the atmospheric video, and leaves final
color-space conversion to the scene's existing OutputPass.

Playback activity and attack signals are bridged into the scene by OrchestraMap,
outside WebGL. Each node follows its own instrument's onset gate/intensity and
attack profile at the audible clock. Flow phase is accumulated independently per
node with a stable ID-derived offset. Hover and navigation focus combine with
music, while unrelated nodes dim. Reduced motion freezes flow, disables attack
and uses the configured static intensity. The legacy ghost waves and white activity
rings are disabled for liquid nodes by default to avoid stacking visual effects.
The old material/effect implementations remain available behind the integration
switch; instrument exploration's semantic miniature remains unchanged.

Validation: build, lint (existing warnings only), `node --experimental-strip-types
tests/liquid-orb.mjs`, and `node tests/liquid-constellation.mjs` pass. The latter
checks signature palette sharing, instance transforms, invisible-proxy picking,
idle/playback/attack/hover/dimming, reveal opacity, transparency and reduced motion.
The full regression suite still stops at the CDN profile's missing full-orchestra
chunk-mask entry, described above. There is no connected browser in this session;
GLSL compilation on a GPU, appearance over the video, mobile frame rate, zoom and
highlight feel require browser/device review. No measured performance claim is made.

## Prototype sizes

The Orb size selector applies Small · Violin, Medium · Cello, or Large · Timpani
to the same preview instance. The fixed square stage keeps the size difference
visible without moving the surrounding controls. Diameters use the full map’s authored radius ratios (Violin 0.8, Cello 1.2,
Timpani 1.5 times the base node radius), magnified equally for inspection; Medium is the default and reset size. These are visual size
references, independent of the chosen music profile and color. All three sizes
support every state and preserve animation phase, tuning, and playback.

The reference instruments are set in `liquidOrbConfig.prototype.sizes` in
`config.ts`; `size-presets.ts` resolves their first visible nodes through the same
`createOrchestraPositions` function as the map. Tune node sizes in the map config
to update both views. The stage
remains responsive on mobile. The constellation retains its authored node sizes.

## Filled node and bloom study

The current prototype uses an even color fill with the legacy node's
peak-normalized emission with the orb's state, size, color and playback controls.
The Filled node controls expose base brightness, active/music brightness boosts,
and bloom strength/radius/threshold. Music bloom response optionally scales bloom with intensity and defaults to zero.
Reset restores the material settings.

Defaults live in `liquidOrbConfig.filled`. Highlighted increases fill
emission; Playing scales fill brightness with the smoothed activity profile.
Bloom strength defaults to 0.1, with an additive 0.1 boost for Highlighted.
Selected doubles brightness and retains the base bloom strength; it changes no
other material parameter. Music has no bloom-strength boost. The shared bloom
slider adjusts the base, and Highlight bloom boost controls the extra highlight glow. Dimmed reduces opacity. Zero fill brightness removes the body, and zero bloom
strength removes the halo. Slider edits work while animation is paused. Instrument
color and activity selection remain independent of the size reference.

The preview uses a half-float EffectComposer target, UnrealBloomPass and OutputPass
from the existing Three.js dependency. Emission stays in linear HDR until bloom
extraction, followed by ACES tone mapping and display conversion. Peak-channel
extraction follows the main map so saturated hues can bloom. The size selector
scales the projected orb inside the full stage, leaving space for its halo. All
postprocessing resources are disposed on exit. The additional passes are confined
to the single-orb prototype; the constellation's current material is preserved.

Validation includes build, lint (existing map warnings), focused orb-state tests,
and headless Chrome/SwiftShader rendering checks for sizes, state persistence,
mobile layout, fill/shadow/active controls, bloom controls, optional strands, and
manual music response while paused. Physical-device GPU performance and audible
playback synchronization still require device review.

The Instrument color selector uses the constellation's authored instrument palette,
including Violin 1/2 color bands and section-color fallbacks. A swatch shows the
chosen color. Color selection preserves state, size, music profile and tuning;
editing the color picker switches the selector to Custom color. Reset restores
the configured reference color.

The filled node has no interior shading; the body uses a uniform color and emission.

The Zoom slider scales every size equally from 0.1× to 3× (default 1.25×), retaining
map radius proportions and animation phase. It updates while paused; reset restores
1.25×. Its range and default live in `liquidOrbConfig.prototype.zoom`. High zoom
intentionally crops the node to the fixed preview stage.

## Brightness-only music response

The prototype has no emitted waves, strands or contour deformation.
Playing scales fill emission with shaped music dynamics and brief brightness accents; rests and playback pause
return it to the base brightness. The existing intensity profile, color selector,
size proportions, zoom, selected state and highlight controls remain available.

`filled.musicBrightness` controls intensity-driven brightness.
`musicBloomBoost` optionally adds bloom strength with intensity; it defaults to 0.
Base bloom remains 0.1, Highlighted adds 0.1, and Selected doubles brightness without
adding bloom strength. Increased emission can still cross the bloom threshold.
Manual and automatic intensity modes remain available for tuning. Reduced motion
starts the visual response paused. Shader and UI no longer include ripple controls
or history; the preview renders only the uniform filled body and postprocessing.

The production constellation retains its existing strand material and activity
mapping while the filled-node appearance is being tuned in the prototype.

## Nuanced brightness and visual lead

The prototype samples the activity profile at the existing output-latency-compensated
clock plus a configurable visual lead (60 ms by default). This advances visual
feedback only; audio scheduling and the main map timing remain unchanged. Instrument
gates, intensity and attack lookup all use that same shifted time. Paused playback,
missing profiles and times beyond the recording produce no activity.

`brightnessResponse` defines the response. Defaults are a 20 ms brightness
rise and 90 ms release, a compressive power curve of 0.7, and a bounded attack pulse
with strength 0.35, 8 ms rise and 140 ms decay. Accents derive from short activity
rises / gated entries, rather than a metronome. The shorter smoothing preserves
phrasing; the curve lifts quiet playing and keeps louder passages graded. Optional music bloom follows the same shaped signal and
still defaults to zero.

Music response controls expose visual lead (0–200 ms), dynamics contrast, attack
pulse strength, brightness rise/release and pulse decay. Manual mode has no
fabricated attacks; automatic mode can derive them from its illustrative envelope.
Animation pause holds both envelopes while static controls still update. Seek,
source/track changes, reset, state changes, resume and long frame gaps clear stale
accent energy. Reduced motion retains the existing paused start.

`tests/liquid-brightness.mjs` checks exact lead timing, gate-aware entries, repeated
accents, sustain/rest rejection, missing/end data, fast rise, decay, contrast,
paused state and frame-rate independence. Perceptual timing should be tuned with
the recording on the target audio device; the lead slider is provided for this.

For diagnosing the source profile, use the [activity analysis review workflow](activity-review.md)
at `/dev/activity-review`. The prototype links to it beside Music intensity.

The prototype now loads `activity/beethoven-7th-2nd.revised.json` locally for its
visual response. Explicit spectral onset candidates drive finite 60 ms attack
windows before the brightness pulse envelope; it no longer estimates attacks from
RMS rises when a revised onset list exists. Timing lead is applied to both dynamics
and onset lookup. Missing revised data is reported instead of silently falling back.
Audio gain/scheduling and the main constellation keep the original profile.

The Activity to visualize selector also controls prototype audition. Choosing an
instrument isolates its authored stem with the full-orchestra bed at zero gain;
Full orchestra restores the full mix. Playback position and the shared audio clock
are preserved across stem changes. The prototype owns an explicit selection override
until it unmounts, including during engine loading, and restores normal navigation
selection on cleanup. The production map's quiet-bed focus behavior is unchanged.

## White activity rim

In Playing, a white luminous corona grows outward from the node’s fixed disc radius.
Its thickness follows the normalized dynamics/attack signal. A local white
halo and the existing bloom supply shine. The foreground disc is composited after
bloom, before tone mapping, so the corona’s glow cannot wash into its interior.
The instrument-colored fill remains even.
Silence fades the rim away. Other prototype states retain their existing fill and
highlight treatment. The main map still uses its existing material.

The visual signal is bounded to 0–1. The default power curve is 0.7 (lifting quiet
values instead of suppressing them with a square), and attack accents use only the
remaining headroom: `level + (1 - level) * accent`. This prevents a loud note and a
strong attack from adding beyond the visual ceiling. The default music fill boost
is reduced to 0.35 so rim thickness carries most of the activity feedback.

`rim` exposes quiet/loud thickness (orb-radius units), shine and local
glow, all with sliders under White activity rim. Dynamics curve and pulse strength
remain adjustable. The curve is a display mapping over the revised per-track
profile; it does not modify audio gains or rewrite the raw measurements. Browser
checks measure increasing white-rim area at quiet/medium/loud levels, absence at
zero, paused tuning and mobile layout. Unit tests cover quiet lifting, graded loud
response and bounded combined accents.

The eclipse effect uses an extra foreground-disc pass only in the prototype. It
shares the geometry, uniforms and view scale with the rear light pass. Its coverage
mask occludes inward bloom spill, while the corona thickness and halo grow only
outside the disc. Antialiasing remains at the silhouette edge. The material and
pass are disposed together with the preview renderer.

Current response defaults from the tuned prototype: visual lead 20 ms, dynamics
curve 1.05, attack pulse strength 1, brightness rise 20 ms, brightness release
90 ms and pulse decay 100 ms. Reset restores these values. Curves below 1 remain
available to lift quiet passages; bounded accent headroom applies at every curve.


## Full-map filled discs and eclipse corona

The constellation now shares the prototype's `filled`, `rim` and
`brightnessResponse` settings at the root of `liquidOrbConfig`. Prototype-only
zoom and size controls remain under `prototype`. Instrument signature colors,
authored seat radii, loading transforms and invisible picking proxies are preserved.
Hover adds brightness and 0.08 bloom; selection doubles fill brightness without
adding bloom. Music drives bounded white corona thickness and modest fill brightness.
There are no strands, ripples or interior shading in the map material.

An additional instanced HDR pass packs bloom emission in RGB and foreground-disc
coverage in alpha. Bloom is masked by that coverage so it shines outward from
behind the discs, while empty canvas pixels remain transparent over the video.
Reduced motion suppresses musical pulses. Seeking resets transient envelopes.

Visual playback requests the revised 10 ms profile using the audible engine clock
and shared 20 ms lead. Audio gain scheduling keeps its original profile. Development
loads the locally generated revised JSON; deployment requests it from the media host.
If absent, the map uses the original profile and displays a status notice. The
revised asset must be published to the configured media host separately.


The map redraws instanced foreground discs after bloom and before tone mapping,
using the same matrices, palette and brightness attributes. This keeps dimmed
surfaces uniformly colored beside bright neighbors; local glow and bloom remain
behind their silhouettes. Disc RGB and alpha both use antialiased coverage under
premultiplied blending, keeping the surrounding video transparent.


Bloom uses a compact halo in both the prototype and map: `filled.bloomRadius`
is 0.2, with fine-to-broad blur contributions controlled by
`rendering.bloomLayerWeights` (1, 0.85, 0.45, 0.15, 0.03). Broad layers are suppressed
so highlighting keeps a close glow instead of washing across neighboring nodes.
Brightness, bloom strength and rim thickness are unchanged by this adjustment.


The analytic corona fades radially to zero before the billboard boundary.
The same faded corona supplies visible RGB, alpha coverage and HDR bloom
emission, avoiding a square cutoff when the activity rim is thick or bright.

The visual runtime URL now points to `beethoven-7th-2nd.runtime.json`, generated
by `npm run audio:compact`. The full-resolution `.json` remains the analysis
source. See [activity-review.md](activity-review.md#compact-visual-runtime-profile)
for regeneration, measured fidelity and compressed deployment artifacts.
