import { useId, useRef, type ReactNode } from 'react'

import type { ModelAttribution } from '../content/explorable-instruments'

type Props = { attribution: ModelAttribution }

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}<span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

// The 3D model's credits, entirely from its attribution data. A native modal
// <dialog> provides focus containment, Escape to close, an inert page behind
// it, and focus returning to the toggle on close.
export function ModelCredits({ attribution }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const { title, creator, creatorUrl, sourceUrl, sourceName, license, licenseUrl, modifications, previousModifications, copyrightNotice, disclaimerNotice } = attribution
  const close = () => dialogRef.current?.close()

  return (
    <div className="model-credits">
      <button type="button" className="model-credits__toggle" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        <svg className="model-credits__icon" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 0.75a5.25 5.25 0 1 1 0 10.5A5.25 5.25 0 0 1 6 0.75Zm0 1a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5ZM6 5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 6 5Zm0-1.9a.65.65 0 1 1 0 1.3.65.65 0 0 1 0-1.3Z" />
        </svg>
        <span className="model-credits__label">3D Model Credits</span>
      </button>
      <dialog
        ref={dialogRef}
        className="model-credits__panel"
        aria-labelledby={headingId}
        // The explorer's own Escape handler (on window) would also leave
        // Explore; the dialog's native Escape-to-close still runs.
        onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation() }}
        // A click on the backdrop lands on the dialog itself (its content
        // fills it edge to edge), and closes it.
        onClick={event => { if (event.target === event.currentTarget) close() }}
      >
        <div className="model-credits__content">
          <div className="model-credits__header">
            <h2 id={headingId}>3D model credits</h2>
            <button type="button" className="model-credits__close" aria-label="Close credits" onClick={close}>
              <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7m0-7l-7 7" /></svg>
            </button>
          </div>
          <dl>
            <dt>Model</dt>
            <dd>{title}</dd>
            <dt>Creator</dt>
            <dd><ExternalLink href={creatorUrl}>{creator}</ExternalLink></dd>
            <dt>Original</dt>
            <dd><ExternalLink href={sourceUrl}>{sourceName ? `View on ${sourceName}` : 'View original model'}</ExternalLink></dd>
            <dt>License</dt>
            <dd><ExternalLink href={licenseUrl}>{license}</ExternalLink></dd>
            <dt>Changes</dt>
            <dd>{modifications}</dd>
            {previousModifications && <>
              <dt>Earlier changes</dt>
              <dd>{previousModifications}</dd>
            </>}
          </dl>
          {copyrightNotice && <p className="model-credits__notice">{copyrightNotice}</p>}
          {disclaimerNotice && <p className="model-credits__notice">{disclaimerNotice}</p>}
        </div>
      </dialog>
    </div>
  )
}
