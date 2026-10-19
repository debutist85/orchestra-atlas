export function isStylePreview() {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has('style-preview')
}
