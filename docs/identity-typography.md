# Spatial identity experiment

The single semantic identity heading lives in the orchestra stage. The shell
keeps a 50px header on desktop and mobile for functional controls.
At the full-orchestra level it reads “Orchestra Atlas”: “Atlas” occupies a
smaller, widely tracked second line in the self-hosted Cormorant Garamond face.
Both lines share the navigation tracking motion. Family captions are set in capitals.

Stage compositions are registered by `src/features/orchestra-map/identity-layout.ts`.
Authored configurations live under its sibling `identity-layout/` directory:
each instrument has a module in `identity-layout/instruments/`, and family
configurations live in `identity-layout/families/`. Each defines independent
`portrait` and `landscape` settings. IDs match navigation, not displayed names.
`familyLayout()` and `instrumentLayout()` accept independent portrait and landscape
settings for `placement`, `side`, `gap`, `fontSize`, and `figure`. All family and
instrument captions currently inherit the shared `top-center` placement and
16px gap; per-caption positioning overrides have been reset.

```ts
export const celloIdentityLayout = instrumentLayout({
  portrait: {
    placement: 'top-center',
    side: 'outside',
    gap: 16,
    fontSize: 'clamp(76px, 23vmin, 100px)',
  },
})
```

`placement` accepts `top-left`, `top-center`, `top-right`, `bottom-left`,
`bottom-center`, `bottom-right`, or `center`. It positions the **whole caption**:
parent link, title, exploration/preparation hint, and any retry message. The
selected constellation's projected node circles (including radii) define its
bounding box. Decorative artwork does not contribute to the caption measurement.

`side` explicitly selects `outside` (default) or `inside`; it never flips
automatically. Outside placement uses the caption's bottom edge for `top`,
right edge for `left`, left edge for `right`, and top edge for `bottom`.
Inside placement uses the opposite caption edges against those same box edges.
Centered axes use the caption's center. Corners apply both axes; `center` centers
both axes regardless of side. `gap` separates the chosen edges by 16px by default,
extending outward or inward according to `side`.

Caption positions are never clamped to the stage, including inside and center
placement. Outside captions use adaptive camera framing; inside and center keep
their constellation-relative anchors. Text-size limits remain active in all modes.

The safe area excludes the measured header and footer, plus 16px on every side.
The complete group is remeasured when its size changes, including fonts,
loading copy, and keyboard focus, and follows the projected bounds during camera
travel and resize. Long headings wrap within the safe width. On unusually short
viewports the text stack can scroll within the safe height; artwork stays
outside that scroll container. For outside placement, the camera reserves the measured caption and gap before
fitting the selected lights. It may pull back and shift the group to keep both
lights and text inside the safe area. Full-map and inside framing are unchanged.
Outside text stacks are capped at half the safe height (and half the width for
corner placements), less the gap, so a tiny viewport still leaves space for the
constellation. Long captions wrap or scroll within that space. Back-link space
is reserved from the start of zoom; it fades with the title but remains disabled until zoom settles.

The full-orchestra identity is the exception: it retains its original `anchor`,
`left`, and `top` percentage configuration in `identity-layout/families.ts`.
Those fields do not position nested captions. Family and instrument files no
longer use percentage position offsets.

An optional `figure` on a portrait or landscape layout draws decorative
artwork behind that caption. Landscape and portrait each have their
own figure. `width`, `height`, `x`, `y`, `rotation`, `scale`, `opacity`, and
`mask` are the art-direction fields. Set `width`, `height`, or both; the unset
dimension is `auto`, so the image keeps its aspect ratio. Other omitted fields
use the generic defaults (centered, unrotated, scale 1, opacity 0.3, no mask).
`x` and `y` move the artwork from the caption center. `mask` is a CSS `mask-image` value applied in
the page, not baked into the file. It uses alpha masking, so black keeps the
artwork and transparent removes it. Opacity sets how strong the visible part
is; the mask decides where it falls away. Each orientation can use a different
mask. Violin starts with an elliptical field near the title, tighter on portrait. Artwork may crop beyond the stage; the caption group remains inside its safe area. The heading remains the accessible
name, and the image is hidden from assistive technology. It fades with the
existing identity transition. Strings, woodwinds, brass, and percussion families,
plus the instruments that have artwork files, provide a WebP figure for both
orientations. Violin, viola, cello, contrabass, and horn are independently
art-directed; the remaining instruments start from the violin figure so their
placement can be tuned per file.

The renderer is opaque and uses bloom postprocessing. The DOM heading sits
above the canvas and uses CSS `mix-blend-mode: screen` inside an isolated stage.
Bright nodes remain visually prominent across the lettering while heading
opacity and tracking animate normally. This is compositing, not true WebGL
occlusion: darker node pixels do not mask letters.
No renderer, shader, bloom, geometry, or color changes are required. There is
one semantic heading; the temporary departing caption is visual only, and
typography ignores pointer events.

During navigation, the incoming heading fades from 20% to full opacity while
tracking contracts from 0.18em to natural. The outgoing visual caption fades
out while its tracking expands. Both share the camera's
start, duration, and `power2.inOut` easing. Tracking endpoints are expressed
in pixels, using the incoming font size for the 0.18em start, so spacing
interpolates continuously. Forced settlement and reduced motion resolve the
heading immediately. The heading uses the `identity-city-lights` animation
and its existing reduced-motion behavior. Annotation safe bounds now locate the actual
header independently of the heading's parent; Explore still avoids the title.

Validation: production build, test suite and lint pass (five existing lint
warnings and the existing build chunk-size warning). Browser automation could
not start in this environment; desktop/mobile visual tuning and compositing
performance on physical devices still need review.

During camera zoom travel, both caption groups follow their projected anchors
without position clamping against the stage. No position clamp is applied after
the transition settles either. Outside destination
framing still reserves caption space before the transition starts.
