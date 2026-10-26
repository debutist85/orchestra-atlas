import { forwardRef, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'

import type { MiniaturePlacement } from '../three/OrchestraScene'
import type { ConstellationMiniatureData } from '../utils/constellation-miniature'
import { ConstellationInvitation } from './ConstellationInvitation'
import { ConstellationMiniature } from './ConstellationMiniature'

export type ConstellationIllustrationHandle = {
  // From the scene's label layout (OrchestraScene.setMiniatureSize): the
  // free stage space it found, following resizes without a React render.
  place: (placement: MiniaturePlacement | null) => void
}

// The same instruction at every depth. Set in capitals by CSS, like the
// map's other hints, so assistive technology reads words, not letters.
const INSTRUCTION = 'Select a glowing node'

type Props = {
  active: boolean
  miniature: ConstellationMiniatureData | null
  // On-screen size over the capture's design size (miniatureDisplayScale).
  scale: number
  // Its rendered size (border box), for the scene to find room for; it
  // depends on how the instruction wraps.
  onSize: (size: { width: number; height: number }) => void
}

// A small copy of the current view's constellation, floating in an empty
// part of the stage, with the invitation's ripples and pointer on one of its
// lights and an instruction below: what to select on the map. The drawing
// is decorative (hidden from assistive technology); the instruction is
// text. No pointer events. Styles: orchestra-map.css.
export const ConstellationIllustration = forwardRef<ConstellationIllustrationHandle, Props>(
  function ConstellationIllustration({ active, miniature, scale, onSize }, ref) {
    const rootRef = useRef<HTMLDivElement>(null)
    // The capture that is still shown while fading out (travel clears it the
    // moment it starts), and whether it is the current view's.
    const [shown, setShown] = useState(miniature)
    if (miniature && miniature !== shown) setShown(miniature)
    const showing = active && Boolean(miniature)
    // Placements only move it while it is shown: when a view is left, the
    // scene lays out the next one before this deactivates, and the fading
    // copy must not jump there.
    const showingRef = useRef(showing)
    showingRef.current = showing
    useImperativeHandle(ref, () => ({
      place(placement) {
        const root = rootRef.current
        if (!root || (placement && !showingRef.current)) return
        root.dataset.placed = String(Boolean(placement))
        if (!placement) return
        root.style.left = `${placement.x}px`
        root.style.top = `${placement.y}px`
      },
    }), [])
    const frame = shown?.frame

    const onSizeRef = useRef(onSize)
    onSizeRef.current = onSize
    useLayoutEffect(() => {
      const root = rootRef.current
      if (!root) return
      const report = () => onSizeRef.current({ width: root.offsetWidth, height: root.offsetHeight })
      report()
      const observer = new ResizeObserver(report)
      observer.observe(root)
      return () => observer.disconnect()
    }, [])

    return (
      <div ref={rootRef} className="constellation-illustration pointer-events-none absolute z-[1] box-content" data-active={showing} data-placed="false"
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
)
