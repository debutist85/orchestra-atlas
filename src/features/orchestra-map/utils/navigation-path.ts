import { instrumentCatalog } from '../../../store/catalog'
import { familyIds, sameNavigation, type NavigationState } from './navigation'

export type ParsedNavigationPath = {
  navigation: NavigationState
  prefix: string
  rest: string[]
}

export function kebabSegment(id: string) {
  return id.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
}

export function navigationPath(state: NavigationState) {
  if (state.level === 'orchestra') return '/'
  if (state.level === 'family') return `/${state.familyId}`
  return `/${state.familyId}/${kebabSegment(state.instrumentId)}`
}

export function parseNavigationPath(pathname: string): ParsedNavigationPath {
  const segments = pathname.split('/').filter(Boolean)
  const family = familyIds.find(id => id === segments[0])
  const instrument = segments[1] ? findRoutedInstrument(segments[1]) : undefined
  if (instrument) {
    return {
      navigation: { level: 'instrument', familyId: instrument.familyId, instrumentId: instrument.instrument },
      prefix: navigationPath({ level: 'instrument', familyId: instrument.familyId, instrumentId: instrument.instrument }),
      rest: segments.slice(2),
    }
  }
  if (family) {
    return {
      navigation: { level: 'family', familyId: family },
      prefix: navigationPath({ level: 'family', familyId: family }),
      rest: segments.slice(1),
    }
  }
  return { navigation: { level: 'orchestra' }, prefix: '/', rest: [] }
}

export function historyMode(from: NavigationState, to: NavigationState): 'push' | 'replace' | 'none' {
  if (sameNavigation(from, to)) return 'none'
  return navigationDepth(to) < navigationDepth(from) ? 'replace' : 'push'
}

function navigationDepth(state: NavigationState) {
  if (state.level === 'orchestra') return 0
  if (state.level === 'family') return 1
  return 2
}

function findRoutedInstrument(segment: string) {
  const camel = segment.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())
  return instrumentCatalog.find(group => group.instrument === segment || group.instrument === camel)
}
