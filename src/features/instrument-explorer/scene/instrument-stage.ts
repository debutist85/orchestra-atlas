import * as THREE from 'three'
import { createModelInspector } from '../../../lib/model-inspector'
import { instrumentExplorerConfig } from '../config'
import { applyLighting, createStudioEnvironment, type LightingSettings } from './instrument-lighting'

export type { Orientation } from '../../../lib/model-inspector'
export type InstrumentStage = ReturnType<typeof createInstrumentStage>

// Atlas owns its visual treatment; the reusable inspector knows no palette,
// lighting preset, instrument content, navigation state, or animation library.
export function createInstrumentStage(host: HTMLElement, { lighting, enableZoom }: { lighting: LightingSettings; enableZoom: boolean }) {
  const stage = createModelInspector(host, {
    autoResize: false,
    autoFit: false,
    fov: instrumentExplorerConfig.camera.fov,
    controls: {
      dampingFactor: instrumentExplorerConfig.controls.dampingFactor,
      enableZoom,
      minPolarAngle: THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.minPolarAngleDeg),
      maxPolarAngle: THREE.MathUtils.degToRad(instrumentExplorerConfig.controls.maxPolarAngleDeg),
    },
    setup(renderer, scene) {
      const environment = createStudioEnvironment(renderer)
      scene.environment = environment.texture
      applyLighting(renderer, scene, lighting)
      scene.add(new THREE.HemisphereLight(0xf1eadb, 0x171b22, 2.2))
      const key = new THREE.DirectionalLight(0xffe3bd, 3.5)
      key.position.set(4, 6, 5)
      scene.add(key)
      const rim = new THREE.DirectionalLight(0x8ea9d8, 2.2)
      rim.position.set(-4, 1, -3)
      scene.add(rim)
      return () => environment.dispose()
    },
  })
  return {
    ...stage,
    setLighting(settings: LightingSettings) {
      applyLighting(stage.renderer, stage.scene, settings)
      stage.requestRender()
    },
  }
}
