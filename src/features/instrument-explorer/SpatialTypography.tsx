import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from 'react'
import { gsap } from 'gsap'

import { useAnatomyStore } from '../../store/anatomy-store'
import { useExploreLayoutStore } from '../../store/explore-layout-store'
import type { OrchestraInstrument } from '../orchestra-map/config'
import { navigationTiming, identityTrackingExpansionEm } from '../orchestra-map/three/navigation-motion'
import { placeDescription, reserveDescriptionArea, type DescriptionPlacement } from './instrument-description'
import { instrumentExplorerConfig } from './config'
import type { InstrumentViewSignal, ModelScreenBounds } from './instrument-view'
import { captureTravelAnchor, projectTravelAnchor, type TravelAnchor } from './label-travel'
import {
  alignFactor,
  dampTowards,
  layoutPlanes,
  orbitDeflection,
  parallaxScale,
  composeStage,
  labelSideFor,
  planePosition,
  planeReach,
  spatialTextOffset,
  spatialTypographyConfig as config,
  type LabelSide,
  type SpatialPlaneId,
  type SpatialTextId,
} from './spatial-typography'

type Props = {
  instrumentId: OrchestraInstrument
  familyName: string
  instrumentName: string
  description?: string
  view: InstrumentViewSignal
}

type TextRefs = Record<SpatialTextId, RefObject<HTMLElement | null>>

const travelingAttribute = 'traveling'
const settledEvent = 'spatial-type:settled'

