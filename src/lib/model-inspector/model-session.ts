import type * as THREE from 'three'
import type { InspectionStage } from './inspection-stage'
import { instantiateModel } from './model-resource'
import { prepareModel } from './prepare-model'

export type ModelStatus = 'idle' | 'loading' | 'preparing' | 'ready' | 'error'
export type ModelState = { status: ModelStatus; error?: unknown }

// Separate from WebGL construction so cancellation and readiness can be
// verified without a GPU. An inspector owns scene instances, while decoded
// geometry/textures remain in the shared resource cache.
export function createModelSession(
  stage: InspectionStage,
  instantiate = instantiateModel,
  prepare = prepareModel,
) {
  let generation = 0
  let disposed = false
  let model: THREE.Object3D | undefined
  let state: ModelState = { status: 'idle' }
  const listeners = new Set<(state: ModelState) => void>()
  let finishPending: (() => void) | undefined
  const publish = (next: ModelState) => {
    state = next
    for (const listener of listeners) listener(next)
  }
  const detach = () => {
    generation++
    finishPending?.()
    finishPending = undefined
    model?.removeFromParent()
    model = undefined
  }
  return {
    getModel: () => model,
    getState: () => state,
    onState(listener: (state: ModelState) => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    async loadModel(url: string, configure?: (model: THREE.Object3D) => void): Promise<THREE.Object3D | undefined> {
      if (disposed) return undefined
      detach()
      const current = generation
      const stale = () => disposed || generation !== current
      stage.beginPreparation()
      publish({ status: 'loading' })
      try {
        const loaded = await instantiate(url)
        if (stale()) return undefined
        model = loaded
        stage.scene.add(loaded)
        configure?.(loaded)
        if (stale()) return undefined
        publish({ status: 'preparing' })
        if (!await prepare(stage.renderer, loaded, stage.scene, stage.camera, stale) || stale()) return undefined
        // Readiness means the first actual model frame, rather than merely
        // the completion of parsing or GPU preparation.
        return await new Promise<THREE.Object3D | undefined>((resolve, reject) => {
          const unsubscribeError = stage.onError(error => {
            unsubscribe()
            unsubscribeError()
            finishPending = undefined
            reject(error)
          })
          const unsubscribe = stage.onRender(() => {
            if (stale() || !stage.size().width || !stage.size().height) return
            finishPending = undefined
            unsubscribe()
            unsubscribeError()
            publish({ status: 'ready' })
            resolve(loaded)
          })
          finishPending = () => { unsubscribe(); unsubscribeError(); resolve(undefined) }
          stage.finishPreparation()
        })
      } catch (error) {
        if (stale()) return undefined
        detach()
        stage.finishPreparation()
        publish({ status: 'error', error })
        throw error
      }
    },
    cancelModel() {
      if (disposed) return
      detach()
      stage.finishPreparation()
      publish({ status: 'idle' })
    },
    dispose() {
      if (disposed) return
      disposed = true
      detach()
      listeners.clear()
    },
  }
}
