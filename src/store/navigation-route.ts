import { historyMode, navigationPath, parseNavigationPath, type ParsedNavigationPath } from '../features/orchestra-map/utils/navigation-path'
import { sameNavigation, type NavigationState } from '../features/orchestra-map/utils/navigation'
import { navigateTo, useNavigationStore } from './navigation-store'
import { useExperienceStore, type ExperienceMode } from './experience-store'

// Spatial routes own the current zoom; experienceMode owns the trailing
// `/explore` segment written here. Reading it back is NOT symmetric: entering
// explore can require preparing a 3D model first (see OrchestraMap's
// beginExplore), so the initial URL and later popstate events are read back
// by OrchestraMap itself, not here — this module only ever writes outward
// from either store.
export function connectNavigationRoute() {
  let applying = false
  const applyLocation = () => {
    const parsed = parseNavigationPath(window.location.pathname)
    applying = true
    navigateTo(parsed.navigation)
    applying = false
    writeLocation(routedPath(parsed), 'replace')
  }
  const unsubscribeNavigation = useNavigationStore.subscribe((state, previous) => {
    if (applying || sameNavigation(state.navigation, previous.navigation)) return
    writeLocation(navigationPath(state.navigation), historyMode(previous.navigation, state.navigation))
  })
  const unsubscribeExperience = useExperienceStore.subscribe((state, previous) => {
    if (state.experienceMode === previous.experienceMode) return
    const navigation = useNavigationStore.getState().navigation
    writeLocation(exploreRoutePath(navigation, state.experienceMode), state.experienceMode === 'explore' ? 'push' : 'replace')
  })
  const initial = parseNavigationPath(window.location.pathname)
  writeLocation(routedPath(initial), 'replace')
  window.addEventListener('popstate', applyLocation)
  return () => {
    unsubscribeNavigation()
    unsubscribeExperience()
    window.removeEventListener('popstate', applyLocation)
  }
}

// Pure so it can be unit-tested without a `window` — see tests/navigation-route.mjs.
export function exploreRoutePath(navigation: NavigationState, experienceMode: ExperienceMode) {
  return routedPath({ prefix: navigationPath(navigation), rest: experienceMode === 'explore' ? ['explore'] : [] })
}

function routedPath({ prefix, rest }: Pick<ParsedNavigationPath, 'prefix' | 'rest'>) {
  if (rest.length === 0) return prefix
  if (prefix === '/') return `/${rest.join('/')}`
  return `${prefix}/${rest.join('/')}`
}

function writeLocation(path: string, mode: 'push' | 'replace' | 'none') {
  if (mode === 'none') return
  const next = path + window.location.search + window.location.hash
  if (window.location.pathname + window.location.search + window.location.hash === next) return
  if (mode === 'push') window.history.pushState(null, '', next)
  else window.history.replaceState(null, '', next)
}