// All per-frame text motion, written straight to the elements from the GSAP
// ticker so it never re-renders React:
//
// - Parallax: damped offsets derived from the camera orbit. The ticker only
//   runs while they are still travelling toward the camera-derived target.
// - Hotspot zoom: when a part is focused, each title travels with the zoom
//   (label-travel.ts) — away from the part's on-screen position and larger
//   as the camera dollies in, home again as it pulls back. It
//   fades out while its letter spacing opens, with the same timing as a
//   departing map caption (navigation-motion.ts); returning reverses it.
//   Parallax and stage layout are suspended meanwhile, since the titles'
//   transform and size are owned by the travel.
function useSpatialMotion(view: InstrumentViewSignal, stageRef: RefObject<HTMLElement | null>, refs: TextRefs, descriptionLayoutRef: RefObject<DescriptionPlacement | null>) {
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ids = Object.keys(config.text) as SpatialTextId[]
    const elementOf = (id: SpatialTextId) => refs[id].current
    const planeScaleOf = (id: SpatialTextId) => config.planes[config.text[id].plane].scale
    const stageSize = () => ({ width: stage.clientWidth, height: stage.clientHeight })

    // Parallax
    const current = Object.fromEntries(ids.map(id => [id, { x: 0, y: 0 }])) as Record<SpatialTextId, { x: number; y: number }>
    const writeParallax = (id: SpatialTextId) => {
      const element = elementOf(id)
      if (element) element.style.transform = `translate3d(${current[id].x.toFixed(2)}px, ${current[id].y.toFixed(2)}px, 0)`
    }
    const copy = stage.querySelector<HTMLElement>('.instrument-explore__description')
    let copyPosition: { x: number; y: number } | undefined
    const writeDescription = (dt: number) => {
      const layout = descriptionLayoutRef.current
      if (!copy || !layout) return true
      const { x, y } = layout
      if (!copyPosition || reduced) copyPosition = { x, y }
      else {
        copyPosition.x = dampTowards(copyPosition.x, x, config.damping, dt)
        copyPosition.y = dampTowards(copyPosition.y, y, config.damping, dt)
        // A resize may shrink the safe area; containment takes precedence
        // over damping until the position is back inside its new limits.
        copyPosition.x = Math.max(layout.minX, Math.min(layout.maxX, copyPosition.x))
        copyPosition.y = Math.max(layout.minY, Math.min(layout.maxY, copyPosition.y))
      }
      const settled = Math.abs(copyPosition.x - x) < 0.05 && Math.abs(copyPosition.y - y) < 0.05
      if (settled) copyPosition = { x, y }
      copy.style.transform = `translate3d(${copyPosition.x.toFixed(2)}px, ${copyPosition.y.toFixed(2)}px, 0)`
      return settled
    }
    let running = false
    let traveling = false
    const tick = (_time: number, deltaMs: number) => {
      if (traveling) { stop(); return }
      const deflection = orbitDeflection(view.get())
      const scale = parallaxScale(stage.clientWidth)
      // A tab returning from the background reports one huge delta; clamp
      // it so the text eases back rather than teleporting.
      const dt = Math.min(deltaMs, 100) / 1000
      let settled = writeDescription(dt)
      for (const id of ids) {
        const target = spatialTextOffset(id, deflection, scale)
        const next = current[id]
        next.x = dampTowards(next.x, target.x, config.damping, dt)
        next.y = dampTowards(next.y, target.y, config.damping, dt)
        if (Math.abs(next.x - target.x) > 0.05 || Math.abs(next.y - target.y) > 0.05) settled = false
        else { next.x = target.x; next.y = target.y }
        writeParallax(id)
      }
      if (settled) stop()
    }
    const start = () => {
      if (reduced) { writeDescription(0); return }
      if (running || traveling) return
      running = true
      gsap.ticker.add(tick)
    }
    const stop = () => {
      running = false
      gsap.ticker.remove(tick)
    }

    // Hotspot zoom travel
    type Anchor = TravelAnchor & { layoutCenter: { x: number; y: number } }
    let anchors: Partial<Record<SpatialTextId, Anchor>> | undefined
    let tracking: Partial<Record<SpatialTextId, { rest: number; open: number }>> = {}
    let timeline: gsap.core.Timeline | undefined
    // 0..1 of the departing-caption treatment: invisible and fully opened.
    const departure = { progress: 0 }

    const captureAnchors = () => {
      const rig = view.getCameraRig()
      if (!rig) return undefined
      const stageBox = stage.getBoundingClientRect()
      const captured: Partial<Record<SpatialTextId, Anchor>> = {}
      for (const id of ids) {
        const element = elementOf(id)
        if (!element) continue
        const box = element.getBoundingClientRect()
        const center = { x: box.left + box.width / 2 - stageBox.left, y: box.top + box.height / 2 - stageBox.top }
        // Where the text sits without its parallax offset (which is applied
        // inside the plane's scale).
        const planeScale = planeScaleOf(id)
        const layoutCenter = { x: center.x - current[id].x * planeScale, y: center.y - current[id].y * planeScale }
        const nearer = config.planes[config.text[id].plane].depth * config.travelDepthSpacing
        captured[id] = { ...captureTravelAnchor(center, rig, nearer), layoutCenter }
      }
      return captured
    }
    const captureTracking = () => {
      tracking = {}
      for (const id of ids) {
        const element = elementOf(id)
        if (!element) continue
        element.style.removeProperty('letter-spacing')
        const style = getComputedStyle(element)
        tracking[id] = { rest: px(style.letterSpacing), open: px(style.fontSize) * identityTrackingExpansionEm }
      }
    }
    const writeTravel = () => {
      const rig = view.getCameraRig()
      const size = stageSize()
      for (const id of ids) {
        const element = elementOf(id)
        if (!element) continue
        const track = tracking[id]
        element.style.opacity = String(1 - departure.progress)
        if (track) element.style.letterSpacing = `${track.rest + track.open * departure.progress}px`
        const anchor = anchors?.[id]
        if (!anchor || !rig) continue
        const projected = projectTravelAnchor(anchor, rig, size)
        if (!projected) { element.style.opacity = '0'; continue }
        const planeScale = planeScaleOf(id)
        const dx = (projected.x - anchor.layoutCenter.x) / planeScale
        const dy = (projected.y - anchor.layoutCenter.y) / planeScale
        element.style.transform = `translate3d(${dx.toFixed(2)}px, ${dy.toFixed(2)}px, 0) scale(${Math.min(projected.scale, 8).toFixed(4)})`
      }
    }
    const settle = () => {
      traveling = false
      anchors = undefined
      for (const id of ids) {
        const element = elementOf(id)
        if (!element) continue
        for (const property of ['opacity', 'letter-spacing', 'visibility']) element.style.removeProperty(property)
        writeParallax(id)
      }
      delete stage.dataset[travelingAttribute]
      stage.dispatchEvent(new Event(settledEvent))
      start()
    }
    const travel = (direction: 'out' | 'in') => {
      timeline?.kill()
      if (!traveling) {
        // Starting from rest. (Interrupting a return keeps the anchors and
        // spacing already in flight, so the reversal is seamless.)
        stop()
        captureTracking()
        anchors = reduced ? undefined : captureAnchors()
        traveling = true
        stage.dataset[travelingAttribute] = 'true'
      }
      for (const id of ids) elementOf(id)?.style.removeProperty('visibility')
      const progress = direction === 'out' ? 1 : 0
      const arrive = () => {
        if (direction === 'in') { settle(); return }
        // Fully departed: out of the accessibility tree and pointer path
        // until the camera returns.
        for (const id of ids) {
          const element = elementOf(id)
          if (element) element.style.visibility = 'hidden'
        }
      }
      if (reduced) {
        departure.progress = progress
        writeTravel()
        arrive()
        return
      }
      timeline = gsap.timeline({ onUpdate: writeTravel, onComplete: arrive })
      timeline.to(departure, {
        progress,
        duration: navigationTiming.travelDuration,
        ease: navigationTiming.travelEase,
      }, navigationTiming.travelStart)
      // Keep following the camera until its move lands.
      timeline.to({}, { duration: instrumentExplorerConfig.focus.duration }, 0)
    }

    const unsubscribeAnatomy = useAnatomyStore.subscribe((state, previous) => {
      const focused = state.selectedPartId !== null
      if (focused === (previous.selectedPartId !== null)) return
      travel(focused ? 'out' : 'in')
    })
    stage.addEventListener('description:layout', start)
    const unsubscribe = view.subscribe(start)
    const observer = new ResizeObserver(start)
    observer.observe(stage)
    start()
    return () => {
      stage.removeEventListener('description:layout', start)
      unsubscribeAnatomy()
      unsubscribe()
      observer.disconnect()
      stop()
      timeline?.kill()
      delete stage.dataset[travelingAttribute]
    }
  }, [view, stageRef, refs, descriptionLayoutRef])
}

