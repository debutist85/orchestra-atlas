import { useId, useRef, type ReactNode } from 'react'

import type { ModelAttribution } from '../content/explorable-instruments'

type Props = { attribution: ModelAttribution }

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="text-inherit underline underline-offset-[0.15em] focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus focus-visible:outline-offset-2" href={href} target="_blank" rel="noopener noreferrer">
      {children}<span className="sr-only"> (opens in a new tab)</span>
    </a>
  )
}

// The 3D model's credits, entirely from its attribution data, opened from
// the instrument description, in place of its eyebrow (SpatialTypography). A native
// modal <dialog> provides focus containment, Escape to close, an inert page
// behind it, and focus returning to the toggle on close; it renders in the
// top layer, so the description's transforms do not affect it.
export function ModelCredits({ attribution }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const { title, creator, creatorUrl, sourceUrl, sourceName, license, licenseUrl, modifications, previousModifications, copyrightNotice, disclaimerNotice } = attribution
  const close = () => dialogRef.current?.close()

  return (
    <>
      <button type="button" className="model-credits__toggle inline-flex shrink-0 cursor-pointer whitespace-nowrap items-center gap-[0.45rem] border-0 bg-transparent p-0 text-inherit uppercase tracking-[inherit] hover:text-ivory focus-visible:text-ivory focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus focus-visible:outline-offset-[3px]" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        {/* Lucide Info. Provenance and license: public/licenses/lucide.txt. */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        3D model credits
      </button>
      <dialog
        ref={dialogRef}
        // Reset what the dialog would inherit from the small uppercase line
        // its toggle sits in (it renders in the top layer, but inherits).
        className="model-credits__panel m-auto w-[min(26rem,calc(100vw-2rem))] normal-case tracking-normal whitespace-normal text-left max-h-[min(36rem,calc(100dvh-2rem))] border border-ivory/18 bg-ink p-0 text-[0.85rem] leading-[1.45] text-ivory backdrop:bg-black/55"
        aria-labelledby={headingId}
        // The explorer's own Escape handler (on window) would also leave
        // Explore; the dialog's native Escape-to-close still runs.
        onKeyDown={event => { if (event.key === 'Escape') event.stopPropagation() }}
        // A click on the backdrop lands on the dialog itself (its content
        // fills it edge to edge), and closes it.
        onClick={event => { if (event.target === event.currentTarget) close() }}
      >
        <div className="model-credits__content px-[1.15rem] pt-4 pb-[1.15rem]">
          <div className="model-credits__header mb-3 flex items-center justify-between gap-4">
            <h2 className="m-0 text-control-label font-normal tracking-[0.08em] text-mist uppercase" id={headingId}>3D model credits</h2>
            <button type="button" className="model-credits__close grid size-11 place-items-center mt-[-0.65rem] mr-[-0.75rem] mb-[-0.65rem] ml-0 border-0 bg-transparent p-0 text-inherit cursor-pointer focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus focus-visible:outline-offset-2" aria-label="Close credits" onClick={close}>
              <svg className="size-[14px] fill-none stroke-current stroke-[1.2]" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 2.5l7 7m0-7l-7 7" /></svg>
            </button>
          </div>
          <dl className="m-0 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-[0.45rem] [@media(max-width:480px)]:grid-cols-[minmax(0,1fr)] [@media(max-width:480px)]:gap-[0.1rem]">
            <dt className="text-mist">Model</dt>
            <dd className="m-0 [overflow-wrap:anywhere] [@media(max-width:480px)]:mb-[0.45rem]">{title}</dd>
            <dt className="text-mist">Creator</dt>
            <dd className="m-0 [overflow-wrap:anywhere] [@media(max-width:480px)]:mb-[0.45rem]"><ExternalLink href={creatorUrl}>{creator}</ExternalLink></dd>
            <dt className="text-mist">Original</dt>
            <dd className="m-0 [overflow-wrap:anywhere] [@media(max-width:480px)]:mb-[0.45rem]"><ExternalLink href={sourceUrl}>{sourceName ? `View on ${sourceName}` : 'View original model'}</ExternalLink></dd>
            <dt className="text-mist">License</dt>
            <dd className="m-0 [overflow-wrap:anywhere] [@media(max-width:480px)]:mb-[0.45rem]"><ExternalLink href={licenseUrl}>{license}</ExternalLink></dd>
            <dt className="text-mist">Changes</dt>
            <dd className="m-0 [overflow-wrap:anywhere] [@media(max-width:480px)]:mb-[0.45rem]">{modifications}</dd>
            {previousModifications && <>
              <dt className="text-mist">Earlier changes</dt>
              <dd className="m-0 [overflow-wrap:anywhere] [@media(max-width:480px)]:mb-[0.45rem]">{previousModifications}</dd>
            </>}
          </dl>
          {copyrightNotice && <p className="model-credits__notice mt-[0.9rem] mb-0 text-mist">{copyrightNotice}</p>}
          {disclaimerNotice && <p className="model-credits__notice mt-[0.9rem] mb-0 text-mist">{disclaimerNotice}</p>}
        </div>
      </dialog>
    </>
  )
}
