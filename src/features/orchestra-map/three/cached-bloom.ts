import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'
import type { WebGLRenderer, WebGLRenderTarget } from 'three'

// Blur depends on the node emission/camera, not the independently animated
// ghosts. Reapply the cached additive texture over each fresh scene frame.
export class CachedBloomPass extends UnrealBloomPass {
  dirty = true
  #quad = new FullScreenQuad(this.blendMaterial)

  override setSize(width: number, height: number) {
    super.setSize(width, height)
    this.dirty = true
  }

  override render(renderer: WebGLRenderer, write: WebGLRenderTarget, read: WebGLRenderTarget, delta: number, mask: boolean) {
    if (this.dirty || mask || this.renderToScreen) {
      super.render(renderer, write, read, delta, mask)
      this.dirty = false
      return
    }
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setRenderTarget(read)
    this.#quad.render(renderer)
    renderer.autoClear = autoClear
  }

  override dispose() {
    this.#quad.dispose()
    super.dispose()
  }
}

// Retain the small numeric key between frames rather than stringify matrices
// or allocate a new snapshot on every ghost animation tick.
export class RenderInputCache {
  #values: number[] = []
  #cursor = 0
  #changed = true
  begin() { this.#cursor = 0; this.#changed = false }
  value(value: number) {
    if (this.#values[this.#cursor] !== value) this.#changed = true
    this.#values[this.#cursor++] = value
  }
  matrix(values: ArrayLike<number>) { for (let i = 0; i < values.length; i++) this.value(values[i]) }
  end() {
    if (this.#cursor !== this.#values.length) this.#changed = true
    this.#values.length = this.#cursor
    return this.#changed
  }
}
