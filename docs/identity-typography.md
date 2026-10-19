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
settings for `edge`, `align`, `side`, `gap`, `fontSize`, and `figure`. Shared defaults are `edge: "top"`, `align: "center"`, `side: "outside"`,
and `gap: 16`; individual captions can override each orientation.

```ts
export const celloIdentityLayout = instrumentLayout({
  portrait: {
    edge: 'top',
    align: 'center',
    side: 'outside',
    gap: 16,
    fontSize: 'clamp(76px, 23vmin, 100px)',
  },
})
```

`edge` selects `top`, `bottom`, `left`, `right`, or `center`.
`align` selects `start`, `center`, or `end` **along** that edge:

- Top/bottom: align caption left edges, centers, or right edges to the box.
- Left/right: align caption top edges, centers, or bottom edges to the box.

For example, `edge: 'top', align: 'start'` sits above/below the top boundary
with left edges aligned; `edge: 'left', align: 'start'` sits beside the left
boundary with top edges aligned. No diagonal corner offset is implied.

`side` selects `outside` (default) or `inside`. `gap` acts only perpendicular
to the selected edge, separating it from the corresponding caption edge by
16 CSS pixels by default. Outside references are caption bottom for top,
caption top for bottom, caption right for left, and caption left for right.
Inside uses the opposite caption edges. `edge: 'center'` centers both axes and
ignores `align`, `side`, and `gap`.

The measured group includes parent link, title, hint, and retry content.
Projected node circles including radii define the constellation bounds;
decorative artwork is excluded. The old `placement` property is removed.

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
Outside top/bottom captions are capped at half the safe height; left/right
captions at half the safe width. The other axis uses the full safe span, so a
tiny viewport still leaves space for the constellation. Long captions wrap or scroll within that space. Back-link space
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

`gap` is the CSS-pixel separation between the selected bounding-box edge and
the corresponding edge of the complete caption group (including Back and hint).
It does not change caption width/height limits. Outside gap extends away from
the constellation; inside gap insets the caption from the selected box edge.
