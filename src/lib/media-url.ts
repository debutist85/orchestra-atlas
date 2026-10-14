// Cloudflare R2 (or any other CDN) base URL for large portfolio media —
// audio and other content currently served from the public/ directory.
// Set VITE_MEDIA_URL in .env.local to use R2 during local development too.
// When unset, media resolves to files served locally from public/.
const mediaBaseUrl = import.meta.env.VITE_MEDIA_URL as string | undefined

// Builds a URL for a media asset that lives under public/ locally and, in
// any environment, under VITE_MEDIA_URL when configured — so callers never need to know
// which environment they're running in. `path` is relative to public/; an
// optional leading "/" or "public/" is stripped, so both bare relative
// paths and this codebase's "public/..." filesystem-style paths work
// unchanged.
export function mediaUrl(path: string): string {
  const relative = path.replace(/^\/+/, '').replace(/^public\/+/, '').replace(/\/{2,}/g, '/')
  if (!mediaBaseUrl) return `${import.meta.env.BASE_URL}${relative}`
  return `${mediaBaseUrl.replace(/\/+$/, '')}/${relative}`
}
