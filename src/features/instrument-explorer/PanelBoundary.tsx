import { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type Props = { label: string; onClose: () => void }

export function PanelBoundary({ label, onClose }: Props) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [host, setHost] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const next = anchorRef.current?.closest<HTMLElement>('.instrument-explore') ?? null
    setHost(current => current === next ? current : next)
  }, [])

  useLayoutEffect(() => {
    const anchor = anchorRef.current
    const button = buttonRef.current
    if (!anchor || !button || !host) return
    // The button is painted on the explore root, above the description
    // chevron. The rail's own translate would otherwise keep it underneath.
    const place = () => {
      const rect = anchor.getBoundingClientRect()
      const panel = anchor.closest<HTMLElement>('.instrument-explore__anatomy')
      button.inert = panel?.hasAttribute('inert') ?? false
      if (rect.width === 0 && rect.height === 0) {
        button.style.visibility = 'hidden'
        return
      }
      const rootRect = host.getBoundingClientRect()
      button.style.visibility = 'visible'
      button.style.left = `${rect.left + rect.width / 2 - rootRect.left}px`
      button.style.top = `${rect.top + rect.height / 2 - rootRect.top}px`
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(anchor)
    host.addEventListener('instrument-panel-progress', place)
    window.addEventListener('resize', place)
    return () => {
      observer.disconnect()
      host.removeEventListener('instrument-panel-progress', place)
      window.removeEventListener('resize', place)
    }
  }, [host])

  const button = (
    <button ref={buttonRef} type="button" className="instrument-explore__collapse" aria-label={label} onClick={onClose}>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path d="m7 4 6 6-6 6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  )

  return <div ref={anchorRef} className="instrument-explore__boundary">
    {host && createPortal(button, host)}
  </div>
}
