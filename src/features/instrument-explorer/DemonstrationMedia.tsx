import { useEffect, useRef, useState } from 'react'

import type { Demonstration } from './technique'
import { pauseMainPlaybackForDemo, resumeMainPlaybackAfterDemo } from './demo-playback-coordination'

type Props = { demonstration: Demonstration }

function DemonstrationVideo({ demonstration }: { demonstration: Extract<Demonstration, { type: 'video' }> }) {
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
    {!ready && (
      <span className="absolute top-1/2 left-1/2 z-[1] -translate-x-1/2 -translate-y-1/2" role="status" aria-label="Loading demonstration">
        <span className="block size-5 animate-spin rounded-full border border-ivory border-r-transparent motion-reduce:animate-none motion-reduce:border-r-ivory motion-reduce:opacity-55" />
      </span>
    )}
    <video
      ref={videoRef}
      className={`absolute inset-0 h-full w-full max-w-none object-contain opacity-0${ready ? ' animate-[instrument-demo-video-in_0.7s_ease-out_both] motion-reduce:animate-none motion-reduce:opacity-100' : ''}`}
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

// Native controls, not a custom player — compact and already accessible
// (keyboard-operable, screen-reader exposed) without building one from
// scratch for what should read as a small, focused example, not another
// full music player.
export function DemonstrationMedia({ demonstration }: Props) {
  switch (demonstration.type) {
    case 'audio':
      return <audio
        className="block w-full max-w-lg"
        controls
        preload="none"
        src={demonstration.src}
        onPlay={pauseMainPlaybackForDemo}
        onEnded={resumeMainPlaybackAfterDemo}
      >
        {demonstration.title}
      </audio>
    case 'video':
      return <DemonstrationVideo demonstration={demonstration} />
    case 'interactive':
    case 'comparison':
      // Extensible per the data model, not yet implemented — the type-safe
      // stub the spec asks for rather than a built feature.
      return <p className="mt-3 text-[0.75rem] tracking-[0.04em] text-dust italic">This demonstration type isn’t available yet.</p>
  }
}
