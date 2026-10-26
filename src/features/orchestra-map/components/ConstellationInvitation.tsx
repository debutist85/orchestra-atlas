import { useEffect, useRef, useState, type CSSProperties } from 'react'

import { invitationPhaseDelay, type MiniatureInvitation } from '../utils/constellation-invitation'

// Hide the drawing this long after deactivation, once its fade has run.
const FADE_MS = 400

// Lucide Pointer (a pointing hand). Provenance and license:
// public/licenses/lucide.txt.
const HAND_PATHS = [
  'M22 14a8 8 0 0 1-8 8',
  'M18 11v-1a2 2 0 0 0-2-2a2 2 0 0 0-2 2',
  'M14 10V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1',
  'M10 9.5V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v10',
  'M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
]

// Ripples and a faint approaching pointing hand on one light of the floating
// miniature (ConstellationIllustration.tsx), showing what to select on the
// map; constellation-invitation.ts picks the light. Positioned in the
// miniature's viewBox units, which are its px. Decorative only: nothing
// here takes pointer events. Styles: orchestra-map.css.
export function ConstellationInvitation({ active, invitation }: { active: boolean; invitation: MiniatureInvitation | undefined }) {
  const rootRef = useRef<HTMLDivElement>(null)
  // Animations run only while shown or fading out, and restart on each
  // activation so their phase can be set against the Play button.
  const [running, setRunning] = useState(false)
  const [delay, setDelay] = useState(0)

  useEffect(() => {
    if (active) {
      // The Play button's rings, when it is showing: ours peak between theirs.
      const play = document.querySelector<HTMLElement>('.orchestra-invitation--visible .orchestra-invitation__play')
      const ring = play?.getAnimations({ subtree: true })
        .find(animation => animation instanceof CSSAnimation && animation.animationName === 'invitation-radiate')
      const elapsed = ring?.currentTime
      setDelay(invitationPhaseDelay(typeof elapsed === 'number' ? elapsed : undefined))
      setRunning(true)
      return
    }
    const timeout = window.setTimeout(() => setRunning(false), FADE_MS)
    return () => window.clearTimeout(timeout)
  }, [active])

  return (
    <div ref={rootRef} className="constellation-invitation pointer-events-none absolute size-0"
      data-active={active} data-running={running} data-placed={Boolean(invitation)} data-side={invitation?.side}
      style={invitation && {
        left: invitation.x,
        top: invitation.y,
        '--invitation-radius': `${invitation.radius}px`,
        '--invitation-scale': String(invitation.ringScale),
        '--invitation-color': invitation.color,
        '--invitation-delay': `${delay}ms`,
      } as CSSProperties}
      aria-hidden="true">
      <span className="constellation-invitation__ring" />
      <span className="constellation-invitation__ring constellation-invitation__ring--second" />
      <span className="constellation-invitation__pointer">
        {/* A dark under-stroke keeps the hand legible over any light. */}
        <svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <g className="constellation-invitation__hand-shadow">{HAND_PATHS.map(path => <path key={path} d={path} />)}</g>
          <g className="constellation-invitation__hand">{HAND_PATHS.map(path => <path key={path} d={path} />)}</g>
        </svg>
      </span>
    </div>
  )
}
