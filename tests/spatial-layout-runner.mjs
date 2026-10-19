import { verifyInstrumentModelResource } from './instrument-model-resource.mjs'
import { verifyModelInspector } from './model-inspector.mjs'
import { verifyExplorerLayout } from './explorer-layout.mjs'
import { verifyOrbitEnvelope } from './orbit-envelope.mjs'
import { createServer } from 'vite'
import { verifySpatialLayout } from './spatial-layout.mjs'
import { verifySpatialTypography } from './spatial-typography.mjs'
import { verifyCaptionPlacement } from './caption-placement.mjs'
import { verifyCaptionFraming } from './caption-framing.mjs'
import { verifyEntityLayout } from './entity-layout.mjs'
import { verifyModelExtent } from './model-extent.mjs'
import { verifyModelPreparation } from './model-preparation.mjs'

// SSR-only checks must not replace the browser dev server's optimized modules.
const server = await createServer({
  configFile: false,
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
})
try {
  for (const check of [verifyInstrumentModelResource, verifyModelInspector, verifyExplorerLayout, verifyOrbitEnvelope, verifySpatialLayout, verifySpatialTypography, verifyCaptionPlacement, verifyCaptionFraming, verifyEntityLayout, verifyModelExtent, verifyModelPreparation]) await check(server)
} finally {
  await server.close()
}
