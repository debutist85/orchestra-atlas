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

export type ExploreSafeInset = { top: number; right: number; bottom: number; left: number }

export function minimapScrollOpacity(scrollTop: number) {
  return Math.max(0, Math.min(1, 1 - scrollTop / 64))
}

// A phone on its side is short and usually wider than the 719px portrait line
// (for example 844×390). Height follows isMobileLandscapeViewport; the width
// cap keeps a short desktop window on the regular sidebar. Matches the
// phone-landscape media query in global.css.
export const phoneLandscapeQuery = '(orientation: landscape) and (max-height: 767px) and (max-width: 1023px)'

export function isPhoneLandscape(viewport: { width: number; height: number }) {
  return viewport.width > viewport.height && viewport.height < 768 && viewport.width < 1024
}

// Phone landscape splits the screen into thirds: overview, then the panels.
export function exploreSidebarWidth(viewport: { width: number; height: number }) {
  if (isPhoneLandscape(viewport)) return viewport.width / 3
  return Math.min(384, Math.max(280, viewport.width * 0.214))
}

export function exploreLayout(
  viewport: { width: number; height: number },
  stage: { width: number; height: number; top: number },
  content?: ProjectedNodeBounds,
  safe?: ExploreSafeInset,
  mapSlot?: { left: number; top: number; width: number; height: number },
) : ExploreLayout {
  const portrait = viewport.height >= viewport.width
  if (portrait) {
    const slot = mapSlot ?? { left: 20, top: safe?.top ?? 60, width: (viewport.width - 40) / 2, height: 144 }
    const bounds = content ?? { left: 0, top: 0, width: stage.width, height: stage.height }
    // Keep only a small halo allowance; the formation should fill its slot.
    const margin = 8
    const left = Math.max(0, bounds.left - margin)
    const top = Math.max(0, bounds.top - margin)
    const right = Math.min(stage.width, bounds.left + bounds.width + margin)
    const bottom = Math.min(stage.height, bounds.top + bounds.height + margin)
    const width = Math.max(1, right - left)
    const height = Math.max(1, bottom - top)
    const scale = Math.min(Math.max(1, slot.width) / width, Math.max(1, slot.height) / height) * 0.92
    return {
      x: slot.left + (slot.width - width * scale) / 2 - left * scale,
      y: slot.top + (slot.height - height * scale) / 2 - top * scale,
      scale,
      contextualMapVisible: true,
      // Bounds determine framing only. Bloom extends beyond the node geometry,
      // so leave the transparent canvas uncropped.
      clipPath: 'inset(0px 0px 0px 0px)',
    }
  }
  if (content?.width && content.height) {
    const sidebarWidth = exploreSidebarWidth(viewport)
    const maxWidth = sidebarWidth - 32
    const maxHeight = 170
    // Pad in stage pixels so bloom around the outer lights survives the crop.
    const sourceMargin = 24
    const left = Math.max(0, content.left - sourceMargin)
    const top = Math.max(0, content.top - sourceMargin)
    const right = Math.min(stage.width, content.left + content.width + sourceMargin)
    const bottom = Math.min(stage.height, content.top + content.height + sourceMargin)
    const cropWidth = Math.max(1, right - left)
    const cropHeight = Math.max(1, bottom - top)
    let scale = Math.min(0.65, maxWidth / cropWidth, maxHeight / cropHeight)
    if (safe) {
      const availableWidth = Math.max(1, viewport.width - safe.left - safe.right)
      const availableHeight = Math.max(1, viewport.height - safe.top - safe.bottom)
      scale = Math.min(scale, availableWidth / cropWidth, availableHeight / cropHeight)
    }
    return {
      x: -left * scale + (sidebarWidth - cropWidth * scale) / 2,
      y: -top * scale + (safe?.top ?? 0),
      scale,
      contextualMapVisible: true,
      // Bounds determine framing only. Bloom extends beyond the node geometry,
      // so leave the transparent canvas uncropped.
      clipPath: 'inset(0px 0px 0px 0px)',
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
  #removeScrollListener: (() => void) | undefined
  #scrollContainer: HTMLElement | undefined

  #updateScrollOpacity = () => {
    const elements = this.#elements
    if (!elements) return
    const opacity = window.matchMedia('(orientation: landscape)').matches
      ? minimapScrollOpacity(this.#scrollContainer?.scrollTop ?? 0) : 1
    elements.mapStage.style.setProperty('--minimap-scroll-opacity', String(opacity))
  }

  bind(elements: ExperienceMotionElements) {
    this.#removeScrollListener?.()
    this.#elements = elements
    // The aside is animated as a whole; its inner overview owns scrolling.
    const scroller = elements.exploreUI.querySelector<HTMLElement>('.instrument-explore__overview-content') ?? elements.exploreUI
    this.#scrollContainer = scroller
    const landscape = window.matchMedia('(orientation: landscape)')
    scroller.addEventListener('scroll', this.#updateScrollOpacity, { passive: true })
    landscape.addEventListener('change', this.#updateScrollOpacity)
    this.#removeScrollListener = () => {
      scroller.removeEventListener('scroll', this.#updateScrollOpacity)
      landscape.removeEventListener('change', this.#updateScrollOpacity)
    }
    this.#updateScrollOpacity()
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
    const slot = elements.exploreStage.querySelector<HTMLElement>('.instrument-explore__map-slot')
    const slotBounds = slot?.getBoundingClientRect()
    const target = exploreLayout(
      { width: rootBounds.width, height: rootBounds.height },
      unscaledStage,
      options.mapContentBounds,
      { top: chromeTop + edge - minimapLift, right: edge, bottom: chromeBottom + edge, left: edge },
      slotBounds?.width ? {
        left: slotBounds.left - rootBounds.left,
        top: slotBounds.top - rootBounds.top,
        width: slotBounds.width,
        height: slotBounds.height,
      } : undefined,
    )
    const duration = options.instant ? 0 : options.reduced ? 0.16 : experienceTiming.duration
    if (mode === 'explore') {
      this.#updateScrollOpacity()
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
            '--minimap-scroll-opacity': 1,
            clipPath: 'inset(0px 0px 0px 0px)',
            duration: duration * 0.88, ease: 'power3.inOut',
          }, options.reduced ? 0 : duration * 0.08)
          .to(elements.mapUI, { autoAlpha: 1, duration: duration * 0.18, ease: 'power2.out' }, options.reduced ? 0 : duration * 0.72)
      }
    })
  }

  dispose() {
    this.#removeScrollListener?.()
    this.#removeScrollListener = undefined
    this.#scrollContainer = undefined
    this.#timeline?.kill()
    // The explorer unmounts after the return timeline has restored the full
    // map. Reverting here would restore the contextual transform captured at
    // the start of that timeline and make the map snap small again.
    this.#context.kill(false)
    if (this.#elements) {
      this.#elements.mapStage.style.removeProperty('--minimap-scroll-opacity')
      this.#elements.mapUI.inert = false
      gsap.set(this.#elements.mapUI, { clearProps: 'opacity,visibility' })
      this.#elements.exploreStage.inert = true
    }
    this.#timeline = undefined
    this.#elements = undefined
  }
}
