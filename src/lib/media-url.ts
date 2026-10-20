// Cloudflare R2 (or any other CDN) base URL for large portfolio media —
// audio and other content currently served from the public/ directory.
// Unset in development, so media resolves to the local files Vite already
// serves from public/ at the root.
const mediaBaseUrl = import.meta.env.VITE_MEDIA_URL as string | undefined

// Builds a URL for a media asset that lives under public/ locally and, in
// production, under VITE_MEDIA_URL instead — so callers never need to know
// which environment they're running in. `path` is relative to public/; an
// optional leading "/" or "public/" is stripped, so both bare relative
// paths and this codebase's "public/..." filesystem-style paths work
// unchanged.
export function mediaUrl(path: string): string {
  if (!mediaBaseUrl) return localMediaUrl(path)
  return `${mediaBaseUrl.replace(/\/+$/, '')}/${publicRelative(path)}`
}

// The same asset from the local public/ folder, ignoring VITE_MEDIA_URL.
export function localMediaUrl(path: string): string {
  return `${import.meta.env.BASE_URL}${publicRelative(path)}`
}

function publicRelative(path: string) {
  return path.replace(/^\/+/, '').replace(/^public\/+/, '').replace(/\/{2,}/g, '/')
}
