# Spatial identity experiment

The single semantic identity heading lives in the orchestra stage. The shell
keeps a 50px header on desktop and mobile for functional controls.
At the full-orchestra level it reads “Orchestra Atlas”: “Atlas” occupies a
smaller, widely tracked second line in the self-hosted Cormorant Garamond face.
Both lines share the navigation tracking motion.

Stage compositions are configured in `src/features/orchestra-map/identity-layout.ts`.
`identityLayouts.orchestra`, `.families[familyId]`, and `.instruments[instrumentId]`
each define independent `portrait` and `landscape` settings. IDs match navigation,
not displayed names. Every family and instrument has an entry. `familyLayout()` and
`instrumentLayout()` accept optional `portrait` and `landscape` objects; each
can override any combination of `anchor`, `left`, `top`, and `fontSize`.

Each setting has `anchor`, `left`, `top`, and `fontSize`. Choose `top-left`,
`top-center`, `top-right`, `bottom-left`, `bottom-center`, or `bottom-right`.
The heading's **center** is placed at that point on the projected
node bounding box, then shifted by `left` and `top`. These offsets are
percentages of that box's width and height respectively: `left: '10%'` moves
right by 10% of its width, and `top: '-25%'` moves up by 25% of its height.
The type requires percentage strings, so viewport units cannot silently change
the relative position across screen sizes. For example:

```ts
cello: instrumentLayout({
  portrait: {
    anchor: 'top-right',
    left: '-10%',
    top: '-25%',
    fontSize: 'clamp(90px, 28vw, 160px)',
  },
}),
```

At Orchestra level the box covers all visible player nodes; at family level it
covers the selected family's nodes; at instrument level it covers the selected
instrument's nodes. Node radii are included, so anchors sit on the luminous
constellation's outer bounds. The scene reprojects the box during camera travel
and after resizing. CSS switches portrait/landscape settings on rotation.
Typography remains clipped inside the stage. Placement is
intentional, with no node avoidance; keep header, conductor, Explore, and footer
clear when tuning.

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
