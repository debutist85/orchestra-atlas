import type { Camera, Scene, WebGLRenderer, WebGLRenderTarget } from 'three'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'

// Both disc layers share one scene and camera. Select the layer per pass,
// restoring the camera so picking, source capture and later passes are unaffected.
export class LayerRenderPass extends RenderPass {
  layerMask: number

  constructor(scene: Scene, camera: Camera, layerMask: number) {
    super(scene, camera)
    this.layerMask = layerMask
    this.clear = false
    this.clearDepth = true
  }

  override render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget, delta: number, mask: boolean) {
    const previous = this.camera.layers.mask
    this.camera.layers.mask = this.layerMask
    try { super.render(renderer, write, read, delta, mask) }
    finally { this.camera.layers.mask = previous }
  }
}
