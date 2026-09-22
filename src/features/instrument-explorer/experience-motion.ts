import { gsap } from 'gsap'

import type { ExperienceMode } from '../../store/experience-store'
import type { ProjectedNodeBounds } from '../orchestra-map/three/camera-focus'

export const experienceTiming = {
  duration: 0.9,
  mapTravelStart: 0.05,
  mapTravelDuration: 0.88,
  modelRevealDuration: 0.3,
  uiResolve: 0.72,
} as const

export type ExploreLayout = {
  x: number
  y: number
  scale: number
  contextualMapVisible: boolean
  clipPath: string
}

export function exploreLayout(
  viewport: { width: number; height: number },
  stage: { width: number; height: number; top: number },
  content?: ProjectedNodeBounds,
) : ExploreLayout {
  const narrow = viewport.width < 720
  if (narrow) {
    const scale = 0.18
    return {
      x: (viewport.width - stage.width * scale) / 2,
      y: -stage.height * scale - 20,
      scale,
      contextualMapVisible: false,
      clipPath: 'inset(0px 0px 0px 0px)',
    }
  }
  if (content?.width && content.height) {
    const margin = 14
    const maxWidth = Math.min(360, viewport.width * 0.36)
    const maxHeight = Math.min(240, viewport.height * 0.38)
    const fittedScale = Math.min(
      0.65,
      Math.max(0.22, (maxWidth - margin * 2) / content.width),
      Math.max(0.22, (maxHeight - margin * 2) / content.height),
    )
    const scale = fittedScale * 0.6
    const sourceMargin = margin / scale
    const left = Math.max(0, content.left - sourceMargin)
    const top = Math.max(0, content.top - sourceMargin)
    const right = Math.min(stage.width, content.left + content.width + sourceMargin)
    const bottom = Math.min(stage.height, content.top + content.height + sourceMargin)
    return {
      x: -left * scale,
      y: -top * scale,
      scale,
      contextualMapVisible: true,
      clipPath: `inset(${top}px ${Math.max(0, stage.width - right)}px ${Math.max(0, stage.height - bottom)}px ${left}px)`,
    }
  }
  const scale = Math.max(0.22, Math.min(0.28, 340 / Math.max(stage.width, 1)))
  return { x: 0, y: 0, scale, contextualMapVisible: true, clipPath: 'inset(0px 0px 0px 0px)' }
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
    const target = exploreLayout(
      { width: rootBounds.width, height: rootBounds.height },
      unscaledStage,
      options.mapContentBounds,
    )
    const duration = options.reduced ? 0.16 : experienceTiming.duration
    if (mode === 'explore') {
      elements.mapUI.inert = true
      elements.exploreStage.inert = false
    } else {
      elements.exploreStage.inert = true
    }
    const settle = () => {
      if (mode === 'map') {
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
            opacity: target.contextualMapVisible ? 0.72 : 0,
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
    this.#context.revert()
    if (this.#elements) {
      this.#elements.mapUI.inert = false
      gsap.set(this.#elements.mapUI, { clearProps: 'opacity,visibility' })
      this.#elements.exploreStage.inert = true
    }
  }
}
