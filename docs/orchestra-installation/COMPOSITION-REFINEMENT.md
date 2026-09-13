# Prototype 01A composition comparison

## Active experiment: untouched polar lattice

Individual visibility is now configurable using top-level `hiddenNodeIds` in
`config.ts`, e.g. `['grid-r0-s0', 'grid-r2-s4']`. Indices are zero-based; with
13 spokes these correspond to visible reference numbers 1 and 31. Remove an ID
to restore its node. The default list is empty. `conductor` can also be listed,
and the existing `showConductor` switch is still respected.

Visibility is applied after generation. Hidden nodes retain positions, IDs,
numbering slots, and camera/floor bounds; neighbors do not move or renumber.
Their disks, labels, ghost twins, floor contributions, and picking instances
are omitted. Grid guides remain complete. Unknown IDs have no effect (useful
when comparing grids of different dimensions).

This supersedes the wedge/shared-seating experiments below. Geometry now comes
only from `generatePolarGrid()` in `seating.ts`, configured by `polarGrid` in
`config.ts`. All intersections are populated and every disk, including the
optional conductor marker, uses `nodeRadius: 0.24` before preset scaling.

| Parameter | Default |
| --- | --- |
| Inner radius | 2.7 |
| Ring count | 5 |
| Radial spacing | 1.128 |
| Derived outer radius | 7.212 |
| Fan start / end | -77.1° / +77.1° |
| Total fan angle | 154.2° |
| Spoke count | 13 |
| Angular step | 12.85° |
| Middle radius | 4.956 |
| Middle arc interval | approximately 1.112 units |

There are 65 lattice players plus the optional conductor marker. IDs use
`grid-r{ringIndex}-s{spokeIndex}` with zero-based indices. Each ring uses the
same angles, and radial increments are constant. Outer-ring arc spacing is
naturally larger than inner-ring spacing; there is no solver or row compression.

`createOrchestraPositions()` only adapts those points to the existing renderer,
using a neutral `grid` presentation group. It does not assign orchestra instruments.
Geometry is planar: no warp, jitter, missing positions, wedge fitting, or size
variation. Historical `composition` settings and `seating-data.ts` remain in the
repository but are not consumed by the active geometry. `composition.playerScale`
is set to uniform; active size is controlled solely by `polarGrid.nodeRadius`.

`polarGrid.monochromeGrid` defaults to true. No regional orchestral color mapping
is introduced. Floor/effect settings are not retuned; floor colors follow the
neutral grid rather than the previous section assignments.

To inspect construction, toggle development debug mode (D) with
`polarGrid.showGuides: true`. Guides show all rings and spokes converging at the
conductor origin. Normal presentation has no guides. Existing node labels remain
available, with sequential numbering in ring-major order.

Build and lint pass. All-preset checks verify all intersections, exact radii,
shared spokes, uniform sizes, deterministic IDs, configurable grid counts, and
independence from historical section/warp settings. Browser visual review remains
pending. No later hiding, semantic assignment, or variation stage was implemented.

## Current polar-wedge geometry (supersedes whole-ring angular distribution)

`composition.wedges` in `config.ts` now defines spatial subsections using `id`,
`sectionId`, optional `stringInstrument`, `startAngle`, `endAngle`, and zero-based
`rings`. These are geometry groups, not new instrument families. Central/rear
brass have separate spatial wedges while retaining the same family and colors.

| Wedge | Degrees from centerline | Rings (1-based) |
| --- | --- | --- |
| First violins | -77.1 to -48 | 1–4 |
| Second violins | -36 to -18 | 1–4 |
| Violas | 18 to 36 | 1–4 |
| Cellos | 48 to 77.1 | 1–3 |
| Double basses | 48 to 77.1 | 4 |
| Woodwinds | -11 to 11 | 2–3 |
| Central brass | -10 to 10 | 4 |
| Rear brass | 17 to 37 | 5 |
| Percussion | -38 to 2 | 5 |
| Keyboard / plucked | centered at -62 / -52 | 5 |

All five shared radii remain unchanged. Existing ring membership and player IDs
are read from `seatingRingSlots`; matching members in each wedge determine its
row counts. No removed players are restored. Null slots no longer stretch a
section's geometry: remaining players fill its wedge, prioritizing boundaries.

Every row with two or more players uses exact start/end spokes. Interior columns
are fractions between them (e.g. 0, 1/2, 1); the union of these fractions is a
shared angular-column map reused across rows. A tiny deterministic perturbation
applies once per interior column, never per row or to boundary columns. Thus
shared columns remain radial even with irregularity enabled.

Singleton rows cannot populate both edges. Second-violin singleton rows use the
start edge; the viola singleton uses the end edge (`singletonColumn: 0/1`).
Auxiliary singletons use their wedge centers. This preserves current counts.

