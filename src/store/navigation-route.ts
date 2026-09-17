import { historyMode, navigationPath, parseNavigationPath } from '../features/orchestra-map/utils/navigation-path'
import { sameNavigation } from '../features/orchestra-map/utils/navigation'
import { navigateTo, useNavigationStore } from './navigation-store'

// Spatial routes own the current zoom. Trailing segments stay on first load so
// later explorer routes can attach without a second navigation model.
export function connectNavigationRoute() {
  let applying = false
  const applyLocation = () => {
    const parsed = parseNavigationPath(window.location.pathname)
    applying = true
    navigateTo(parsed.navigation)
    applying = false
    writeLocation(routedPath(parsed.prefix, parsed.rest), 'replace')
  }
  const unsubscribe = useNavigationStore.subscribe((state, previous) => {
    if (applying || sameNavigation(state.navigation, previous.navigation)) return
    writeLocation(navigationPath(state.navigation), historyMode(previous.navigation, state.navigation))
  })
  const initial = parseNavigationPath(window.location.pathname)
  writeLocation(routedPath(initial.prefix, initial.rest), 'replace')
  window.addEventListener('popstate', applyLocation)
  return () => {
    unsubscribe()
    window.removeEventListener('popstate', applyLocation)
  }
}

function routedPath(prefix: string, rest: string[]) {
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
