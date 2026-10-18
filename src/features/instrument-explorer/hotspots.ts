import type { OrchestraInstrument } from '../orchestra-map/config'
import type { CameraPreset, Vec3 } from './anatomy-camera'

// Hotspots are authored in the browser (dev-only Hotspot Editor, ?debug=true)
// rather than as empties in the GLB like the Anchor_ nodes — so adding or
// moving one never needs Blender or a re-export. `position` is in the model's
// own GLB-root coordinates (before ViolinModel.tsx's runtime rotation and
// re-centering), so it stays attached to the same spot however the model is
// posed. `view` uses the same world-space CameraPreset as anatomy-camera.ts.
export type HotspotView = { landscape?: CameraPreset; portrait?: CameraPreset }
export type Hotspot = {
  id: string
  title: string
  description: string
  position: Vec3
  view?: HotspotView
}
export type HotspotConfig = { hotspots: Hotspot[] }

// One file per instrument, named by instrument id (hotspots/violin.json,
// hotspots/timpani.json, …) — picked up automatically, no registration step.
const configFiles = import.meta.glob<unknown>('./hotspots/*.json', { eager: true, import: 'default' })

export function configuredHotspots(instrumentId: OrchestraInstrument): Hotspot[] {
  const file = configFiles[`./hotspots/${instrumentId}.json`]
  return file === undefined ? [] : parseHotspotConfig(file)
}

export function hotspotConfigPath(instrumentId: OrchestraInstrument) {
  return `src/features/instrument-explorer/hotspots/${instrumentId}.json`
}

const isVec3 = (value: unknown): value is Vec3 =>
  Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n))

const isPreset = (value: unknown): value is CameraPreset =>
  typeof value === 'object' && value !== null && isVec3((value as CameraPreset).target) && isVec3((value as CameraPreset).position)

// Malformed entries are dropped (with a dev warning) rather than failing the
// whole instrument — a hand-edited JSON typo shouldn't take the viewer down.
export function parseHotspotConfig(value: unknown): Hotspot[] {
  const list = typeof value === 'object' && value !== null ? (value as Partial<HotspotConfig>).hotspots : undefined
  if (!Array.isArray(list)) return []
  return list.flatMap(item => {
    const { id, title, description, position, view } = (item ?? {}) as Partial<Hotspot>
    if (typeof id !== 'string' || !id || !isVec3(position)) {
      if (import.meta.env?.DEV) console.warn('Skipping malformed hotspot', item)
      return []
    }
    const hotspot: Hotspot = { id, title: typeof title === 'string' ? title : '', description: typeof description === 'string' ? description : '', position }
    const landscape = isPreset(view?.landscape) ? view.landscape : undefined
    const portrait = isPreset(view?.portrait) ? view.portrait : undefined
    if (landscape || portrait) hotspot.view = { ...(landscape && { landscape }), ...(portrait && { portrait }) }
    return [hotspot]
  })
}

export function serializeHotspots(hotspots: Hotspot[]) {
  return `${JSON.stringify({ hotspots } satisfies HotspotConfig, null, 2)}\n`
}

// Either orientation falls back to the other, so a view captured once works
// everywhere until a second, orientation-specific one is captured.
export function hotspotCameraPreset(hotspot: Hotspot, orientation: 'portrait' | 'landscape'): CameraPreset | undefined {
  const { landscape, portrait } = hotspot.view ?? {}
  return orientation === 'portrait' ? (portrait ?? landscape) : (landscape ?? portrait)
}

// Anchor_ is reserved for GLB-authored anchors, which share the anatomy
// store's selectedPartId namespace with hotspots.
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
export function hotspotIdError(id: string, hotspots: Hotspot[], currentId?: string): string | undefined {
  if (!ID_PATTERN.test(id)) return 'Use letters, numbers, - or _'
  if (id.startsWith('Anchor_')) return 'Anchor_ is reserved for model anchors'
  if (id !== currentId && hotspots.some(hotspot => hotspot.id === id)) return 'ID already in use'
  return undefined
}

export function nextHotspotId(hotspots: Hotspot[]) {
  const ids = new Set(hotspots.map(hotspot => hotspot.id))
  let n = 1
  while (ids.has(`hotspot-${n}`)) n += 1
  return `hotspot-${n}`
}

// Same 4-decimal precision as the existing "Copy camera preset" output.
export const roundVec3 = (values: readonly number[]): Vec3 => [values[0], values[1], values[2]].map(n => Number(n.toFixed(4))) as Vec3
