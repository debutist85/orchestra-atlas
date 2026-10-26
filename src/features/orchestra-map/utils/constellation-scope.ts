import type { OrchestraSceneConfig } from '../config'
import type { OrchestraPosition } from '../three/seating'
import { familyInstruments, familySections, type NavigationState } from './navigation'

// The lights that make up the constellation of a map view, for the features
// that stand in for it (the invitation, the SVG miniature): one rule, read
// from the scene's own nodes. Full orchestra: the Strings family only, as
// the demonstration. Family: its instruments' lights. Instrument: its own.
// `tier` is the instrument's place in the configured order (0 at instrument
// depth), so a feature can feature the first instrument without naming it.
export function constellationScope(config: OrchestraSceneConfig, navigation: NavigationState, positions: readonly OrchestraPosition[]) {
  const visible = positions.filter(node => node.visible !== false && node.id !== 'conductor')
  if (navigation.level === 'instrument') {
    const sections = familySections(navigation.familyId)
    return visible.filter(node => sections.includes(node.sectionId) && node.instrument === navigation.instrumentId)
      .map(node => ({ node, tier: 0 }))
  }
  const familyId = navigation.level === 'family' ? navigation.familyId : 'strings'
  const order = familyInstruments(config, familyId).map(group => group.instrument)
  const sections = familySections(familyId)
  return visible.flatMap(node => {
    const tier = node.instrument && sections.includes(node.sectionId) ? order.indexOf(node.instrument) : -1
    return tier < 0 ? [] : [{ node, tier }]
  })
}
