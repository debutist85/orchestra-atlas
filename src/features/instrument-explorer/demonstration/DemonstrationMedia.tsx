import { useEffect, useRef, useState } from 'react'

import type { Demonstration } from '../content/technique'
import { pauseMainPlaybackForDemo, resumeMainPlaybackAfterDemo } from './demo-playback-coordination'

type Props = { demonstration: Demonstration }

function DemonstrationVideo({ demonstration }: { demonstration: Demonstration }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let cancelled = false
    const onReady = () => {
      if (cancelled) return
      setReady(true)
      void video.play().catch(() => {})
    }
    // src stays unset until the panel is open, so the file is not requested
    // while the technique is only selected. preload none keeps the browser
    // from fetching ahead of this load() call.
    video.preload = 'none'
    video.src = demonstration.src
    video.addEventListener('canplay', onReady, { once: true })
    video.addEventListener('error', onReady, { once: true })
    video.load()
    return () => {
      cancelled = true
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('error', onReady)
      video.removeAttribute('src')
      video.load()
    }
  }, [demonstration.src])

  return <>
    {!ready && <span className="instrument-demo__loader absolute top-1/2 left-1/2 z-[1] size-5 rounded-full border border-ivory border-r-transparent" role="status" aria-label="Loading demonstration" />}
    <video
      ref={videoRef}
      className={`instrument-demo__media absolute inset-0 block size-full max-w-none object-contain opacity-0${ready ? ' is-ready' : ''}`}
      autoPlay
      controls
      playsInline
      poster={demonstration.poster}
      onPlay={pauseMainPlaybackForDemo}
      onEnded={resumeMainPlaybackAfterDemo}
    >
      {demonstration.title}
    </video>
  </>
}

function DemonstrationAudio({ demonstration }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const audio = audioRef.current
    return () => {
      audio?.pause()
      resumeMainPlaybackAfterDemo()
    }
  }, [])
  return <audio ref={audioRef} autoPlay controls preload="none"
    className="instrument-demo__media block w-full max-w-[32rem]" src={demonstration.src}
    aria-label={`${demonstration.title} audio`}
    onPlay={pauseMainPlaybackForDemo} onEnded={resumeMainPlaybackAfterDemo}
    onError={resumeMainPlaybackAfterDemo}
  >{demonstration.title}</audio>
}

// Native controls, not a custom player — compact and already accessible
// (keyboard-operable, screen-reader exposed) without building one from
// scratch for what should read as a small, focused example, not another
// full music player.
export function DemonstrationMedia({ demonstration }: Props) {
  switch (demonstration.type) {
    case 'audio':
      return <DemonstrationAudio demonstration={demonstration} />
    case 'video':
      return <DemonstrationVideo demonstration={demonstration} />
  }
}
