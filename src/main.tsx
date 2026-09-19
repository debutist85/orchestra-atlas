import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App, isChunkPlaybackPoc } from './app/App'
import { listeningEngine } from './features/listening/listening-engine'
import { connectNavigationRoute } from './store/navigation-route'
import './styles/global.css'

if (!isChunkPlaybackPoc()) {
  connectNavigationRoute()
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