Spacing is deliberately secondary: outer rows can have larger intervals and
different counts select different interior spokes. `targetPlayerSpacing` is now
a soft review reference, not an enforced optimizer. Tune start/end angles first,
then ring membership and row counts in seating data. Tune `angularJitter` for
interior variation; 0 removes it. Neighboring string wedges have 12-degree gaps,
providing clearance for the existing disk sizes on the inner ring. The central
opening accommodates the wind wedge on rings 2–3. These angles are experimental.

Development debug mode (D) now shows shared arcs and wedge boundary guides when
`showRingGuides` is true (default true, but debug itself remains off). Guides
follow the existing upright warped surface; exact radial alignment is defined in
the fan plane around `conductorOrigin`. They do not affect camera fitting and are
absent from normal presentation. Existing debug section labels are unchanged.

Counts, subtle sizes, colors, conductor, camera configuration, and floor-light
settings are preserved. The fan retains its outer +/-77.1-degree limits.
Build/lint and all-preset checks verify exact boundary angles, exact ring radii,
unchanged IDs/counts, deterministic layout, conductor visibility invariance, and
positive disk-edge clearances in the fan plane. Browser automation failed to
initialize; guides-off/on visual evaluation remains pending, not approved.

## Current shared-ring geometry (supersedes earlier spacing controls below)

`composition.rings` now defines five global radii: **2.7, 3.828, 4.956,
6.084, 7.212**, before preset scaling. Ring spacing is 1.128, with
`targetPlayerSpacing: 1.1`. Rings 1–4 span -77.1° to +77.1°; the occupied rear
arc spans -62° to +37°. The removed `centerPull`, `centerWidth`, `rearStart`,
`rearSpacing`, and boundary-only radius corrections no longer affect geometry.

`seatingRingSlots` in `seating-data.ts` assigns stable player IDs to each ring
in angular order, retaining null slots for previous removals. To change ring
count, edit this assignment list together with `composition.rings`. Per-section
counts and ranges come from their contiguous runs in these shared slot lists,
not independent local row generators. Existing node x/z fields are historical
reference coordinates, no longer the source of rendered positions.

| Ring | Players / sections |
| --- | --- |
| 1 | First violins 2, second violins 2, violas 2, cellos 2 |
| 2 | First violins 3, second violins 1, winds 3, violas 1, cellos 2 |
| 3 | First violins 2, second violins 1, winds 4, violas 2, cellos 3 |
| 4 | First violins 3, second violins 3, brass 3, violas 2, basses 5 |
| 5 | Keyboard 1, plucked 1, percussion 4, brass 3 |

Current counts are preserved: 56 nodes including conductor, with 36 strings
(10/7/7/7/5), reflecting subsequent user-requested removals. No players are restored.

Angular spacing starts from `targetPlayerSpacing / radius`, constrained to fill
97–100% of each configured angular range with the existing slots. This explicitly
prioritizes the established footprint over strict spacing. Approximate slot arc
lengths are 1.04, 1.03, 0.89, 0.91, and 1.51 units. Reserved gaps span multiple
intervals; the sparse rear row remains looser. `angularJitter: 0.025` permits tiny
deterministic tangential variation; there is no radial jitter. Bass slots retain
uniform increments. Exact target spacing and fixed counts cannot both fill every
existing range, so the target is a preference rather than an absolute constraint.

Enable `composition.showRingGuides` and development debug mode (D) to see thin
shared arcs. Guides use the same upright transform and warp as the players and
do not affect camera fitting. Colors, subtle sizing, camera settings, and floor
settings are unchanged. The floor follows the adjusted player projections.

Build/lint and all-preset checks pass: stable IDs/counts, exact ring radii,
determinism, conductor-visibility invariance, and no overlapping disk extents in
the fan plane. Visual evaluation from the perspective camera remains pending.

## Previous experiments (historical)

This is a reversible spatial experiment on the current implementation, not an
approval of the final seating, player appearance, or conductor representation.
The current disks, colors, motion, camera concept, and development tools are
preserved. No new product interaction is introduced.

## Configuration

Edit the baseline in `src/features/orchestra-installation/config.ts`; all three
existing presets inherit these experiments. `classical-wide` remains the default.

