import type { Demonstration } from './technique'
import { pauseMainPlaybackForDemo, resumeMainPlaybackAfterDemo } from './demo-playback-coordination'

type Props = { demonstration: Demonstration }

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
      return <video
        className="instrument-demo__media"
        controls
        playsInline
        preload="none"
        poster={demonstration.poster}
        src={demonstration.src}
        onPlay={pauseMainPlaybackForDemo}
        onEnded={resumeMainPlaybackAfterDemo}
      >
        {demonstration.title}
      </video>
    case 'interactive':
    case 'comparison':
      // Extensible per the data model, not yet implemented — the type-safe
      // stub the spec asks for rather than a built feature.
      return <p className="instrument-explore__demo-unavailable">This demonstration type isn’t available yet.</p>
  }
}
