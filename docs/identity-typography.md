# Spatial identity experiment

The single semantic identity heading lives in the orchestra stage. The shell
keeps a 50px header on desktop and mobile for functional controls.
At the full-orchestra level it reads “Orchestra Atlas”: “Atlas” occupies a
smaller, widely tracked second line in the self-hosted Cormorant Garamond face.
Both lines share the navigation tracking motion.

Stage compositions are registered by `src/features/orchestra-map/identity-layout.ts`.
Authored configurations live under its sibling `identity-layout/` directory:
each instrument has a module in `identity-layout/instruments/`, and family
configurations live in `identity-layout/families/`. Each defines independent
`portrait` and `landscape` settings. IDs match navigation, not displayed names.
`familyLayout()` and `instrumentLayout()` accept optional `portrait` and
`landscape` objects; each can override any combination of `anchor`, `left`,
`top`, `fontSize`, and `figure`.

Each setting has `anchor`, `left`, `top`, and `fontSize`. Choose `top-left`,
`top-center`, `top-right`, `bottom-left`, `bottom-center`, or `bottom-right`.
The heading's **center** is placed at that point on the projected
node bounding box, then shifted by `left` and `top`. A percentage is of that
box: `left: '10%'` moves right by 10% of its width, and `top: '-25%'` moves
up by 25% of its height. `clamp()`, `min()`, `max()`, and `calc()` are also
accepted, so an offset can mix box percentages with viewport units. CSS adds
the offset to the anchor (`calc(anchor + offset)`). For example:

```ts
cello: instrumentLayout({
  portrait: {
    anchor: 'top-right',
    left: '-10%',
    top: 'clamp(-40%, -8vmin, -10%)',
    fontSize: 'clamp(90px, 28vmin, 160px)',
  },
}),
```

At Orchestra level the box covers all visible player nodes; at family level it
covers the selected family's nodes; at instrument level it covers the selected
instrument's nodes. Node radii are included, so anchors sit on the luminous
constellation's outer bounds. The scene reprojects the box during camera travel
and after resizing. CSS switches portrait/landscape settings on rotation.
Typography remains clipped inside the stage. Placement is
intentional, with no node avoidance; keep conductor, Explore, and footer
clear when tuning. The scene then keeps the caption between the header and
footer bars, correcting through `--identity-shift-y`. A caption too tall for
that area stays against the header.

An optional `figure` on a portrait or landscape layout draws decorative
artwork behind that caption. Landscape and portrait each have their
own figure. `width`, `x`, `y`, `rotation`, `scale`, `opacity`, and `mask` are
the art-direction fields; omitted ones use the generic defaults (42vw wide,
centered, unrotated, scale 1, opacity 0.3, no mask). `x` and `y` move the
artwork from the caption center. `mask` is a CSS `mask-image` value applied in
the page, not baked into the file. It uses alpha masking, so black keeps the
artwork and transparent removes it. Opacity sets how strong the visible part
is; the mask decides where it falls away. Each orientation can use a different
mask. Violin starts with an elliptical field near the title, tighter on portrait. Artwork may crop past the header and footer; the caption type does not. The heading remains the accessible
name, and the image is hidden from assistive technology. It fades with the
existing identity transition. Violin, Viola, Cello, Contrabass, Horn, and the
Strings family currently provide independently art-directed WebP artwork for
both orientations.

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
