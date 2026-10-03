import { useEffect, useRef, useState, type Ref } from 'react'
import {
  atmosphereSelection, atmosphereSources, rootAtmosphereClip,
} from '../atmosphere'

type AtmosphereBackdropProps = {
  active: boolean
  playing: boolean
  playbackReady: boolean
  reducedMotion: boolean
  ref?: Ref<HTMLDivElement>
}

function mediaKey(reducedMotion: boolean, variant: string | undefined, codec: string) {
  if (reducedMotion) return 'still'
  return `${variant ?? 'responsive'}-${codec}`
}

export function AtmosphereBackdrop({
  active,
  playing,
  playbackReady,
  reducedMotion,
  ref,
}: Readonly<AtmosphereBackdropProps>) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [selection] = useState(() => atmosphereSelection(window.location.search))
  const sources = atmosphereSources(rootAtmosphereClip, selection.variant, selection.codec)

  useEffect(() => {
    const video = videoRef.current
    if (!video || reducedMotion) return
    video.muted = true
    if (playing && playbackReady) void video.play().catch(() => {})
    else video.pause()
  }, [playing, playbackReady, reducedMotion, selection])

  return (
    <div
      ref={ref}
      className={[
        'orchestra-backdrop pointer-events-none absolute inset-0 select-none',
        !active && 'opacity-0',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <video
        ref={videoRef}
        key={mediaKey(reducedMotion, selection.variant, selection.codec)}
        className="absolute inset-0 size-full max-w-none object-cover object-[center_46%] opacity-30"
        poster={rootAtmosphereClip.poster}
        muted
        loop
        playsInline
        preload={reducedMotion ? 'none' : 'auto'}
        autoPlay={playing && playbackReady && !reducedMotion}
        disablePictureInPicture
        disableRemotePlayback
      >
        {!reducedMotion && sources.map(source => (
          <source key={`${source.media ?? ''}${source.src}`} src={source.src} type={source.type} media={source.media} />
        ))}
      </video>
    </div>
  )
}
