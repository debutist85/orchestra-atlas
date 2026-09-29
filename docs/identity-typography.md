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

The existing navigation GSAP timeline softly resolves the canonical identity
and its ornament together. During zoom, the heading starts at 0.12em tracking
and 20% identity opacity, then tightens to its CSS spacing and full opacity
over the camera travel, sharing its start, duration and `travelEase` curve. Forced settling and cleanup remove inline tracking. Reduced motion and interrupted navigation use the
controller's existing settle/cleanup behavior. No separate animation clock.

Font provenance and upstream license: `public/fonts/cormorant-garamond/`.
This is a reversible visual experiment, not a replacement product specification.

Validation: production build and test suite pass; lint retains five existing
warnings. Browser screenshots reviewed for Orchestra, Strings and Violin at
1440×900, Violin at 390×844 and 320×568, and reduced-motion landscape at
844×390. Font loading and absence of horizontal document overflow checked.
Both variants reviewed on desktop; publication/design sign-off remains open.
