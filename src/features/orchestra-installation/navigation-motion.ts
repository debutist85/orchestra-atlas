import { gsap } from 'gsap'
import type { NavigationState } from './navigation'

export const navigationTiming = {
  duration: 0.85, travelStart: 0.05, travelDuration: 0.76,
  swap: 0.15, labelsResolve: 0.62, controlsResolve: 0.69,
  parallaxFraction: 0.012,
} as const
const depth = { orchestra: 0, family: 1, instrument: 2 }
export function motionDirection(from: NavigationState, to: NavigationState) {
  return depth[to.level] < depth[from.level] ? 'withdraw' : 'approach'
}
type Point = { x: number; y: number; z: number }
export type MotionUI = {
  labels: HTMLElement; identity: HTMLElement; actions: HTMLElement
  resolve: (state: NavigationState) => void
  settled: () => void
}
export type MotionValue = { target: object; values: Record<string, number>; focused: boolean }
type Travel = {
  from: NavigationState; to: NavigationState
  camera: Point; center: Point; destination: Point; destinationCenter: Point
  values: MotionValue[]; reduced: boolean; update: () => void
}

// Discrete navigation only. Camera and navigation emphasis are presentation
// values; no timeline writes to either Zustand store or musical activity.
export class NavigationMotion {
  #context = gsap.context(() => {})
  #timeline: gsap.core.Timeline | undefined
  #ui: MotionUI | undefined
  #finish: (() => void) | undefined

  bind(ui: MotionUI) { this.#ui = ui }

  travel(request: Travel) {
    this.#timeline?.kill()
    // Drop the old context without reverting: interrupted travel starts exactly
    // where it was rendered. Only the live transition needs lifecycle tracking.
    this.#context.kill(false)
    this.#context = gsap.context(() => {})
    const ui = this.#ui
    let resolved = false
    const resolve = () => {
      if (!resolved) { resolved = true; ui?.resolve(request.to) }
    }
    const restore = () => {
      if (ui) {
        ui.labels.inert = false
        ui.actions.inert = false
        gsap.set([ui.labels, ui.identity, ui.actions], { opacity: 1 })
        gsap.set(ui.actions, { y: 0 })
      }
    }
    this.#finish = () => {
      this.#timeline?.kill()
      Object.assign(request.camera, request.destination)
      Object.assign(request.center, request.destinationCenter)
      request.values.forEach(value => Object.assign(value.target, value.values))
      resolve()
      restore()
      request.update()
      ui?.settled()
      this.#finish = undefined
    }
    if (request.reduced) { this.#finish(); return }

    const pose = { ...request.camera, progress: 0 }
    // Copy coordinates explicitly: Three.Vector3 properties are enumerable but
    // the controller also accepts plain objects for mechanical tests.
    const cameraStart = { x: request.camera.x, y: request.camera.y, z: request.camera.z }
    Object.assign(pose, cameraStart)
    const direction = motionDirection(request.from, request.to)
    const drift = Math.abs(request.camera.z - request.destination.z) * navigationTiming.parallaxFraction
      * (direction === 'approach' ? 1 : -1)
    this.#context.add(() => {
      if (ui) { ui.labels.inert = true; ui.actions.inert = true }
      const timeline = gsap.timeline({
        onUpdate: () => {
          request.camera.x = pose.x + Math.sin(pose.progress * Math.PI) * drift
          request.camera.y = pose.y
          request.camera.z = pose.z
          request.update()
        },
        onComplete: () => { resolve(); restore(); ui?.settled(); this.#finish = undefined },
      })
      this.#timeline = timeline
      if (ui) {
        timeline.to([ui.labels, ui.identity, ui.actions], { opacity: 0, duration: 0.12 }, 0)
        timeline.to(ui.actions, { y: 5, duration: 0.12 }, 0)
      }
      timeline.call(resolve, [], navigationTiming.swap)
      timeline.to(pose, { ...request.destination, progress: 1, duration: navigationTiming.travelDuration, ease: 'power2.inOut' }, navigationTiming.travelStart)
      timeline.to(request.center, { ...request.destinationCenter, duration: navigationTiming.travelDuration, ease: 'power2.inOut' }, navigationTiming.travelStart)
      for (const value of request.values) {
        timeline.to(value.target, { ...value.values, duration: 0.5, ease: 'power2.inOut' }, value.focused ? 0.2 : 0.1)
      }
      if (ui) {
        timeline.to([ui.labels, ui.identity], { opacity: 1, duration: 0.2 }, direction === 'withdraw' ? 0.65 : navigationTiming.labelsResolve)
        timeline.to(ui.actions, { opacity: 1, y: 0, duration: navigationTiming.duration - navigationTiming.controlsResolve }, navigationTiming.controlsResolve)
      }
    })
  }

  finish() { this.#finish?.() }
  dispose() {
    this.#finish = undefined
    this.#timeline?.kill()
    this.#context.revert()
    if (this.#ui) {
      this.#ui.labels.inert = false
      this.#ui.actions.inert = false
      for (const element of [this.#ui.labels, this.#ui.identity, this.#ui.actions]) element.style.removeProperty('opacity')
      this.#ui.actions.style.removeProperty('transform')
    }
  }
}
