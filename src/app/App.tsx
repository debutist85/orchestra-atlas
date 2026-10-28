import { lazy, Suspense } from 'react'
import { OrchestraMap } from '../features/orchestra-map'
import { isLiquidOrbPreview, isStylePreview } from './entry-mode'

const StylePreview = import.meta.env.DEV
  ? lazy(() => import('./StylePreview'))
  : null

const LiquidOrb = import.meta.env.DEV
  ? lazy(() => import('../features/liquid-orb/LiquidOrb'))
  : null

export function App() {
  if (isLiquidOrbPreview() && LiquidOrb) {
    return <Suspense fallback={<p role="status">Loading liquid light study</p>}><LiquidOrb /></Suspense>
  }
  if (isStylePreview() && StylePreview) {
    return <Suspense fallback={<p role="status">Loading style preview</p>}><StylePreview /></Suspense>
  }
  return <OrchestraMap />
}
