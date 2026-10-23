import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type RefObject } from 'react'
import { gsap } from 'gsap'

import { useAnatomyStore } from '../../../store/anatomy-store'
import { useExploreLayoutStore } from '../../../store/explore-layout-store'
import type { OrchestraInstrument } from '../../orchestra-map/config'
import { navigationTiming, identityTrackingExpansionEm } from '../../orchestra-map/three/navigation-motion'
import { placeDescription, reserveDescriptionArea, type DescriptionPlacement } from './instrument-description'
import { instrumentExplorerConfig, explorerLayout } from '../config'
import type { InstrumentViewSignal, ModelScreenBounds } from '../instrument-view'
import { captureTravelAnchor, projectTravelAnchor, type TravelAnchor } from './label-travel'
import { ActionIcon } from '../viewer/ActionIcon'
import { ModelCredits } from '../viewer/ModelCredits'
import type { ModelAttribution } from '../content/explorable-instruments'
import {
  alignFactor,
  dampTowards,
  layoutPlanes,
  orbitDeflection,
  parallaxScale,
  composeStage,
  withModelGap,
  labelSideFor,
  labelAreaForBounds,
  planePosition,
  planeAlignment,
  planeReach,
  spatialTextOffset,
  spatialTypographyConfig as config,
  type LabelSide,
  type SpatialPlaneId,
  type SpatialTextId,
} from './spatial-typography'

// Clearance (px) between the contextual minimap and the description above
// it — independent of the per-instrument gap to the model.
const DESCRIPTION_MINIMAP_GAP = 40

