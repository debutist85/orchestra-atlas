import type { ComponentProps } from 'react'

export function DebugButton(props: Omit<ComponentProps<'button'>, 'className'>) {
  return <button {...props} type="button"
    className="justify-self-start border border-ivory/40 bg-transparent px-2 py-[0.2rem] text-inherit cursor-pointer aria-pressed:bg-ivory/20" />
}
