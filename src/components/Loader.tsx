import type { CSSProperties } from 'react'

type LoaderProps = {
  label?: string
  size?: number
}

export function Loader({ label = 'Loading', size }: LoaderProps) {
  return (
    <span
      className="loader relative inline-block size-(--loader-size)"
      role="status"
      aria-label={label}
      style={size ? ({ '--loader-size': `${size}px` } as CSSProperties) : undefined}
    />
  )
}
