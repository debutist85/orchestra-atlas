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
    {!ready && <span className="instrument-demo__loader" role="status" aria-label="Loading demonstration" />}
    <video
      ref={videoRef}
      className={`instrument-demo__media${ready ? ' is-ready' : ''}`}
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
        className="instrument-demo__media"
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
      return <p className="instrument-explore__demo-unavailable">This demonstration type isn’t available yet.</p>
  }
}
