# Ghost twins — desired behavior (implementation prompt)

Canonical map navigation is also specified in [specs/orchestra-map.md](../../specs/orchestra-map.md). This document remains the source of truth for the ghost-twin effect itself.

Use this document as the source of truth when changing the ghost-twin effect. Implement the **desired musical behavior** below. Do not invent a new visual language, do not retune seating or camera, and do not treat the current code as correct if it conflicts with this spec.

The effect should feel like a contemporary cultural installation: restrained, spatial, and musical. It is **presence**, not particle spectacle.

---

## What it is

Each seated player (not the conductor, not grid helpers) can emit up to **three ghost twins**: soft, translucent billboards that drift a short distance from the node, like a quiet plasma or smoke plume.

The twins are not a second orchestra and not a playback visualization. They say: *this group is alive in the current view.*

Constraints:

- No large floor blob.
- No licensed audio invented to drive the effect.
- Deterministic per-node seeds. The wave must look the same on reload for the same time offset.
- Respect `prefers-reduced-motion`: strength is **zero**. No drifting twins.
- Domain rules (who is active, how strong) live in data/functions, not in Three.js objects.
- Do not change node positions, polar grid, visibility mask, section assignments, family labels as geometry, or camera framing.

---

## Navigation levels

Canonical navigation is:

1. **Orchestra** — whole map (`/`)
2. **Family** — one section family (`/strings`, `/woodwinds`, …)
3. **Instrument** — one instrument group (`/woodwinds/bassoon`)

Ghosts follow **canonical navigation**, not hover, not the audible mix, not label presentation delay.

---

## Who emits

| View | Active nodes | Silent nodes |
| --- | --- | --- |
| Orchestra | Every idle player | Conductor, hidden/grid |
| Family | Every idle player in that family | All other families |
| Instrument | Only that instrument’s players | Sibling instruments in the family, and every other family |

“Group” means the **instrument group** at level 3 (Bassoon, not “all woodwinds”) and the **family** at level 2 (all woodwinds, not flute alone).

If Bassoon is selected, Flute / Oboe / Clarinet must not keep running the wave after they have dimmed away. If Strings is selected, Woodwinds / Brass / … must not keep running the wave.

---

## The wave (all levels share one clock)

The wave is a **continuous overlapping plume**, not a staggered one-shot and not a 2-puff-then-pause loop.

For each active node, three twins fire in sequence:

1. Twin A emits.
2. Before A dies, twin B emits.
3. Before B dies, twin C emits.
4. When A dies, A has already re-emitted (or is about to). The field never gaps.

Implementation shape that satisfies this:

- `T` = delay between twin emissions (`intervalSeconds`)
- `D` = plume duration (`durationSeconds`)
- `D > 2T` so three slots overlap and the period `3T` never goes empty
- Clock: `time + seed * period + twinIndex * T`
- Envelope: a single smooth rise/fall (sin²) while `elapsed < D`

**Cadence is the same at orchestra, family, and instrument.** Do not remake the clock when the zoom level changes. Intensity and travel distance may change; **phase, direction, and cycle must not jump**.

Current installed cadence (keep unless the design is explicitly retuned):

- `T = 0.85s`
- `D = 1.9s`
- 3 twins per node
- Travel offset is modest (idle `0.85`, family `1.05`, instrument `1.15` node radii). Do not let plumes travel far.

Each new cycle may pick a new random direction from the node seed + cycle. That is the “spreading” feel. Do not reset that RNG because navigation changed.

---

## Intensity by level

Same speed. Different weight.

| Level | Look | Opacity (current) |
| --- | --- | --- |
| Orchestra | Soft, ambient, all players | `0.12` |
| Family | Clearer, still restrained, whole family | `0.22` |
| Instrument | Strongest, still not loud, selected group only | `0.28` |

Instrument must stay **stronger than family**, family stronger than idle. Do not return to the earlier “selected 0.4 / faster T” look. Level 3 was too hot and too fast.

Tint stays the node’s instrument/section color. Ghosts are not a second palette.

---

## Interaction with zoom

This is the important part. Ghosts are **not** a separate animation that snaps on click.

### Shared clock across travel

Zooming orchestra → family → instrument → back must **not** restart, re-seed, or re-phase the wave. Existing plumes on nodes that **remain active** keep drifting. Only opacity / travel distance eases if the level changes for that node.

A jump or flicker of plume position is a bug.

### Presence follows the nodes

Node dimming already rides the navigation travel curve (about 760ms, `power2.inOut`, same timeline as the camera). Ghosts on nodes that are becoming inactive must **fade with those nodes**, then disappear.

- When a group starts losing the zoom (siblings dimming, other families dimming), their twins ease down on that same brightness curve.
- When the node has reached rest dim, ghost presence is **0**. No leftover puffs, no quiet afterglow loop.
- Do not hard-cut at pointer-down. The earlier instant cutoff felt like a switch, not a zoom.
- Do not keep the full wave running on dimmed nodes for the whole travel and then pop off at the end. Presence tracks the dim, then hits zero.

