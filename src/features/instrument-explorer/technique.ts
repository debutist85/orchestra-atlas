// Techniques and demonstrations are modeled separately from anatomy parts —
// a technique may apply to several parts, and keeping them keyed by id
// (rather than embedded inside each anatomy part) avoids duplicating the
// same content if that ever happens.

export type Demonstration =
  | { id: string; type: 'audio'; title?: string; src: string }
  | { id: string; type: 'video'; title?: string; src: string; poster?: string }
  | { id: string; type: 'interactive'; title?: string; interactionId: string }
  | { id: string; type: 'comparison'; title?: string; comparisonId: string }

export type Technique = {
  id: string
  title: string
  description: string
  demonstrationIds: string[]
}

const techniques: Record<string, Technique> = {
  'sul-ponticello': {
    id: 'sul-ponticello',
    title: 'Sul ponticello',
    // Bowing NEAR the bridge, not on it — a real, easy-to-make mistake worth
    // stating explicitly rather than leaving implicit.
    description: 'The player bows very close to the bridge — not on it — emphasizing higher overtones for a bright, glassy sound.',
    // No recording exists in the project yet. Left empty rather than
    // pointing at a placeholder or an unrelated clip labeled as if it were
    // one; AnatomyPanel/DemonstrationStage read this length to show an
    // honest "not yet available" state instead of an openable demonstration.
    demonstrationIds: [],
  },
}

const demonstrations: Record<string, Demonstration> = {}

// Which anatomy anchor node names (instrument-anatomy.ts) link to which
// techniques. Only the bridge is populated for this first slice — every
// other part resolves to no techniques and shows description-only content.
const anatomyPartTechniques: Partial<Record<string, string[]>> = {
  Anchor_Bridge: ['sul-ponticello'],
}

export function techniqueById(id: string): Technique | undefined {
  return techniques[id]
}

export function demonstrationById(id: string): Demonstration | undefined {
  return demonstrations[id]
}

export function techniquesForAnatomyPart(nodeName: string): Technique[] {
  return (anatomyPartTechniques[nodeName] ?? []).flatMap(id => {
    const technique = techniques[id]
    return technique ? [technique] : []
  })
}
