import { familySections, type NavigationState } from './navigation'
import { isIdlePlayer } from './idle-animation'
import type { OrchestraPosition } from './seating'

export const familyGhostFocus = 1
export const instrumentGhostFocus = 2

export function ghostFocusFor(navigation: NavigationState, node: Pick<OrchestraPosition, 'sectionId' | 'instrument'>) {
  if (navigation.level === 'orchestra') return 0
  if (!isIdlePlayer(node) || !familySections(navigation.familyId).includes(node.sectionId)) return 0
  if (navigation.level === 'instrument') return node.instrument === navigation.instrumentId ? instrumentGhostFocus : 0
  return familyGhostFocus
}

export function ghostIdleFor(navigation: NavigationState, node: Pick<OrchestraPosition, 'sectionId' | 'instrument'>) {
  if (navigation.level !== 'orchestra' || !isIdlePlayer(node)) return 0
  return 1
}

export function ghostPresentFor(navigation: NavigationState, node: Pick<OrchestraPosition, 'sectionId' | 'instrument'>) {
  return ghostIdleFor(navigation, node) > 0 || ghostFocusFor(navigation, node) > 0 ? 1 : 0
}

export function ghostLiveWeight(
  node: Pick<OrchestraPosition, 'sectionId' | 'instrument'>,
  nodeFocus: number,
  sectionEmphasis: number,
  interaction: { dimmedIntensity: number; familyIntensity: number },
) {
  if (!isIdlePlayer(node)) return 0
  const dimmed = interaction.dimmedIntensity / Math.max(interaction.familyIntensity, 0.001)
  const nodeWeight = Math.min(1, Math.max(0, (nodeFocus - dimmed) / Math.max(1 - dimmed, 0.001)))
  const sectionWeight = sectionEmphasis < 0 ? Math.min(1, Math.max(0, 1 + sectionEmphasis)) : 1
  return Math.min(nodeWeight, sectionWeight)
}
