import { useImperativeHandle, useLayoutEffect, useRef, type ForwardedRef } from 'react'

import type { OverlayPlacement } from '../three/OrchestraScene'

export type FloatingOverlayHandle = {
  // From the scene's label layout (OrchestraScene.setOverlay): the free
  // stage space it found, following resizes without a React render.
  place: (placement: OverlayPlacement | null) => void
}

export type OverlaySize = { width: number; height: number }

// The shared mechanics of a floating overlay (ConstellationIllustration,
// PreparingIndicator): positioned by the scene, sized by its own content.
// Placements only move it while it is shown: when a view is left, the scene
// lays out the next one before the overlay deactivates, and the fading copy
// must not jump there. Its rendered size (border box) is reported for the
// scene to find room for. Returns the ref for its root element.
export function useFloatingOverlay(ref: ForwardedRef<FloatingOverlayHandle>, showing: boolean, onSize: (size: OverlaySize) => void) {
  const rootRef = useRef<HTMLDivElement>(null)
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
  return rootRef
}
