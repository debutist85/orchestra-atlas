export function isStylePreview() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has('style-preview')
}

export function isLiquidOrbPreview() {
  return import.meta.env.DEV && window.location.pathname.replace(/\/$/, '') === '/dev/liquid-orb'
}

export function isActivityReview() {
  return import.meta.env.DEV && window.location.pathname.replace(/\/$/, '') === '/dev/activity-review'
}
