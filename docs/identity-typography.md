# Spatial identity experiment

The default is now a single semantic heading inside the stage. Compare any
route with `?identity=stage` (default) and `?identity=header` (previous layout).
The URL override is presentation configuration in `identity-typography.ts`,
not navigation/store state. Existing typography variants remain available in
header mode. The shell keeps its existing 80px desktop / 70px mobile header.

Stage compositions are configured in `src/features/orchestra-map/identity-layout.ts`.
`identityLayouts.orchestra`, `.families[familyId]`, and `.instruments[instrumentId]`
each define independent `portrait` and `landscape` settings. IDs match navigation,
not displayed names. Every family and instrument has an entry, including those
that currently share defaults. Replace a default factory call with explicit values,
or spread its result to override just one orientation:

```ts
cello: {
  ...instrumentLayout(),
  portrait: {
    top: '30%',
    left: '45%',
    fontSize: 'clamp(90px, 28vw, 160px)',
    anchor: 'center',
  },
},
```

`top` / `left` accept CSS lengths or percentages of the full viewport-sized stage
(including header/footer space). `anchor` selects the heading's left edge, center,
or right edge at that horizontal position; `top` locates its top edge. `fontSize`
accepts any CSS size expression. Keep header, conductor, Explore and footer clear
when tuning; placement is deliberate and has no automatic node avoidance.

CSS chooses portrait when viewport height is at least its width, and landscape
otherwise, updating automatically on rotation. The former width/short-height
positioning overrides have been removed; landscape defaults use height-aware
font-size caps instead. Typography stays clipped inside the stage. Functional
controls, header comparison mode and navigation transitions are unchanged.

The renderer is opaque and uses bloom postprocessing. The DOM heading sits
above the canvas and uses CSS `mix-blend-mode: screen` inside an isolated stage.
Bright nodes remain visually prominent across the lettering while heading
opacity and tracking animate normally. This is compositing, not true WebGL
occlusion: darker node pixels do not mask letters.
No renderer, shader, bloom, geometry, or color changes are required. There is
one heading, no decorative duplicate, and typography ignores pointer events.

The navigation timeline applies the same 20%-to-full fade and
0.18em-to-natural tracking contraction as the former header heading. The stage
heading shares the camera's start, duration, and `power2.inOut` easing.
Tracking endpoints are both expressed in pixels, using the incoming heading
font size for the original 0.18em start, so spacing interpolates continuously. Forced settlement and reduced motion still resolve the
heading immediately. Ambient light uses one low-opacity shadow instead of four large shadows;
reduced motion disables it. Annotation safe bounds now locate the actual
header independently of the heading's parent; Explore still avoids the title.

Validation: production build, test suite and lint pass (five existing lint
warnings and the existing build chunk-size warning). Browser automation could
not start in this environment; desktop/mobile visual tuning and compositing
performance on physical devices still need review.

---

# Identity typography experiment

Compare the same route with `?typography=editorial` (default) and
`?typography=expressive-initial`. Try `/`, `/strings`, and `/strings/violin`.
The existing route projection preserves the choice during navigation.

`src/features/orchestra-map/identity-typography.ts` owns the local default and
validated URL override; this is presentation configuration, not store state.
`--font-identity` and the `.map-identity-*` rules in `src/styles/global.css`
control the font, scale, position and opacity. The single heading component
also handles the other existing catalog names without changing their content.

The expressive variant keeps the complete readable heading and adds one
aria-hidden, non-interactive initial in a viewport-clipped absolute layer.
It grows from root to instrument depth and moves toward the left viewport edge.
The ornament is absent below 351px width or at 450px height and below.
The heading remains in the existing header; controls retain system sans-serif.
No italic font is loaded in this first comparison.

The existing navigation GSAP timeline animates the heading from 20% opacity
and 0.18em tracking to full opacity and natural spacing across camera travel.
Forced settling and cleanup remove inline tracking. Reduced motion and
interrupted navigation use the controller's existing settle/cleanup behavior.
No separate animation clock.
The resting heading has zero letter spacing and grows to almost fill the
80px desktop header; mobile uses a responsive size within its 70px header.
Multiword titles use smaller mobile sizes, and single-word titles step down
below 336px width so names remain within the header controls.

The identity heading has a five-second ambient color and text-shadow cycle
adapted from the requested City Nights example. It starts 750ms after the
launch UI becomes ready or navigation settles. NavigationMotion sets
`data-traveling` during every zoom to stop the cycle, then clears it on
settlement and disposal. Reduced motion leaves the heading static. The serif,
heading geometry, tracking transition, and functional UI text are unchanged.
The moving amber and cyan shadows use 30% and 55% peak opacity respectively
so their pass remains visible against the dark header.

Font provenance and upstream license: `public/fonts/cormorant-garamond/`.
This is a reversible visual experiment, not a replacement product specification.

Validation: production build and test suite pass; lint retains five existing
warnings. Browser screenshots reviewed for Orchestra, Strings and Violin at
1440×900, Violin at 390×844 and 320×568, and reduced-motion landscape at
844×390. Font loading and absence of horizontal document overflow checked.
Both variants reviewed on desktop; publication/design sign-off remains open.
