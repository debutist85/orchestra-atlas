import { lazy, Suspense } from 'react'
import { OrchestraMap } from '../features/orchestra-map'
import { isStylePreview } from './entry-mode'

const StylePreview = import.meta.env.DEV
  ? lazy(() => import('./StylePreview'))
  : null

export function App() {
  if (isStylePreview() && StylePreview) {
    return <Suspense fallback={<p role="status">Loading style preview</p>}><StylePreview /></Suspense>
  }
  return <OrchestraMap />
}
