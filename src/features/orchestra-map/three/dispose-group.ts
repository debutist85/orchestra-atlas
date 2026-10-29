import { BufferGeometry, Group, InstancedMesh, Line, Material, Mesh, Sprite } from 'three'

// A proxy and several rendering passes share attributes/geometry. Dispose each
// owned resource once, including plain debug Lines (not just LineSegments).
export function disposeGroup(group: Group) {
  const geometries = new Set<BufferGeometry>()
  const materials = new Set<Material>()
  group.traverse(object => {
    if (object instanceof InstancedMesh) object.dispose()
    if (object instanceof Mesh || object instanceof Line || object instanceof Sprite) {
      geometries.add(object.geometry)
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material)
    }
  })
  geometries.forEach(geometry => geometry.dispose())
  materials.forEach(material => material.dispose())
}
