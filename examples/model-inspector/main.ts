import * as THREE from 'three'
import { createModelInspector } from '../../src/lib/model-inspector'

const viewer = createModelInspector(document.querySelector<HTMLElement>('#viewer')!, {
  controls: { enablePan: true },
  // Lighting is an application choice, not built into the engine.
  setup(_renderer, scene) {
    scene.add(new THREE.HemisphereLight(0xffffff, 0x555555, 3))
    const key = new THREE.DirectionalLight(0xffffff, 3)
    key.position.set(3, 4, 5)
    scene.add(key)
  },
})
const status = document.querySelector<HTMLElement>('#status')!
viewer.onState(state => { status.textContent = state.status === 'error' ? 'Unable to load model. Check its URL and CORS permissions, then retry.' : state.status })
const input = document.querySelector<HTMLInputElement>('#url')!
input.value = new URLSearchParams(location.search).get('model') ?? ''
document.querySelector('#load')!.addEventListener('submit', event => {
  event.preventDefault()
  void viewer.loadModel(input.value).catch(() => { /* onState displays the error. */ })
})
for (const [id, angle] of [['left', .15], ['right', -.15]] as const) {
  document.getElementById(id)!.onclick = () => {
    const offset = viewer.camera.position.clone().sub(viewer.controls.target)
    offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle)
    viewer.camera.position.copy(viewer.controls.target).add(offset)
    viewer.requestRender()
  }
}
for (const [id, factor] of [['closer', .85], ['farther', 1.15]] as const) {
  document.getElementById(id)!.onclick = () => {
    const offset = viewer.camera.position.clone().sub(viewer.controls.target).multiplyScalar(factor)
    viewer.camera.position.copy(viewer.controls.target).add(offset)
    viewer.requestRender()
  }
}
document.getElementById('fit')!.onclick = viewer.fitModel
document.getElementById('cancel')!.onclick = viewer.cancelModel
window.addEventListener('pagehide', viewer.dispose, { once: true })
