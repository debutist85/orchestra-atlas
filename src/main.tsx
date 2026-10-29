import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app/App'
import { isActivityReview, isLiquidOrbPreview, isStylePreview } from './app/entry-mode'
import { listeningEngine } from './features/listening/listening-engine'
import { connectNavigationRoute } from './store/navigation-route'
import { trackInputModality } from './lib/input-modality'
import './styles/global.css'

const stopTrackingInputModality = trackInputModality()
if (import.meta.hot) import.meta.hot.dispose(stopTrackingInputModality)

if (!isStylePreview() && !isActivityReview()) {
  if (!isLiquidOrbPreview()) connectNavigationRoute()
  const disconnectListening = listeningEngine.connect()
  if (import.meta.hot) import.meta.hot.dispose(() => {
    disconnectListening()
    listeningEngine.dispose()
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