type Props = {
  instrumentId: OrchestraInstrument
  familyName: string
  instrumentName: string
  description?: string
  // A Watch performance trigger (PerformanceStage), under the instrument
  // title in landscape and leading the description in portrait, and the 3D
  // model's credits, in place of the description's eyebrow; each only when
  // the instrument has one.
  hasPerformance?: boolean
  modelAttribution?: ModelAttribution
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
// otherwise on the right, with the description on the left) and the model gets a
// frame matched to its aspect in the rest, both kept clear of the contextual
// minimap. The frame is published for InstrumentModel to frame into. The planes
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

    const measurements = new Map<HTMLElement, Map<number, { width: number; height: number }>>()
    let layoutFrame = 0
    const scheduleLayout = () => {
      if (!layoutFrame) layoutFrame = requestAnimationFrame(() => { layoutFrame = 0; layout() })
    }
    const invalidateMeasurements = () => { measurements.clear(); scheduleLayout() }
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
      const portrait = stage.width < stage.height
      const gaps = explorerLayout(instrumentId).gaps[portrait ? 'portrait' : 'landscape']
      const inputs = planes.map(({ id, element }) => {
        const scale = config.planes[id].scale
        return {
          id,
          position: withModelGap(planePosition(id, side, instrumentId), side, gaps.title),
          reach: planeReach(id, stage.width),
          measure: (maxWidth: number) => {
            const width = maxWidth / scale
            const cssWidth = `${width}px`
            if (element.style.maxWidth !== cssWidth) element.style.maxWidth = cssWidth
            let sizes = measurements.get(element)
            if (!sizes) { sizes = new Map(); measurements.set(element, sizes) }
            let size = sizes.get(width)
            if (!size) {
              size = { width: element.offsetWidth * scale, height: element.offsetHeight * scale }
              // Continuous resizing must not grow this cache indefinitely.
              if (sizes.size >= 8) sizes.clear()
              sizes.set(width, size)
            }
            return size
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
      // Left of the model in landscape, mirroring the title on its right;
      // at the bottom in portrait.
      const descriptionSide = portrait ? 'bottom' : 'left'
      const descriptionSafeArea = area
      let descriptionMinimap = minimap
      if (copy) {
        copy.dataset.orientation = portrait ? 'portrait' : 'landscape'
        // Include the heading and actual text wrapping in
        // the reservation, including changes from fonts and text zoom.
        const copyArea = portrait ? { ...area, left: area.left + 8, right: area.right - 8 } : area
        const compact = Math.min(stage.width, stage.height) < 600
        const split = compact && !portrait
        descriptionMinimap = split ? undefined : minimap
        const availableWidth = copyArea.right - copyArea.left
        const width = portrait
          ? Math.min(availableWidth, compact ? 320 : availableWidth)
          : Math.min(compact ? 220 : 280, availableWidth * (compact ? 0.32 : 0.4))
        copy.style.width = `${width}px`
        // A phone on its side: the description fills the stage's full height
        // over the minimap, its text at the bottom (data-layout="split";
        // instrument-explore.css), so the minimap does not limit its
        // placement there. An explicit height, not a min-height, so the
        // bottom alignment resolves against a definite height everywhere.
        copy.dataset.layout = split ? 'split' : 'stacked'
        // It runs down to the footer's top edge (not the edge margin above
        // it), so the bottom-aligned text sits right above the footer.
        copy.style.height = split ? `${Math.max(0, safe.bottom - copyArea.top)}px` : ''
        const reserved = reserveDescriptionArea(copyArea, descriptionSide, {
          width: copy.offsetWidth,
          height: copy.offsetHeight,
        }, descriptionMinimap, gaps.description, DESCRIPTION_MINIMAP_GAP)
        copy.style.left = '0px'
        copy.style.top = '0px'
        area = reserved.available
        modelArea = descriptionSide !== 'left'
          ? { ...modelArea, bottom: Math.min(modelArea.bottom, area.bottom) }
          : { ...modelArea, left: Math.max(modelArea.left, area.left) }
      }
      // In landscape the model centers on the stage, not the model and
      // labels together, as far as the description and title space allow.
      const centerX = !portrait ? (safe.left + safe.right) / 2 : undefined
      const composition = composeStage(inputs, area, modelArea, side, lastAspect ?? config.placeholderModelAspect, minimap, undefined, centerX)
      view.setModelFrame(composition.model)
      // Until the model reports bounds for this frame, its frame stands in;
      // the bounds update re-runs this layout.
      const bounds = view.getModelBounds() ?? composition.model

      if (copy) {
        descriptionLayoutRef.current = placeDescription(descriptionSafeArea, descriptionSide,
          { width: copy.offsetWidth, height: copy.offsetHeight }, bounds, descriptionMinimap, gaps.description, DESCRIPTION_MINIMAP_GAP)
        root.dispatchEvent(new Event('description:layout'))
      }
      // Portrait titles keep their envelope gap even when the envelope grows
      // above the composed frame. Only horizontal containment applies: moving
      // them down to fit would detach them from that reference.
      const labelArea = labelAreaForBounds(composition.labels, bounds, side)
      const result = layoutPlanes(inputs, bounds, labelArea, config.minPlaneWidth, { x: true, y: side !== 'top' })

      for (const { id, element } of planes) {
        const point = result.points[id]
        if (!point) continue
        element.style.left = `${point.x}px`
        element.style.top = `${point.y}px`
      }
    }
    layout()
    const unsubscribe = view.subscribe(() => {
      if (view.getModelBounds() !== lastBounds || view.getModelAspect() !== lastAspect) scheduleLayout()
    })
    const unsubscribeMap = useExploreLayoutStore.subscribe((state, previous) => {
      if (state.contextualMap !== previous.contextualMap) scheduleLayout()
    })
    root.addEventListener(settledEvent, invalidateMeasurements)
    document.fonts.addEventListener('loadingdone', invalidateMeasurements)
    const observer = new ResizeObserver(invalidateMeasurements)
    observer.observe(root)
    for (const { element } of planes) observer.observe(element)
    const copy = root.querySelector('.instrument-explore__description')
    if (copy) observer.observe(copy)
    return () => {
      unsubscribe()
      unsubscribeMap()
      root.removeEventListener(settledEvent, invalidateMeasurements)
      document.fonts.removeEventListener('loadingdone', invalidateMeasurements)
      cancelAnimationFrame(layoutFrame)
      observer.disconnect()
    }
  }, [view, rootRef, instrumentId, side, description, descriptionLayoutRef])
}

const horizontal = { start: 'left', center: 'center', end: 'right' } as const
const vertical = { start: 'top', center: 'center', end: 'bottom' } as const

function planeStyle(id: SpatialPlaneId, side: LabelSide, instrumentId: OrchestraInstrument): CSSProperties {
  const plane = config.planes[id]
  const position = planeAlignment(planePosition(id, side, instrumentId))
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

export function SpatialTypography({ instrumentId, familyName, instrumentName, description, hasPerformance, modelAttribution, view }: Props) {
  const rootRef = useRef<HTMLElement>(null)
  const descriptionLayoutRef = useRef<DescriptionPlacement | null>(null)
  const familyRef = useRef<HTMLElement>(null)
  const instrumentRef = useRef<HTMLElement>(null)
  const [refs] = useState<TextRefs>(() => ({ familyTitle: familyRef, instrumentTitle: instrumentRef }))
  // Re-renders only when the side flips (the stage turns between portrait
  // and landscape), not on every signal update.
  const [stageOrientation, setStageOrientation] = useState<'portrait' | 'landscape'>('landscape')
  const side = labelSideFor(stageOrientation)
  // While a part is focused the titles have travelled out with the zoom
  // (useSpatialMotion); the model overlay holds anatomy content.
  const focused = useAnatomyStore(state => state.selectedPartId !== null)
  const performanceOpen = useAnatomyStore(state => state.performanceOpen)
  const openPerformance = useAnatomyStore(state => state.openPerformance)

  const zoomed = useSyncExternalStore(view.subscribe, view.getZoomed)

  // Watch performance is an action node like the anatomy actions (icon in a
  // glowing circle) with its label beside it; the credits are a small text
  // link.
  const watchNode = hasPerformance && (
    <button type="button"
      className="instrument-performance-trigger pointer-events-auto inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-[0.75rem] border-0 bg-transparent p-0 text-[clamp(0.62rem,0.52rem+0.2vw,0.75rem)] leading-none tracking-[0.2em] text-dust uppercase whitespace-nowrap hover:text-ivory focus-visible:text-ivory focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-[3px]"
      aria-label="Watch performance"
      aria-controls="instrument-performance"
      aria-expanded={performanceOpen}
      onClick={openPerformance}>
      <span className="instrument-performance-trigger__surface grid size-[44px] shrink-0 place-items-center rounded-full text-ivory"><ActionIcon media="video" /></span>
      {/* Wraps at its space (instrument-explore.css). */}
      <span className="instrument-performance-trigger__label" aria-hidden="true">Watch performance</span>
    </button>
  )

  useSpatialMotion(view, rootRef, refs, descriptionLayoutRef)
  useInstrumentStageLayout(view, rootRef, instrumentId, side, descriptionLayoutRef, description)

  // Same portrait/landscape rule as the model framing (InstrumentModel.tsx).
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
    <header ref={rootRef} className="spatial-type pointer-events-none absolute inset-0 pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]" aria-hidden={focused || undefined}>
      <div className="spatial-type__plane absolute top-0 left-0 w-max" data-plane="family" style={planeStyle('family', side, instrumentId)}>
        <p ref={familyRef as RefObject<HTMLParagraphElement>} className="spatial-type__text pointer-events-auto m-0 [overflow-wrap:break-word] will-change-transform spatial-type__family font-identity text-[clamp(1.15rem,2.1vw,2rem)] font-normal tracking-[0.01em] text-mist" data-text="familyTitle"><span className="block" data-explore-entry="left">{familyName}</span></p>
      </div>
      <div className="spatial-type__plane absolute top-0 left-0 w-max" data-plane="instrument" style={planeStyle('instrument', side, instrumentId)}>
        <h2 ref={instrumentRef as RefObject<HTMLHeadingElement>} className="spatial-type__text pointer-events-auto m-0 [overflow-wrap:break-word] will-change-transform spatial-type__instrument font-identity text-[clamp(2.6rem,6.4vw,6rem)] leading-[0.95] font-normal text-bone" data-text="instrumentTitle"><span className="block" data-explore-entry="right">{instrumentName}</span></h2>
        {/* Landscape: under the title, in its plane: measured with it, so the
            layout keeps it clear of the model, but outside the title text, so
            it takes no parallax or focus travel; it fades out while a part is
            focused. (Portrait: in the description.) */}
        {/* Both placements stay mounted and only one is shown: the entry
            animation fades in the data-explore-entry wrappers present when
            Explore opens, so one mounted later (on rotation) would stay at
            its initial opacity 0. */}
        {watchNode && (
          <div className="instrument-explore__watch instrument-explore__watch--title mt-[1.75rem]" hidden={stageOrientation !== 'landscape'} data-hidden={focused} inert={focused}>
            <div className="block" data-explore-entry="right">{watchNode}</div>
          </div>
        )}
      </div>
      {description && (
        <div className="instrument-explore__description group/description pointer-events-none absolute m-0 text-right text-[clamp(0.8rem,0.7rem+0.3vw,1rem)] leading-[1.65] font-normal text-fog opacity-100 data-[orientation=portrait]:text-left" data-hidden={focused || zoomed} aria-hidden={focused || zoomed || undefined}>
          <div className="instrument-explore__copy" data-explore-entry="left">
            <div className="instrument-explore__copy-text min-w-0">
              {/* Portrait: the Watch node leads the description, right-aligned
                  above the credits, label before the circle, and outside its
                  measured box (instrument-explore.css). Landscape: under the
                  title. */}
              {watchNode && (
                <div className="instrument-explore__watch instrument-explore__watch--leading pointer-events-auto mb-[0.75rem] flex justify-end" hidden={stageOrientation !== 'portrait'} inert={focused || zoomed}>{watchNode}</div>
              )}
              {/* The 3D model credits take the eyebrow's place, in its style
                  (both orientations); without credits the eyebrow remains. */}
              {modelAttribution ? (
                <div className="instrument-explore__credits pointer-events-auto m-0 mb-[0.85rem] text-[clamp(0.55rem,0.5rem+0.12vw,0.62rem)] leading-none tracking-[0.2em] text-dust uppercase [&>button_svg]:size-3" inert={focused || zoomed}>
                  <ModelCredits key={instrumentId} attribution={modelAttribution} />
                </div>
              ) : (
                <p className="instrument-explore__description-eyebrow m-0 mb-[0.85rem] text-[clamp(0.62rem,0.52rem+0.2vw,0.75rem)] tracking-[0.2em] text-dust uppercase group-data-[orientation=portrait]/description:hidden">About the instrument</p>
              )}
              <h3 className="m-0 mb-[0.65rem] font-identity text-[clamp(1.4rem,2.2vw,1.8rem)] leading-[1.15] font-normal text-ivory">The {instrumentName.toLowerCase()}</h3>
              <p className="instrument-explore__description-copy m-0 font-identity">{description}</p>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
