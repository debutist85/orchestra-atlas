# Instrument color system

`src/theme/instrument-colors.ts` owns the explicit `accent`, `surface`, `text`
and `muted` tokens supplied for instrument exploration. The map config references
those accents directly; its instrument and violin-band color values are unchanged.
Section/family palettes remain independent.

`colorsForInstrument()` maps application IDs to palette IDs explicitly:
`doubleBass` → `contrabass`, `violin1` → `violin`, and `violin2` → `secondViolins`.
The catalog still has one violin exploration entry. Generic unused IDs such as
`keyboard`, `piano` and `percussion` receive a neutral fallback, without inventing
new instrument identities or mapping them to another instrument's palette.

The exploration root exposes the tokens as inherited CSS custom properties.
The overview uses a shared neutral `#252321` surface and warm `#F3EBE3` text. The overview inherits the global `--color-text-primary` token; its family name mixes 65% `--color-text-muted` with primary text to retain AA contrast on charcoal. These shared text roles are defined in `src/styles/global.css` and do not depend on instrument palettes.
Anatomy uses the instrument's dark surface, primary text and muted secondary text.
The 3D and performance backgrounds retain the existing near-black environment.
Selected and media-bearing hotspots use the unchanged accent.

During performance, anatomy's background is preserved. The part heading,
description and inactive techniques use `muted`; the demonstrated technique
retains `text`. Available controls and focus outlines always retain primary text
contrast. The current technique has screen-reader text, and selected hotspots
expose `aria-pressed`, so color is not their only state indicator.

Existing panel dimensions, camera animations, canvas resizing, playback, and
orientation behavior are preserved. In particular, the existing canvas reserves
the anatomy width during performance; this color pass does not add a second
canvas resize when performance opens.

## Contrast validation

The tests evaluate every supplied palette, including the second-violin palette:

- Minimum primary text/surface contrast: **11.03:1**.
- Minimum muted text/surface contrast: **6.26:1**, also covering subdued content.
- Normal labels, available controls and their focus outlines use these same
  foregrounds and meet the 4.5:1 text target on the flat surfaces.

Accents for cello, contrabass, oboe, clarinet, bassoon, tuba, pitched percussion,
unpitched percussion and harp fall below 4.5:1 against their anatomy surface.
They are not used for normal control text. Accent arrows are decorative; labels
retain the primary foreground. Hotspot fills have a neutral outline so their
boundary does not rely on a dark accent contrasting with the near-black stage.
Contrast against arbitrary parts of a rendered model still needs visual review.

`tests/instrument-colors.mjs` checks palette aliases, historical map accents,
contrast, token binding for eight representative instruments, and static
overview/anatomy/performance markup. Browser visual checks remain pending:
the session has no connected browser and most instruments have no model yet.
Static markup checks do not validate animation, focus behavior or visual layout.

## Overview atmosphere

A faint horizontal gradient divider separates map and identity in landscape.
In portrait the title section has no bottom line; the sliding description
panel carries that edge. The overview has no ambient glow.
Introductory copy uses 1.65 line height and left alignment. Anatomy retains its
existing engraving.
