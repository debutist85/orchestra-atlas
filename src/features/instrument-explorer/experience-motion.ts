import { gsap } from 'gsap'

import type { ExperienceMode } from '../../store/experience-store'
import { useExploreLayoutStore } from '../../store/explore-layout-store'
import type { ProjectedNodeBounds } from '../orchestra-map/three/camera-focus'

export const experienceTiming = {
  duration: 0.9,
  mapTravelStart: 0.05,
  mapTravelDuration: 0.88,
  modelRevealDuration: 0.3,
  uiResolve: 0.72,
} as const

// Share of the fitted miniature size actually used, by screen.
export const minimapSize = {
  default: 0.6,
  phonePortrait: 0.85,
  phoneLandscape: 0.5,
} as const

export type ExploreLayout = {
  x: number
  y: number
  scale: number
  clipPath: string
  // The visible miniature, in the stage's own untransformed px (the stage
  // scales from its top-left corner).
  minimap: { left: number; top: number; width: number; height: number }
}

export type ExploreSafeInset = { top: number; right: number; bottom: number; left: number }

export function exploreLayout(
  viewport: { width: number; height: number },
  stage: { width: number; height: number; top: number },
  content?: ProjectedNodeBounds,
  safe?: ExploreSafeInset,
) : ExploreLayout {
  // The miniature always stays on screen, in the top-left corner. A phone
  // held upright draws it larger, since it is otherwise too small to read as
  // the orchestra; a phone on its side draws it smaller, since height is
  // what that screen lacks.
  const phone = Math.min(viewport.width, viewport.height) < 500
  const sizeFactor = !phone ? minimapSize.default
    : viewport.width < viewport.height ? minimapSize.phonePortrait : minimapSize.phoneLandscape
  if (content?.width && content.height) {
    const margin = 14
    const maxWidth = Math.min(360, viewport.width * 0.36)
    const maxHeight = Math.min(240, viewport.height * 0.38)
    const fittedScale = Math.min(
      0.65,
      Math.max(0.22, (maxWidth - margin * 2) / content.width),
      Math.max(0.22, (maxHeight - margin * 2) / content.height),
    )
    let scale = fittedScale * sizeFactor
    // Pad in stage pixels so bloom around the outer lights survives the crop.
    const sourceMargin = margin / scale + 36
    const left = Math.max(0, content.left - sourceMargin)
    const top = Math.max(0, content.top - sourceMargin)
    const right = Math.min(stage.width, content.left + content.width + sourceMargin)
    const bottom = Math.min(stage.height, content.top + content.height + sourceMargin)
    const cropWidth = Math.max(1, right - left)
    const cropHeight = Math.max(1, bottom - top)
    if (safe) {
      const availableWidth = Math.max(1, viewport.width - safe.left - safe.right)
      const availableHeight = Math.max(1, viewport.height - safe.top - safe.bottom)
      scale = Math.min(scale, availableWidth / cropWidth, availableHeight / cropHeight)
    }
    return {
      x: -left * scale + (safe?.left ?? 0),
      y: -top * scale + (safe?.top ?? 0),
      scale,
      clipPath: `inset(${top}px ${Math.max(0, stage.width - right)}px ${Math.max(0, stage.height - bottom)}px ${left}px)`,
      minimap: { left: safe?.left ?? 0, top: safe?.top ?? 0, width: cropWidth * scale, height: cropHeight * scale },
    }
  }
  const scale = Math.max(0.22, Math.min(0.28, 340 / Math.max(stage.width, 1)))
  return {
    x: 0, y: 0, scale, clipPath: 'inset(0px 0px 0px 0px)',
    minimap: { left: 0, top: 0, width: stage.width * scale, height: stage.height * scale },
  }
}

export type ExperienceMotionElements = {
  root: HTMLElement
  mapStage: HTMLElement
  mapUI: HTMLElement
  exploreStage: HTMLElement
  model: HTMLElement
  exploreUI: HTMLElement
}

export class ExperienceMotion {
  #context = gsap.context(() => {})
  #timeline: gsap.core.Timeline | undefined
  #elements: ExperienceMotionElements | undefined

  bind(elements: ExperienceMotionElements) {
    this.#elements = elements
  }

