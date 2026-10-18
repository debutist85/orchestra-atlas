// Keyed by exact GLB node name rather than derived from a naming convention
// (e.g. stripping an "Anchor_" prefix) — explicit, and doesn't assume a
// future instrument's anchors follow the same pattern. When a second
// instrument's model ships with its own anchors, its labels are added here.
const anchorLabels: Record<string, string> = {
  Anchor_Bow: 'Bow',
  Anchor_Bridge: 'Bridge',
  Anchor_Chinrest: 'Chinrest',
  // Anchor_FHole_Left has no entry — only one f-hole anchor is shown, named
  // without a side (see isAnchorIntentionallyHidden below).
  Anchor_FHole_Right: 'F-hole',
  Anchor_Fingerboard: 'Fingerboard',
  Anchor_Pegbox: 'Pegbox',
  Anchor_Scroll: 'Scroll',
  Anchor_Tailpiece: 'Tailpiece',
}

// Anchors present in the model but deliberately not labeled, so the loader
// doesn't treat them as an unexpected omission to warn about in dev.
const hiddenAnchors = new Set(['Anchor_FHole_Left'])

// One to three sentences per part — standard, uncontroversial lutherie facts,
// not deep technique content (that lives in technique.ts, linked separately
// so a part can reference techniques without duplicating their content here).
const anchorDescriptions: Record<string, string> = {
  Anchor_Bow: 'Drawn across the strings, the bow’s horsehair grips and releases them in rapid succession, exciting the vibrations that produce sound.',
  Anchor_Bridge: 'The bridge supports the strings and transfers their vibrations into the violin’s body, where they’re amplified.',
  Anchor_Chinrest: 'A rest for the player’s jaw that holds the violin steady against the shoulder, freeing the left hand to move along the neck.',
  Anchor_FHole_Right: 'The f-holes let the body’s amplified sound escape, and let air move in and out as the top plate vibrates.',
  Anchor_Fingerboard: 'A smooth board the player presses the strings against to shorten their vibrating length, raising the pitch.',
  Anchor_Pegbox: 'Houses the four tuning pegs, which the player turns to adjust each string’s tension and pitch.',
  Anchor_Scroll: 'A carved, ornamental flourish at the top of the pegbox — often a maker’s signature touch, rather than a part that shapes the sound.',
  Anchor_Tailpiece: 'Anchors the far end of the strings opposite the pegbox, holding them under tension across the bridge.',
}

// Small per-anchor nudges (model-local units, in the node's own pre-rotation
// axes — [x, y, z] as authored in the GLB), applied once right after load.
// For when an anchor's authored position doesn't quite land on the visible
// feature on this particular textured model — a calibration correction, not
// a bug in the projection/rendering code. Anchor_Bridge was authored over
// the upper bout, well above the actual bridge (visually, close to where
// the f-hole anchor already sits is correct) — estimated from a screenshot,
// so treat as a first pass pending visual confirmation.
const anchorPositionCorrections: Record<string, readonly [number, number, number]> = {
  Anchor_Bridge: [0, 0.01, 0.07],
  Anchor_FHole_Right: [0.018, 0, 0.024],
}

export function anatomyLabel(nodeName: string): string | undefined {
  return anchorLabels[nodeName]
}

export function anatomyDescription(nodeName: string): string | undefined {
  return anchorDescriptions[nodeName]
}

export function isAnchorIntentionallyHidden(nodeName: string): boolean {
  return hiddenAnchors.has(nodeName)
}

export function anatomyPositionCorrection(nodeName: string): readonly [number, number, number] | undefined {
  return anchorPositionCorrections[nodeName]
}