| Experiment | Configuration | Refined default / comparison |
| --- | --- | --- |
| Conductor object | `showConductor` | `true` / `false` |
| Player sizes | `composition.playerScale` | `subtle` / `uniform` / `original` |
| Reference radius | `composition.playerRadius` | `0.24`, before preset scaling |
| Subtle size blend | `composition.subtleVariation` | `0.35`; 0 is uniform, 1 is authored sizes |
| Central closure | `composition.centerPull` | `0.22`; 0 restores authored angles |
| Central adjustment width | `composition.centerWidth` | `3.5` canonical units; influence tapers toward the wings |
| Rear compression start | `composition.rearStart` | radius `5.1`, before preset scaling |
| Rear spacing multiplier | `composition.rearSpacing` | `0.82`; 1 restores authored radii |
| Floor comparison | `visuals.floor.reflections.mode` | `softened` / `original` |

The softened reflection exposes `strength` (0.07), `blur` (2), `resolution` (256),
and `distance` (3.5 canonical floor units). It uses a wider 25-tap Gaussian sample
pattern and fades away from the installation's floor depth. The original mode
restores the previous 9-tap reflection at strength 0.2, blur 0.6, resolution 512,
without the additional depth falloff. Existing light pools and shadows remain.
The extra blur samples do not introduce another render pass or dependency.

To restore baseline geometry, set `centerPull: 0`, `rearSpacing: 1`, and
`playerScale: 'original'`. These controls do not change node counts or numbering.
Conductor visibility does not change generated positions, framing bounds, camera
target, floor position, or mathematical origin. Hidden conductor geometry, ghosts,
number labels, and its floor pools are omitted; the debug origin aid remains.

## Geometry and limitations

The hand-edited `seating-data.ts` coordinates remain untouched. Adjustments are
applied in `seating.ts` before the existing upright-fan transform and surface warp.
Central angular compression retains the radial clearance around the conductor.
Rear compression shortens outer gaps without replacing the existing row rhythm
or forcing left/right symmetry. Player sizes blend toward a common radius; the
conductor retains its existing size in every mode.

The current data has section assignments and legacy node IDs, not a complete
instrument/subsection topology. This pass does not infer new instrument identities
from those IDs or move entire families into a new seating chart. Spacing controls
are spatial rather than per-instrument. The existing presets remain global scale
variants. A musically finer rearrangement would need explicit seating metadata.

Build and lint pass. Programmatic checks across all presets verify stable IDs and
counts, deterministic positions, uniform-scale behavior, conductor visibility
invariance, and positive front-facing node-edge gaps. Browser visual evaluation
of cohesion, projected spacing, and reflection softness remains required; these
design questions are not considered resolved.

## String-density follow-up

The current preferred size mode remains `subtle`; the other modes are retained
for comparison without further tuning. Strings now total 39: first violins 10,
second violins 8, violas 7, cellos 9, and double basses 5 (59 nodes overall).
Four interior positions from the first violins' two outer rows and one from the
violas' outer row were removed. Row endpoints and the original inner positions
remain, preserving the angular territory and width rather than contracting the
sections. First-violin rows contain 2/3/2/3 players; second violins 2/1/2/3;
violas 2/1/2/2. These retain the central wind cutouts and authored row rhythm.

The nine inner cello positions remain in 2/3/4 rows. The five former `cello-4-*`
positions are explicitly identified as double basses and retain equal angular
spacing on their outer arc. Stable IDs remain unchanged; on-screen sequential
numbers update with the smaller array. Source comments retain legacy references.
The generated positions now expose `stringInstrument` for these five subgroups.
Other sections, visual effects, and camera configuration are unchanged.

Build/lint and programmatic checks of counts, cello rows, bass spacing,
determinism, and the subtle default pass. Visual review remains pending.

## Two-scale floor-light experiment

The existing broad wash and softened reflection are preserved. A separate local
pool layer selects 32% of non-conductor players by stable ID ranking (currently
18 players). It uses compact, feathered ellipses at their floor projections,
with slight deterministic size/intensity variation. Unselected players add no
local pool. These are additive light patches, not mirrored player geometry.

Tune `visuals.floor.localPools` in `config.ts`:

- `enabled`: compare with the unchanged broad wash alone.
- `intensity`: local peak strength (default 0.06).
- `radius`: canonical world-space extent (0.65), with short finite falloff.
- `softness`: edge feathering from 0 to 1 (0.9).
- `density`: selected fraction from 0 to 1 (0.32).
- `groundOffset`: stage clearance (0.004; clamped above the other floor layers).

Broad wash strength/spread remain `lightSpill.strength` and
`lightSpill.radiusScale`. Reflection controls remain separate and unchanged.
The local layer shares player colors and existing section opacity/emphasis state.
It is instanced per participating section with no extra reflection capture,
textures, or dependencies. Geometry and numbering are unaffected.

Build/lint pass. Checks across all presets verify the 18 contributing players,
determinism, unchanged wash/shadow placement, and section-opacity propagation.
Visual hierarchy and softness still require browser review; defaults are experimental.
