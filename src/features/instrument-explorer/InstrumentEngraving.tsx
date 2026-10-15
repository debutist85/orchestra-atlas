import { mediaUrl } from '../../lib/media-url'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { instrumentIdentityLayouts } from '../orchestra-map/identity-layout/instruments'

export function InstrumentEngraving({ instrumentId }: { instrumentId: OrchestraInstrument }) {
  const src = instrumentIdentityLayouts[instrumentId].landscape.figure?.src
  if (!src) return null
  return <div className="instrument-explore__engraving" aria-hidden="true">
    <img src={mediaUrl(src)} alt="" draggable={false} />
  </div>
}
