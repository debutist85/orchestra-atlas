import type { ComponentProps } from 'react'

// Shared with the development preview so its focus and responsive treatment
// cannot drift from the actual navigation control. Navigation stays with callers.
export function HeaderBackButton({ children, ...props }: Omit<ComponentProps<'button'>, 'className'>) {
  return <button
    {...props}
    type="button"
    className={[
      'map-header-back pointer-events-auto inline-flex min-h-[44px] min-w-[44px] items-center justify-center',
      'rounded-none border-0 bg-transparent p-0 font-sans text-[10px] leading-[1.4] tracking-[0.12em] text-navigation uppercase whitespace-nowrap cursor-pointer',
      '[@media(max-width:480px)]:text-[9px] [@media(max-width:480px)]:tracking-[0.08em]',
      'disabled:cursor-default disabled:text-text-secondary hover:text-white focus-visible:text-white disabled:hover:text-white disabled:focus-visible:text-white',
      'focus-visible:outline-solid focus-visible:outline-(length:--focus-ring-width) focus-visible:outline-focus focus-visible:outline-offset-[3px]',
    ].join(' ')}
  ><span className="inline-block px-[0.4em] py-[0.12em]">{children}</span></button>
}
