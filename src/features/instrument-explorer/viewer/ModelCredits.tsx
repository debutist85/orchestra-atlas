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

// The 3D model's credits, entirely from its attribution data. A native modal
// <dialog> provides focus containment, Escape to close, an inert page behind
// it, and focus returning to the toggle on close.
export function ModelCredits({ attribution }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const { title, creator, creatorUrl, sourceUrl, sourceName, license, licenseUrl, modifications, previousModifications, copyrightNotice, disclaimerNotice } = attribution
  const close = () => dialogRef.current?.close()

  return (
    <div className="model-credits pointer-events-auto absolute right-[max(0.75rem,env(safe-area-inset-right))] bottom-0 flex h-(--map-footer-height) items-center [@media(max-width:820px)]:bottom-(--map-footer-height) [@media(max-width:820px)]:h-auto">
      <button type="button" className="model-credits__toggle inline-flex min-h-0 items-center gap-[0.35rem] rounded-none border-0 bg-transparent px-control-inset py-0 text-control-label tracking-control text-text-control uppercase whitespace-nowrap cursor-pointer [@media(max-width:480px)]:min-w-11 [@media(max-width:480px)]:justify-center focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus focus-visible:-outline-offset-2" aria-haspopup="dialog" onClick={() => dialogRef.current?.showModal()}>
        <svg className="model-credits__icon block size-[13px] flex-none fill-current" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M6 0.75a5.25 5.25 0 1 1 0 10.5A5.25 5.25 0 0 1 6 0.75Zm0 1a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5ZM6 5a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0v-3A.5.5 0 0 1 6 5Zm0-1.9a.65.65 0 1 1 0 1.3.65.65 0 0 1 0-1.3Z" />
        </svg>
        <span className="model-credits__label [@media(max-width:480px)]:absolute [@media(max-width:480px)]:size-px [@media(max-width:480px)]:overflow-hidden [@media(max-width:480px)]:[clip:rect(0,0,0,0)] [@media(max-width:480px)]:whitespace-nowrap">3D Model Credits</span>
      </button>
      <dialog
        ref={dialogRef}
        className="model-credits__panel m-auto w-[min(26rem,calc(100vw-2rem))] max-h-[min(36rem,calc(100dvh-2rem))] border border-ivory/18 bg-ink p-0 text-[0.85rem] leading-[1.45] text-ivory backdrop:bg-black/55"
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
    </div>
  )
}
