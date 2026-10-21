import type { ComponentProps } from 'react'
import { BackArrow } from './BackArrow'

// Shared with the development preview so its focus and responsive treatment
// cannot drift from the actual navigation control. Navigation stays with callers.
export function HeaderBackButton({ children, ...props }: Omit<ComponentProps<'button'>, 'className'>) {
  return <button
    {...props}
    type="button"
    className={[
      'map-header-back pointer-events-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center',
      'border-0 bg-transparent px-[10px] py-2 font-sans text-[11px] leading-[1.4] tracking-[0.12em] text-navigation uppercase whitespace-nowrap cursor-pointer',
      '[@media(max-width:480px)]:text-[10px] [@media(max-width:480px)]:tracking-[0.08em]',
      'disabled:cursor-default disabled:text-text-secondary hover:text-white focus-visible:text-white disabled:hover:text-white disabled:focus-visible:text-white',
      'focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus focus-visible:outline-offset-[3px]',
    ].join(' ')}
  ><span className="inline-flex items-center gap-[0.45em]"><BackArrow />{children}</span></button>
}