const planeIds = Object.keys(config.planes) as SpatialPlaneId[]

const px = (value: string) => Number.parseFloat(value) || 0

// Composes the full-instrument stage and places the labels in it. The
// available area is the viewport's safe area between the header and footer
// bars, less the edge margin. The label group is measured first, then the
// area is split: the labels get their own side (on top on a portrait stage,
// otherwise right of a tall model or above a wide one) and the model gets a
// frame matched to its aspect in the rest, both kept clear of the contextual
// minimap. The frame is published for ViolinModel to frame into. The planes
// are then laid out relative to the model's measured bounds, confined to the
// labels' side — never over the model's box, so hotspots stay uncovered —
// with each plane's width capped to the space it has. Runs on resize, when
// the model is (re)measured or the minimap settles, and when a plane's own
// size changes (web font arrival) — never per frame.
function useInstrumentStageLayout(
  view: InstrumentViewSignal,
  rootRef: RefObject<HTMLElement | null>,
  instrumentId: OrchestraInstrument,
  side: LabelSide,
  descriptionLayoutRef: RefObject<DescriptionPlacement | null>,
  description?: string,
) {
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    let lastBounds: ModelScreenBounds | undefined
    let lastAspect: number | undefined
    const planes = planeIds.flatMap(id => {
      const element = root.querySelector<HTMLElement>(`[data-plane="${id}"]`)
      return element ? [{ id, element }] : []
    })

    const layout = () => {
      // While the titles travel with a hotspot zoom, their size and transform
      // belong to the travel; the settled event re-runs layout afterwards.
      if (root.dataset[travelingAttribute]) return
      const stage = { width: root.clientWidth, height: root.clientHeight }
      if (!stage.width || !stage.height) return
      lastBounds = view.getModelBounds()
      lastAspect = view.getModelAspect()
      // The root's padding is the viewport safe-area inset (see the
      // stylesheet) — read back resolved, since env() can't be read directly.
      const style = getComputedStyle(root)
      const safe = {
        left: px(style.paddingLeft),
        top: Math.max(px(style.getPropertyValue('--map-chrome-height')), px(style.paddingTop)),
        right: stage.width - px(style.paddingRight),
        bottom: stage.height - Math.max(px(style.getPropertyValue('--map-footer-height')), px(style.paddingBottom)),
      }
      const inset = (margin: number) => ({ left: safe.left + margin, top: safe.top + margin, right: safe.right - margin, bottom: safe.bottom - margin })
      let area = inset(config.edgeMargin)
      let modelArea = inset(config.modelEdgeMargin)
      const inputs = planes.map(({ id, element }) => {
        const scale = config.planes[id].scale
        return {
          id,
          position: planePosition(id, side, instrumentId),
          reach: planeReach(id, stage.width),
          measure: (maxWidth: number) => {
            element.style.maxWidth = `${maxWidth / scale}px`
            return { width: element.offsetWidth * scale, height: element.offsetHeight * scale }
          },
        }
      })

      // Contextual minimap in stage px (it is published in viewport px).
      // Measured against the explore section — the same box as this layer,
      // but never transformed: this layer's own rect moves with the reveal
      // animation's translate, which would offset the minimap and compose
      // the stage a few px off until the next layout.
      const map = useExploreLayoutStore.getState().contextualMap
      const rootBounds = (root.closest('.instrument-explore') ?? root).getBoundingClientRect()
      const minimap = map ? { ...map, left: map.left - rootBounds.left, top: map.top - rootBounds.top } : undefined
      const copy = root.querySelector<HTMLElement>('.instrument-explore__description')
      const portrait = stage.width < stage.height
      // Mirror the title side: tall models have side labels, wide models
      // have labels above. Portrait always keeps the description at bottom.
      const descriptionSide = portrait ? 'bottom' : side === 'top' ? 'below' : 'left'
      const descriptionSafeArea = area
      const descriptionGap = 40
      if (copy) {
        copy.dataset.orientation = portrait ? 'portrait' : 'landscape'
        // Include the heading and actual text wrapping in
        // the reservation, including changes from fonts and text zoom.
        const copyArea = portrait ? { ...area, left: area.left + 8, right: area.right - 8 } : area
        const compact = Math.min(stage.width, stage.height) < 600
        const availableWidth = copyArea.right - copyArea.left
        const width = portrait
          ? Math.min(availableWidth, compact ? 320 : availableWidth)
          : Math.min(compact ? 220 : 280, availableWidth * (compact ? 0.32 : 0.4))
        copy.style.width = `${width}px`
        const reserved = reserveDescriptionArea(copyArea, descriptionSide, {
          width: copy.offsetWidth,
          height: copy.offsetHeight,
        }, minimap, descriptionGap)
        copy.style.left = '0px'
        copy.style.top = '0px'
        area = reserved.available
        modelArea = descriptionSide !== 'left'
          ? { ...modelArea, bottom: Math.min(modelArea.bottom, area.bottom) }
          : { ...modelArea, left: Math.max(modelArea.left, area.left) }
      }
      const composition = composeStage(inputs, area, modelArea, side, lastAspect ?? config.placeholderModelAspect, minimap)
      view.setModelFrame(composition.model)
      // Until the model reports bounds for this frame, its frame stands in;
      // the bounds update re-runs this layout.
      const bounds = view.getModelBounds() ?? composition.model

      if (copy) {
        descriptionLayoutRef.current = placeDescription(descriptionSafeArea, descriptionSide,
          { width: copy.offsetWidth, height: copy.offsetHeight }, bounds, minimap, descriptionGap)
        root.dispatchEvent(new Event('description:layout'))
      }
      const result = layoutPlanes(inputs, bounds, composition.labels, config.minPlaneWidth)

      for (const { id, element } of planes) {
        const point = result.points[id]
        if (!point) continue
        element.style.left = `${point.x}px`
        element.style.top = `${point.y}px`
      }
    }
    layout()
    const unsubscribe = view.subscribe(() => {
      if (view.getModelBounds() !== lastBounds || view.getModelAspect() !== lastAspect) layout()
    })
    const unsubscribeMap = useExploreLayoutStore.subscribe((state, previous) => {
      if (state.contextualMap !== previous.contextualMap) layout()
    })
    root.addEventListener(settledEvent, layout)
    const observer = new ResizeObserver(layout)
    observer.observe(root)
    for (const { element } of planes) observer.observe(element)
    const copy = root.querySelector('.instrument-explore__description')
    if (copy) observer.observe(copy)
    return () => {
      unsubscribe()
      unsubscribeMap()
      root.removeEventListener(settledEvent, layout)
      observer.disconnect()
    }
  }, [view, rootRef, instrumentId, side, description, descriptionLayoutRef])
}

