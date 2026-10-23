import * as THREE from 'three'

import type { ModelScreenBounds } from '../instrument-view'
import { projectToScreen } from '../scene/anchor-projection'
import { anatomyNoteLayout } from './anatomy-label-layout'
import { radialActionPositions } from './radial-actions-layout'

// Layout values that change only on resize, measured on first use and
// dropped by the consumer when the stage resizes (createOverlayMeasurements).
// Re-reading them every frame, after other DOM writes, forced a synchronous
// style and layout pass per rendered frame.
export type OverlayMeasurements = {
  chrome?: { top: number; bottom: number }
  actionInsets?: { left: number; right: number; top: number; bottom: number }
  textWidth?: string
}
export const createOverlayMeasurements = (): OverlayMeasurements => ({})

type Options = {
  host: HTMLElement
  // The stage size as of its last resize (stage.size()).
  viewport: { width: number; height: number }
  measurements: OverlayMeasurements
  label: HTMLElement | null
  actionLayer: HTMLElement | null
  // Keyed by action id, in the same order as `actionIds`.
  actionElements: Map<string, HTMLElement>
  actionIds: string[]
  // The focused part's world position, and the camera at the zoom's
  // destination — the note and actions project through that pose, not the
  // travelling camera, so they stay still while the zoom moves the scene.
  focusPoint: THREE.Vector3 | undefined
  noteCamera: THREE.PerspectiveCamera | undefined
  // Screen-space areas (page px) the radial actions must avoid.
  contextualMap: ModelScreenBounds | undefined
}

// The persistent chrome's height, from its CSS custom property, plus a gap.
const chromeInset = (style: CSSStyleDeclaration, property: string) =>
  Math.max(16, (Number.parseFloat(style.getPropertyValue(property)) || 0) + 16)

// Lays out the focused part's note band and radial action buttons against
// the stage, writing straight to their DOM elements.
export function writeFocusOverlay({ host, viewport, measurements, label, actionLayer, actionElements, actionIds, focusPoint, noteCamera, contextualMap }: Options) {
  const { width, height } = viewport
  if (!width || !height) return
  const orientation = width < height ? 'portrait' : 'landscape'
  // Establish the hidden entry pose before the first selection, rather
  // than changing its axis in the same frame that reveals the note. Written
  // only on change, so an unchanged frame leaves styles clean.
  if (label && label.dataset.orientation !== orientation) label.dataset.orientation = orientation
  if (!focusPoint || !noteCamera) return

  // Reads first, then writes: nothing below reads layout after a write
  // except the note text's own size, measured right after its width is set.
  // The host's page position is read every frame (a panel push or entry
  // transform moves it without a resize), but before any write.
  const hostOrigin = contextualMap ? host.getBoundingClientRect() : undefined
  measurements.chrome ??= (() => {
    const style = getComputedStyle(host)
    return { top: chromeInset(style, '--map-chrome-height'), bottom: chromeInset(style, '--map-footer-height') }
  })()
  const { top, bottom } = measurements.chrome
  if (actionLayer) measurements.actionInsets ??= (() => {
    const insets = getComputedStyle(actionLayer)
    return {
      left: Number.parseFloat(insets.paddingLeft) || 0, right: Number.parseFloat(insets.paddingRight) || 0,
      top: Number.parseFloat(insets.paddingTop) || 0, bottom: Number.parseFloat(insets.paddingBottom) || 0,
    }
  })()

  noteCamera.aspect = width / height
  noteCamera.clearViewOffset()
  noteCamera.updateProjectionMatrix()
  const projected = projectToScreen(focusPoint, noteCamera, { width, height })

  let noteBounds: ModelScreenBounds | undefined
  const text = label?.querySelector<HTMLElement>('.instrument-anatomy-label__text')
  if (label && text) {
    // Measure against the available stage width before positioning the
    // band, so a rotation or font change cannot leave stale wrapping.
    const textWidth = `${Math.min(260, Math.max(0, width - 48))}px`
    if (measurements.textWidth !== textWidth || text.style.width !== textWidth) {
      text.style.width = textWidth
      measurements.textWidth = textWidth
    }
    const position = anatomyNoteLayout(projected,
      { width: text.offsetWidth, height: text.offsetHeight }, { width, height }, { top, bottom })
    label.style.transform = `translate3d(${position.x.toFixed(1)}px, ${position.y.toFixed(1)}px, 0)`
    label.style.width = `${position.width}px`
    label.style.height = `${position.height}px`
    text.style.top = `${position.textTop}px`
    noteBounds = { left: position.x, top: position.y, width: position.width, height: position.height }
  }

  // Match the note's destination projection: the arc remains still during
  // zoom and only its entry animation travels outward.
  const obstacles: ModelScreenBounds[] = []
  if (noteBounds) obstacles.push(noteBounds)
  if (contextualMap && hostOrigin) {
    obstacles.push({ ...contextualMap, left: contextualMap.left - hostOrigin.left, top: contextualMap.top - hostOrigin.top })
  }
  if (actionLayer && actionLayer.dataset.orientation !== orientation) actionLayer.dataset.orientation = orientation
  const insets = measurements.actionInsets
  const left = Math.max(16, insets?.left ?? 0)
  const right = Math.max(16, insets?.right ?? 0)
  const safeTop = Math.max(top, insets?.top ?? 0)
  const safeBottom = Math.max(bottom, insets?.bottom ?? 0)
  const points = radialActionPositions(projected, actionIds.length,
    { left, top: safeTop, width: width - left - right, height: Math.max(0, height - safeTop - safeBottom) }, width < height, obstacles)
  for (const [index, id] of actionIds.entries()) {
    const element = actionElements.get(id)
    if (!element) continue
    const point = points[index]
    element.style.visibility = point ? 'visible' : 'hidden'
    element.dataset.positioned = String(Boolean(point))
    if (!point) continue
    element.style.transform = `translate3d(${point.x}px, ${point.y}px, 0) translate(-50%, -50%)`
  }
}
