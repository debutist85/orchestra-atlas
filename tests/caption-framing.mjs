import assert from 'node:assert/strict'
import * as THREE from 'three'

export async function verifyCaptionFraming(server) {
  const { frameOutsideCaption } = await server.ssrLoadModule('/src/features/orchestra-map/three/caption-framing.ts')
  const { placeCaption } = await server.ssrLoadModule('/src/features/orchestra-map/utils/caption-placement.ts')
  const state = { level: 'instrument', familyId: 'strings', instrumentId: 'violin' }
  const nodes = [-3, 3].map((x, i) => ({ id: String(i), sectionId: 'strings', instrument: 'violin', position: [x, i - .5, 0], radius: .4 }))
  const base = { center: new THREE.Vector3(), position: new THREE.Vector3(0, 0, 8) }
  const edges = ['top', 'bottom', 'left', 'right']
  for (const [width, height] of [[320, 568], [844, 390], [1440, 900]]) {
    const safe = { x: 16, y: 66, width: width - 32, height: height - 152 }
    const size = { width: Math.min(120, safe.width / 2 - 16), height: Math.min(90, safe.height / 2 - 16) }
    for (const edge of edges) for (const align of ['start', 'center', 'end']) {
      const frame = { safe, size, gap: 16, side: 'outside', edge, align }
      const focus = frameOutsideCaption(nodes, state, base, { width, height }, 35, frame)
      assert.ok(focus.position.z >= base.position.z, 'caption fitting never zooms closer')
      const camera = new THREE.PerspectiveCamera(35, width / height, .1, 1000)
      camera.position.copy(focus.position); camera.lookAt(focus.center); camera.updateMatrixWorld()
      const project = (x, y) => {
        const point = new THREE.Vector3(x, y, 0).project(camera)
        return { x: (point.x + 1) * width / 2, y: (1 - point.y) * height / 2 }
      }
      const projected = nodes.flatMap(node => [project(node.position[0] - node.radius, node.position[1] - node.radius), project(node.position[0] + node.radius, node.position[1] + node.radius)])
      const bounds = { x: Math.min(...projected.map(p => p.x)), y: Math.min(...projected.map(p => p.y)) }
      bounds.width = Math.max(...projected.map(p => p.x)) - bounds.x
      bounds.height = Math.max(...projected.map(p => p.y)) - bounds.y
      // Framing itself must make room: caption placement has no safety clamp.
      const caption = placeCaption(bounds, size, edge, align, 16)
      for (const rect of [bounds, { ...caption, ...size }]) {
        assert.ok(rect.x >= safe.x - 1e-6 && rect.y >= safe.y - 1e-6, `${edge}/${align}: top/left fit`)
        assert.ok(rect.x + rect.width <= safe.x + safe.width + 1e-6 && rect.y + rect.height <= safe.y + safe.height + 1e-6, `${edge}/${align}: bottom/right fit`)
      }
      assert.equal(frameOutsideCaption(nodes, state, base, { width, height }, 35, { ...frame, side: 'inside' }), base)
      assert.equal(frameOutsideCaption(nodes, { level: 'orchestra' }, base, { width, height }, 35, frame), base)
      assert.equal(frameOutsideCaption(nodes, state, base, { width, height }, 35, { ...frame, edge: 'center' }), base)
    }
  }
  console.log('Passed outside-caption camera framing at desktop/mobile sizes, edge clearance, and unchanged inside/root framing.')
}