  transition(mode: ExperienceMode, options: {
    reduced: boolean
    // A deep link or reload should land already in the target mode, not
    // visibly travel there from a map/model the visitor never asked to see —
    // distinct from `reduced`, which still plays a (much shorter) transition.
    instant?: boolean
    onSettled: () => void
    onMapSettled?: () => void
    mapContentBounds?: ProjectedNodeBounds
  }) {
    const elements = this.#elements
    if (!elements) return
    this.#timeline?.kill()
    this.#context.kill(false)
    this.#context = gsap.context(() => {}, elements.root)

    const rootBounds = elements.root.getBoundingClientRect()
    const stageBounds = elements.mapStage.getBoundingClientRect()
    // Remove the current transform from the measured dimensions. This keeps a
    // rapid reverse transition responsive to the real stage, not its mini pose.
    const currentScale = Number(gsap.getProperty(elements.mapStage, 'scale')) || 1
    const unscaledStage = {
      width: stageBounds.width / currentScale,
      height: stageBounds.height / currentScale,
      top: stageBounds.top - Number(gsap.getProperty(elements.mapStage, 'y') || 0),
    }
    const rootStyle = getComputedStyle(elements.root)
    const chromeTop = Number.parseFloat(rootStyle.getPropertyValue('--map-chrome-height')) || 0
    const chromeBottom = Number.parseFloat(rootStyle.getPropertyValue('--map-footer-height')) || 0
    const edge = 16
    // Sit the miniature higher than the header clearance, closer to the top of the stage.
    const minimapLift = 28
    const target = exploreLayout(
      { width: rootBounds.width, height: rootBounds.height },
      unscaledStage,
      options.mapContentBounds,
      { top: chromeTop + edge - minimapLift, right: edge, bottom: chromeBottom + edge, left: edge },
    )
    // Published as the settled target, in viewport px, so the instrument
    // stage can compose around the miniature from the start of the handoff.
    // On the way back to the map it is kept until the map has settled:
    // clearing it earlier recomposes the instrument stage, re-framing the
    // model while it is still fading out.
    const stageLeft = stageBounds.left - Number(gsap.getProperty(elements.mapStage, 'x') || 0)
    if (mode === 'explore') {
      useExploreLayoutStore.getState().setContextualMap({
        left: stageLeft + target.minimap.left,
        top: unscaledStage.top + target.minimap.top,
        width: target.minimap.width,
        height: target.minimap.height,
      })
    }
    const duration = options.instant ? 0 : options.reduced ? 0.16 : experienceTiming.duration
    if (mode === 'explore') {
      elements.mapUI.inert = true
      elements.exploreStage.inert = false
    } else {
      elements.exploreStage.inert = true
    }
    const settle = () => {
      if (mode === 'map') {
        useExploreLayoutStore.getState().setContextualMap(null)
        gsap.set(elements.exploreStage, { autoAlpha: 0, pointerEvents: 'none' })
        gsap.set(elements.mapUI, { autoAlpha: 1 })
        elements.mapUI.inert = false
      }
      options.onSettled()
    }

    this.#context.add(() => {
      const timeline = gsap.timeline({ onComplete: settle })
      this.#timeline = timeline
      if (mode === 'explore') {
        const mapStart = options.reduced ? 0 : duration * experienceTiming.mapTravelStart
        const mapEnd = mapStart + duration * experienceTiming.mapTravelDuration
        gsap.set(elements.exploreStage, { autoAlpha: 1, pointerEvents: 'auto' })
        timeline
          .to(elements.mapUI, { autoAlpha: 0, duration: duration * 0.2, ease: 'power2.in' }, 0)
          .to(elements.mapStage, {
            x: target.x,
            y: target.y,
            scale: target.scale,
            opacity: 0.72,
            clipPath: target.clipPath,
            duration: duration * experienceTiming.mapTravelDuration,
            ease: 'power3.inOut',
          }, mapStart)
          .call(() => options.onMapSettled?.(), [], mapEnd)
          .to(elements.model, {
            opacity: 1, scale: 1, y: 0,
            duration: duration * experienceTiming.modelRevealDuration,
            ease: 'power2.out',
          }, mapEnd)
          .to(elements.exploreUI, { opacity: 1, y: 0, duration: duration * 0.2, ease: 'power2.out' }, options.reduced ? 0 : duration * experienceTiming.uiResolve)
      } else {
        timeline
          .to(elements.exploreUI, { opacity: 0, y: 6, duration: duration * 0.18, ease: 'power2.in' }, 0)
          .to(elements.model, { opacity: 0, scale: 0.88, y: 24, duration: duration * 0.52, ease: 'power2.inOut' }, 0)
          .to(elements.mapStage, {
            x: 0, y: 0, scale: 1, opacity: 1,
            clipPath: 'inset(0px 0px 0px 0px)',
            duration: duration * 0.88, ease: 'power3.inOut',
          }, options.reduced ? 0 : duration * 0.08)
          .to(elements.mapUI, { autoAlpha: 1, duration: duration * 0.18, ease: 'power2.out' }, options.reduced ? 0 : duration * 0.72)
      }
    })
  }

  dispose() {
    this.#timeline?.kill()
    // The explorer unmounts after the return timeline has restored the full
    // map. Reverting here would restore the contextual transform captured at
    // the start of that timeline and make the map snap small again.
    this.#context.kill(false)
    useExploreLayoutStore.getState().setContextualMap(null)
    if (this.#elements) {
      this.#elements.mapUI.inert = false
      gsap.set(this.#elements.mapUI, { clearProps: 'opacity,visibility' })
      this.#elements.exploreStage.inert = true
    }
    this.#timeline = undefined
    this.#elements = undefined
  }
}