const horizontal = { start: 'left', center: 'center', end: 'right' } as const
const vertical = { start: 'top', center: 'center', end: 'bottom' } as const

function planeStyle(id: SpatialPlaneId, side: LabelSide, instrumentId: OrchestraInstrument): CSSProperties {
  const plane = config.planes[id]
  const position = planePosition(id, side, instrumentId)
  return {
    '--plane-align': horizontal[position.alignX],
    '--plane-shift-x': `${-alignFactor(position.alignX) * 100}%`,
    '--plane-shift-y': `${-alignFactor(position.alignY) * 100}%`,
    '--plane-origin': `${horizontal[position.alignX]} ${vertical[position.alignY]}`,
    '--plane-opacity': plane.opacity,
    '--plane-scale': plane.scale,
    '--plane-blur': `${plane.blur ?? 0}px`,
    zIndex: plane.depth > 0 ? 2 : 1,
  } as CSSProperties
}

export function SpatialTypography({ instrumentId, familyName, instrumentName, description, view }: Props) {
  const rootRef = useRef<HTMLElement>(null)
  const descriptionLayoutRef = useRef<DescriptionPlacement | null>(null)
  const familyRef = useRef<HTMLElement>(null)
  const instrumentRef = useRef<HTMLElement>(null)
  const [refs] = useState<TextRefs>(() => ({ familyTitle: familyRef, instrumentTitle: instrumentRef }))
  // Re-renders only when the side flips (the model's aspect becomes known,
  // or the stage turns between portrait and landscape), not on every
  // signal update.
  const modelAspect = useSyncExternalStore(view.subscribe, view.getModelAspect)
  const [stageOrientation, setStageOrientation] = useState<'portrait' | 'landscape'>('landscape')
  const side = labelSideFor(modelAspect ?? config.placeholderModelAspect, stageOrientation)
  // While a part is focused the titles have travelled out with the zoom
  // (useSpatialMotion) and AnatomyPanel holds the part content.
  const focused = useAnatomyStore(state => state.selectedPartId !== null)

  const zoomed = useSyncExternalStore(view.subscribe, view.getZoomed)

  useSpatialMotion(view, rootRef, refs, descriptionLayoutRef)
  useInstrumentStageLayout(view, rootRef, instrumentId, side, descriptionLayoutRef, description)

  // Same portrait/landscape rule as the model framing (ViolinModel.tsx).
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const update = () => setStageOrientation(root.clientWidth < root.clientHeight ? 'portrait' : 'landscape')
    update()
    const observer = new ResizeObserver(update)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <header ref={rootRef} className="spatial-type" aria-hidden={focused || undefined}>
      <div className="spatial-type__plane" data-plane="family" style={planeStyle('family', side, instrumentId)}>
        <p ref={familyRef as RefObject<HTMLParagraphElement>} className="spatial-type__text spatial-type__family" data-text="familyTitle"><span data-explore-entry="left">{familyName}</span></p>
      </div>
      <div className="spatial-type__plane" data-plane="instrument" style={planeStyle('instrument', side, instrumentId)}>
        <h2 ref={instrumentRef as RefObject<HTMLHeadingElement>} className="spatial-type__text spatial-type__instrument" data-text="instrumentTitle"><span data-explore-entry="right">{instrumentName}</span></h2>
      </div>
      {description && (
        <div className="instrument-explore__description" data-hidden={focused || zoomed} aria-hidden={focused || zoomed || undefined}>
          <div data-explore-entry="left">
            <p className="instrument-explore__description-eyebrow">About the instrument</p>
            <h3>The {instrumentName.toLowerCase()}</h3>
            <p className="instrument-explore__description-copy">{description}</p>
          </div>
        </div>
      )}
    </header>
  )
}