### Zooming back is the opposite

Withdraw (instrument → family, family → orchestra) **fades ghosts in** on the groups that become active again, together with the nodes brightening. They appear into the **already running** clock — they do not start a new first-puff from zero time.

### Who changes when

**Orchestra → family (e.g. Woodwinds)**

- Woodwind nodes stay active. Clock continues. Weight eases idle → family.
- Other families fade out with their dim, then vanish.

**Family → instrument (e.g. Bassoon)**

- Bassoon stays active. Clock continues. Weight eases family → instrument (slightly stronger, slightly more travel, **same T and D**).
- Other woodwinds fade out with their dim, then vanish.
- Already-silent families stay silent.

**Instrument → family**

- Bassoon eases instrument → family weight. Clock continues.
- Other woodwinds fade in with their lift.

**Family → orchestra**

- The family eases family → idle. Clock continues.
- Other families fade in with their lift.

### Landing on a URL

Reloading `/woodwinds` or `/woodwinds/bassoon` must show the correct ghosts **on the first frame**:

- `/` — idle wave on every player
- `/woodwinds` — family wave on woodwinds only
- `/woodwinds/bassoon` — instrument wave on bassoon only

Do not wait for a blend from zero. Do not show idle ghosts on a zoomed URL. Reduced-motion first load still snaps camera and ghost presence to the destination.

---

## Hover, listening, Explore

- Hover does not start or stop ghosts.
- The zoom-derived audible mix does not start or stop ghosts.
- Explore is reserved and must not invent a fourth ghost mode.
- Playback is a separate system. Ghosts stay time-based from the scene clock, not from audio FFT.

---

## Technical expectations (for an implementer)

These are requirements, not a mandated file layout.

1. **Who is on** is a pure function of navigation + node (`ghostPresentFor` / `ghostFocusFor` / `ghostIdleFor`). Tests must keep covering: orchestra all players; family only that family; instrument only that instrument; conductor never.
2. **How visible** during travel is a 0–1 live weight derived from the **same values the nodes already use** (per-node navigation focus and section emphasis). When the node is fully dim, live weight is 0 and the instance must not draw.
3. **Per-instance data must actually be per instance.** A shared section `InstancedMesh` still has flute and bassoon in one draw. If custom attributes are not instanced, every woodwind will show Bassoon’s wave. Prefer a channel Three.js instancing already guarantees (e.g. `instanceColor` + scale-to-zero when live is 0).
4. **One wave timing** in the shader. Do not mix interval/duration by zoom mode. Mixing remaps `clock` and jumps the plumes.
5. **Hold the outgoing look while fading.** A dimming clarinet should fade as a *family* plume, not snap to idle parameters or to nothing mid-puff, then disappear when live hits 0.
6. First-load / rebuild may snap live weight to the destination. In-session zoom must not snap outgoing nodes to 0 at travel start.

---

## Acceptance checks

Perform these in the browser. Automated tests do not replace this.

1. Orchestra: every player has a quiet continuous wave. Conductor has none.
2. Click Woodwinds: other families fade out with the dim and stay gone. Woodwinds keep the wave, a bit stronger, no position jump.
3. Click Bassoon: flute, oboe, clarinet fade out with the dim and stay gone. Only Bassoon keeps the wave, a bit stronger, same speed, no position jump.
4. Back to Woodwinds: the other woodwinds fade in with the nodes, into the existing wave.
5. Back to Orchestra: everyone fades back in. No restart pop.
6. Reload `/woodwinds` and `/woodwinds/bassoon`: correct set of ghosts from frame one.
7. Reduced motion: no ghosts.
8. Rapidly interrupt zooms: no leftover twins on a dimmed group; no freeze; no clock reset on the group that stays selected.

---

## Do not

- Do not change seating geometry, polar grid, or camera rig to “fix” ghosts.
- Do not gate ghosts on the old idle-animation cluster/glint windows.
- Do not use a slower or faster emit rate at level 3.
- Do not keep dimmed siblings emitting after they have reached rest.
- Do not hard-cut outgoing ghosts at click.
- Do not add React Router or a new dependency for this.
- Do not expand the MVP (no Explore-level ghost mode, no audio-reactive ghosts).

---

## Prompt (short)

You can paste this block into a later chat:

```text
Implement or fix ghost twins from docs/orchestra-map/ghost-twins.md.

Ghosts are 3 overlapping smoke/plasma twins per player. Same wave clock at every zoom (T=0.85, D=1.9, D>2T). Never remap the clock on navigation.

Orchestra: all players, quiet. Family: that family only, medium. Instrument: that instrument only, slightly stronger, same speed.

Outgoing groups fade with the node dimming curve, then disappear. Incoming groups fade in with the nodes into the existing wave. Remaining active groups must not jump or flicker.

Reload of /family or /family/instrument must show the correct ghosts on the first frame. Reduced motion: no ghosts. Do not change seating or camera.
```
