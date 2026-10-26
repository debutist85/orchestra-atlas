import { forwardRef, memo, useState } from 'react'

import type { ConstellationMiniatureData } from '../utils/constellation-miniature'
import { ConstellationInvitation } from './ConstellationInvitation'
import { ConstellationMiniature } from './ConstellationMiniature'
import { useFloatingOverlay, type FloatingOverlayHandle, type OverlaySize } from './floating-overlay'

// The same instruction at every depth. Set in capitals by CSS, like the
// map's other hints, so assistive technology reads words, not letters.
const INSTRUCTION = 'Select a glowing node'

type Props = {
  active: boolean
  miniature: ConstellationMiniatureData | null
  // On-screen size over the capture's design size (miniatureDisplayScale).
  scale: number
  // Its rendered size, for the scene to find room for (it depends on how
  // the instruction wraps).
  onSize: (size: OverlaySize) => void
}

// A small copy of the current view's constellation, floating in an empty
// part of the stage, with the invitation's ripples and pointer on one of its
// lights and an instruction below: what to select on the map. The drawing
// is decorative (hidden from assistive technology); the instruction is
// text. No pointer events. Styles: orchestra-map.css. Memoized: the map
// re-renders on every hover change, its props only change per capture.
export const ConstellationIllustration = memo(forwardRef<FloatingOverlayHandle, Props>(
  function ConstellationIllustration({ active, miniature, scale, onSize }, ref) {
    // The capture that is still shown while fading out (travel clears it the
    // moment it starts), and whether it is the current view's.
    const [shown, setShown] = useState(miniature)
    if (miniature && miniature !== shown) setShown(miniature)
    const showing = active && Boolean(miniature)
    const rootRef = useFloatingOverlay(ref, showing, onSize)
    const frame = shown?.frame

    return (
      <div ref={rootRef} className="floating-overlay constellation-illustration pointer-events-none absolute z-[1] box-content" data-active={showing} data-placed="false"
        style={frame && { width: frame.width * scale }}>
        {/* Drawn at the design size and scaled as one piece, so the lights,
            rings and hand keep their proportions at every stage size. */}
        <div aria-hidden="true" style={frame && { height: frame.height * scale }}>
          <div className="relative origin-top-left" style={frame && { width: frame.width, height: frame.height, transform: `scale(${scale})` }}>
            {shown && frame && <ConstellationMiniature nodes={shown.nodes} width={frame.width} height={frame.height} />}
            <ConstellationInvitation active={showing} invitation={shown?.invitation} />
          </div>
        </div>
        <p className="constellation-illustration__instruction m-0 px-[10px] pb-[9px] font-sans text-[10px] leading-[1.4] tracking-[0.12em] text-navigation text-center text-balance uppercase">{INSTRUCTION}</p>
      </div>
    )
  },
))
