import { familyInstrumentIds } from '../../store/catalog'
import type { OrchestraInstrument } from '../orchestra-map/config'
import type { FamilyId, NavigationState } from '../orchestra-map/utils/navigation'

export type ScoreScope = { level: 'orchestra' } | { level: 'family'; familyId: FamilyId } | { level: 'instrument'; instrumentId: OrchestraInstrument }
export const partMap: Partial<Record<OrchestraInstrument, readonly string[]>> = {
  flute: ['P1', 'P2'], oboe: ['P3', 'P4'], clarinet: ['P5', 'P6'], bassoon: ['P7', 'P8'],
  horn: ['P9', 'P10'], trumpet: ['P11', 'P12'], timpani: ['P13'],
  violin: ['P14', 'P15'], viola: ['P16'], cello: ['P17', 'P18'], doubleBass: ['P19'],
}
export const allPartIds = Array.from({ length: 19 }, (_, i) => `P${i + 1}`)
export function scopeParts(scope: ScoreScope): string[] {
  if (scope.level === 'orchestra') return [...allPartIds]
  const instruments = scope.level === 'family' ? familyInstrumentIds(scope.familyId) : [scope.instrumentId]
  return instruments.flatMap(id => partMap[id] ?? [])
}
export function navigationScope(navigation: NavigationState): ScoreScope { return navigation }
export function scopeName(scope: ScoreScope) {
  return scope.level === 'orchestra' ? 'Orchestra' : scope.level === 'family' ? scope.familyId : scope.instrumentId
}
