import { forwardRef, memo, useState } from 'react'

import { OrchestraFanLoader } from '../../../components/OrchestraFanLoader'
import { useFloatingOverlay, type FloatingOverlayHandle, type OverlaySize } from './floating-overlay'

type Props = {
  // The instrument whose 3D model is preparing, or undefined when none is.
  name: string | undefined
  onSize: (size: OverlaySize) => void
}

// "Preparing [instrument]…" with a mini fan loader while an instrument's 3D
// model prepares, floating bare in free stage space like the onboarding
// illustration (the bottom center first; OrchestraMap). Visual only: the
// caption's status line announces it. Styles: orchestra-map.css. Memoized,
// like the illustration: the map re-renders far more often than it changes.
export const PreparingIndicator = memo(forwardRef<FloatingOverlayHandle, Props>(function PreparingIndicator({ name, onSize }, ref) {
  // The name stays while it fades out.
  const [shown, setShown] = useState(name)
  if (name && name !== shown) setShown(name)
  const showing = Boolean(name)
  const rootRef = useFloatingOverlay(ref, showing, onSize)
  return (
    <div ref={rootRef} className="floating-overlay preparing-indicator pointer-events-none absolute z-[1] flex items-center gap-[12px] px-[24px] py-[16px] font-sans text-[13px] leading-[1.35] tracking-[0.12em] text-navigation uppercase whitespace-nowrap [@media(max-width:480px)]:text-[12px] [@media(max-width:480px)]:tracking-[0.08em]"
      data-active={showing} data-placed="false" aria-hidden="true">
      {/* Loops only while preparing; paused while faded out. */}
      <span className={showing ? undefined : '[&_.orchestra-fan-arc]:[animation-play-state:paused]'}>
        <OrchestraFanLoader size={48} strokeWidth={14} startOffset={1.2} label="Preparing" />
      </span>
      {/* Two lines: what is happening, then which instrument. */}
      <span className="flex flex-col">
        <span>Preparing</span>
        <span>{shown ?? 'instrument'}…</span>
      </span>
    </div>
  )
}))
