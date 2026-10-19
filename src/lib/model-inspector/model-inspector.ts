import * as THREE from 'three'
import { createInspectionStage, type InspectionStageOptions } from './inspection-stage'
import { createModelSession } from './model-session'

export type ModelInspectorOptions = InspectionStageOptions & {
  autoResize?: boolean
  autoFit?: boolean
}
export type ModelInspector = ReturnType<typeof createModelInspector>

// No markup, styles, animation policy, React, or application state. The
// consumer supplies a sized host and owns accessible controls and captions.
export function createModelInspector(host: HTMLElement, options: ModelInspectorOptions = {}) {
  const stage = createInspectionStage(host, options)
  const session = createModelSession(stage)
  let disposed = false
  const fitModel = () => {
    const model = session.getModel()
    if (!model || !stage.resize()) return
    const sphere = new THREE.Box3().setFromObject(model).getBoundingSphere(new THREE.Sphere())
    if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) return
    const { camera, controls } = stage
    const vertical = THREE.MathUtils.degToRad(camera.fov / 2)
    const horizontal = Math.atan(Math.tan(vertical) * camera.aspect)
    const distance = sphere.radius / Math.sin(Math.min(vertical, horizontal)) * 1.1
    const direction = camera.position.clone().sub(controls.target)
    if (direction.lengthSq() < 1e-12) direction.set(0, 0, 1)
    controls.target.copy(sphere.center)
    camera.position.copy(sphere.center).add(direction.normalize().multiplyScalar(distance))
    camera.near = sphere.radius / 100
    camera.far = distance + sphere.radius * 100
    camera.updateProjectionMatrix()
    controls.update()
    stage.requestRender()
  }
  const resize = () => {
    if (disposed || !stage.resize()) return false
    if (options.autoFit !== false) fitModel()
    stage.requestRender()
    return true
  }
  const observer = options.autoResize === false ? undefined : new ResizeObserver(resize)
  observer?.observe(host)
  return {
    ...stage,
    ...session,
    fitModel,
    resize,
    loadModel: (url: string, configure?: (model: THREE.Object3D) => void) => session.loadModel(url, model => {
      configure?.(model)
      if (options.autoFit !== false) fitModel()
      else stage.resize()
    }),
    dispose() {
      if (disposed) return
      disposed = true
      observer?.disconnect()
      session.dispose()
      stage.dispose()
    },
  }
}
