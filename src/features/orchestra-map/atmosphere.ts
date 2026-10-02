// Decorative clips behind the map. Encode each one with
// `npm run video:atmosphere -- public/videos/<id>.mp4`.
// The root view plays the first clip. Further clips can be appended here;
// sequential crossfades are not implemented.

import { mediaUrl } from '../../lib/media-url'

export const atmosphereVariantIds = ['production', 'lightweight'] as const

export type AtmosphereVariantId = (typeof atmosphereVariantIds)[number]
export type AtmosphereCodec = 'webm' | 'mp4' | 'auto'

export type AtmosphereSource = {
  src: string
  type: string
  media?: string
}

export type AtmosphereClip = {
  id: string
  poster: string
  variants: Record<AtmosphereVariantId, AtmosphereSource[]>
}

function variantSources(id: string, variant: AtmosphereVariantId): AtmosphereSource[] {
  const base = `/videos/atmosphere/${id}/${variant}`
  return [
    { src: mediaUrl(`${base}.webm`), type: 'video/webm; codecs="vp9"' },
    { src: mediaUrl(`${base}.mp4`), type: 'video/mp4; codecs="avc1.640028"' },
  ]
}

export function atmosphereClip(id: string): AtmosphereClip {
  return {
    id,
    poster: mediaUrl(`/videos/atmosphere/${id}/poster.jpg`),
    variants: {
      production: variantSources(id, 'production'),
      lightweight: variantSources(id, 'lightweight'),
    },
  }
}

export const rootAtmosphereClip: AtmosphereClip = atmosphereClip('strings')

export const atmosphereClips: AtmosphereClip[] = [
  rootAtmosphereClip,
]

// Viewports below the desktop occupancy threshold play the 720p clip.
export const smallAtmosphereMedia = '(max-width: 1023px)'

// Force one encode with `?atmosphere=production|lightweight` and
// `&atmosphere-codec=webm|mp4`. With no variant, narrow viewports get the
// lightweight clip and wider ones the production clip. WebM comes before MP4.
export function atmosphereSelection(search: string): { variant: AtmosphereVariantId | undefined; codec: AtmosphereCodec } {
  const params = new URLSearchParams(search)
  const requested = params.get('atmosphere')
  const variant = atmosphereVariantIds.find(id => id === requested)
  const codec = params.get('atmosphere-codec')
  if (codec === 'webm' || codec === 'mp4') return { variant, codec }
  return { variant, codec: 'auto' }
}

function sourcesForCodec(sources: AtmosphereSource[], codec: AtmosphereCodec) {
  if (codec === 'auto') return sources
  return sources.filter(source => source.type.startsWith(`video/${codec}`))
}

export function atmosphereSources(clip: AtmosphereClip, variant: AtmosphereVariantId | undefined, codec: AtmosphereCodec) {
  if (variant) return sourcesForCodec(clip.variants[variant], codec)
  const lightweight = sourcesForCodec(clip.variants.lightweight, codec)
    .map(source => ({ ...source, media: smallAtmosphereMedia }))
  return [...lightweight, ...sourcesForCodec(clip.variants.production, codec)]
}
