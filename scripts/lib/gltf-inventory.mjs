import { readFile, realpath } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import sharp from 'sharp'

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
export const sumKnown = values => values.some(value => value === null) ? null : values.reduce((sum, value) => sum + value, 0)
const array = value => Array.isArray(value) ? value : []
const validIndex = (items, index) => Number.isInteger(index) && index >= 0 && index < items.length
const inside = (root, file) => { const rel = path.relative(root, file); return rel === '' || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel)) }

// Reports never contain data URI bodies, credentials, or signed URL queries.
export function publicUri(uri) {
  if (typeof uri !== 'string') return null
  if (uri.startsWith('data:')) return 'data:' + uri.slice(5).split(/[;,]/)[0] + ';embedded'
  try { const url = new URL(uri); return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin + url.pathname : '[unsupported URI scheme]' }
  catch { return uri.split(/[?#]/)[0] }
}

export function parseContainer(bytes, format) {
  if (format === 'glb') {
    if (bytes.length < 20 || bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2 || bytes.readUInt32LE(8) !== bytes.length) throw Error('Invalid GLB v2 header or declared length')
    let document, binary = null, offset = 12
    while (offset < bytes.length) {
      if (offset + 8 > bytes.length) throw Error('Truncated GLB chunk header')
      const size = bytes.readUInt32LE(offset), type = bytes.readUInt32LE(offset + 4)
      if (size % 4 || offset + 8 + size > bytes.length) throw Error('Invalid GLB chunk bounds/alignment')
      const chunk = bytes.subarray(offset + 8, offset + 8 + size)
      if (offset === 12 && type !== 0x4e4f534a) throw Error('GLB must begin with JSON')
      if (type === 0x4e4f534a) {
        if (document) throw Error('Duplicate GLB JSON chunk')
        try { document = JSON.parse(chunk.toString('utf8').trim()) } catch { throw Error('Invalid GLB JSON') }
      }
      if (type === 0x004e4942) { if (binary) throw Error('Multiple GLB BIN chunks'); binary = chunk }
      offset += 8 + size
    }
    if (!document) throw Error('Missing GLB JSON')
    return { document, binary }
  }
  if (format !== 'gltf') throw Error('Unsupported model format: ' + format)
  try { return { document: JSON.parse(bytes.toString('utf8')), binary: null } } catch { throw Error('Invalid glTF JSON') }
}

function countTriangles(mode, elements) {
  if (elements === null) return null
  if (mode === 4) return Math.floor(elements / 3)
  if (mode === 5 || mode === 6) return Math.max(0, elements - 2)
  return mode >= 0 && mode <= 3 ? 0 : null
}

function textureAssignments(value, prefix = '', result = []) {
  if (!value || typeof value !== 'object') return result
  for (const [key, entry] of Object.entries(value)) {
    const slot = prefix ? prefix + '.' + key : key
    if (key.endsWith('Texture') && entry && Number.isInteger(entry.index)) result.push({ slot, texture: entry.index, texCoord: entry.texCoord ?? 0, transform: entry.extensions?.KHR_texture_transform ?? null })
    else if (entry && typeof entry === 'object' && !Array.isArray(entry)) textureAssignments(entry, slot, result)
  }
  return result
}

async function imageMetadata(bytes, mime) {
  if (!bytes) return { format: mime?.split('/')[1] ?? null, width: null, height: null, gpuCompressed: null, embeddedMipLevels: null, rgbaBytesEstimate: null, storedMipPayloadBytes: null }
  if (bytes.subarray(0, 12).equals(Buffer.from('ab4b5458203230bb0d0a1a0a', 'hex'))) {
    if (bytes.length < 80) throw Error('Truncated KTX2 header')
    const width = bytes.readUInt32LE(20), height = bytes.readUInt32LE(24), levels = bytes.readUInt32LE(40)
    if (levels > 32 || 80 + levels * 24 > bytes.length) throw Error('Invalid KTX2 level index')
    let payload = 0
    for (let i = 0; i < levels; i++) {
      const offset = bytes.readBigUInt64LE(80 + i * 24), size = bytes.readBigUInt64LE(88 + i * 24)
      if (offset < BigInt(80 + levels * 24) || offset + size > BigInt(bytes.length)) throw Error('Invalid KTX2 mip payload bounds')
      payload += Number(size)
    }
    // vkFormat=0 is transcoded Basis data; its final GPU format is device-dependent.
    return { format: 'ktx2', width, height, vkFormat: bytes.readUInt32LE(12), supercompression: bytes.readUInt32LE(44), gpuCompressed: null, textureContainer: true, embeddedMipLevels: levels, rgbaBytesEstimate: width * height * 4, storedMipPayloadBytes: payload }
  }
  if (bytes.subarray(0, 4).toString() === 'DDS ') {
    if (bytes.length < 128) throw Error('Truncated DDS header')
    const width = bytes.readUInt32LE(16), height = bytes.readUInt32LE(12)
    return { format: 'dds', width, height, gpuCompressed: null, textureContainer: true, embeddedMipLevels: Math.max(1, bytes.readUInt32LE(28)), rgbaBytesEstimate: width * height * 4, storedMipPayloadBytes: bytes.length - 128 }
  }
  const metadata = await sharp(bytes, { limitInputPixels: false }).metadata()
  return { format: metadata.format ?? null, width: metadata.width ?? null, height: metadata.height ?? null, gpuCompressed: false, embeddedMipLevels: 1, rgbaBytesEstimate: metadata.width && metadata.height ? metadata.width * metadata.height * 4 : null, storedMipPayloadBytes: null }
}

export async function analyzeModel(file, { root = path.dirname(file) } = {}) {
  const scopeRoot = await realpath(root)
  if (!inside(scopeRoot, await realpath(file))) throw Error('Model resolves outside the requested asset scope')
  const bytes = await readFile(file), format = path.extname(file).slice(1).toLowerCase()
  const { document: doc, binary } = parseContainer(bytes, format)
  if (!doc.asset || doc.asset.version !== '2.0') throw Error('Only glTF 2.0 assets are supported')
  const warnings = [], dependencies = new Map(), resourceCache = new Map()
  const warn = message => { if (!warnings.includes(message)) warnings.push(message) }
  const uriResource = async uri => {
    if (resourceCache.has(uri)) return resourceCache.get(uri)
    let resource
    if (uri.startsWith('data:')) {
      const comma = uri.indexOf(',')
      if (comma < 0) throw Error('Invalid data URI')
      const base64 = uri.slice(0, comma).endsWith(';base64')
      try {
        const encoded = uri.slice(comma + 1)
        if (base64 ? !/^[a-z\d+/]*={0,2}$/i.test(encoded) || encoded.replace(/=+$/, '').length % 4 === 1 : /%(?![a-f\d]{2})/i.test(encoded)) throw Error('Invalid encoding')
        const data = base64 ? Buffer.from(encoded, 'base64') : Buffer.concat(encoded.split(/(%[a-f\d]{2})/i).map(piece => /^%[a-f\d]{2}$/i.test(piece) ? Buffer.from([parseInt(piece.slice(1), 16)]) : Buffer.from(piece)))
        resource = { bytes: data, key: 'data:' + sha256(data), location: 'data-uri', uri: publicUri(uri) }
      }
      catch { throw Error('Invalid encoded data URI') }
    } else {
      const source = publicUri(uri)
      resource = { bytes: null, key: source, location: 'external', uri: source }
      if (/^[a-z][a-z\d+.-]*:/i.test(uri) || uri.startsWith('//')) warn('External remote URI not fetched in this local audit: ' + source)
      else {
        try {
          const target = path.resolve(path.dirname(file), decodeURIComponent(uri.split(/[?#]/)[0]))
          const resolved = await realpath(target)
          if (!inside(scopeRoot, resolved)) throw Error('outside scope')
          resource.bytes = await readFile(resolved)
          resource.key = resolved
        } catch { warn('Missing or out-of-scope external dependency: ' + source) }
      }
      dependencies.set(resource.key, { uri: source, bytes: resource.bytes?.length ?? null })
    }
    resourceCache.set(uri, resource)
    return resource
  }
  const buffers = []
  for (const [index, buffer] of array(doc.buffers).entries()) {
    const resource = buffer.uri ? await uriResource(buffer.uri) : index === 0 && binary ? { bytes: binary, key: 'bin:0', location: 'embedded', uri: null } : { bytes: null, key: 'missing:' + index, location: 'embedded', uri: null }
    if (!Number.isInteger(buffer.byteLength) || buffer.byteLength < 0 || (resource.bytes && resource.bytes.length < buffer.byteLength)) warn('Invalid or truncated buffer ' + index)
    if (!resource.bytes) warn('Unavailable buffer ' + index)
    buffers.push(resource)
  }
  const viewBytes = index => {
    const view = doc.bufferViews?.[index], buffer = buffers[view?.buffer]
    if (!view || !Number.isInteger(view.byteLength) || !Number.isInteger(view.byteOffset ?? 0) || (view.byteOffset ?? 0) < 0 || view.byteLength < 0 || !buffer?.bytes || (view.byteOffset ?? 0) + view.byteLength > buffer.bytes.length) { warn('Unavailable/invalid bufferView ' + index); return null }
    return buffer.bytes.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength)
  }
  const images = []
  for (const [index, image] of array(doc.images).entries()) {
    let resource
    if (image.uri) resource = await uriResource(image.uri)
    else resource = { bytes: viewBytes(image.bufferView), key: 'view:' + image.bufferView, uri: null, location: 'embedded' }
    let metadata
    try { metadata = await imageMetadata(resource.bytes, image.mimeType) }
    catch { warn('Unsupported or invalid image metadata at image ' + index); metadata = await imageMetadata(null, image.mimeType) }
    images.push({ index, name: image.name ?? null, source: resource.uri, resourceKey: resource.location === 'external' ? 'external:' + sha256(Buffer.from(resource.key)) : resource.key, location: resource.location, mimeType: image.mimeType ?? null, encodedBytes: resource.bytes?.length ?? null, sha256: resource.bytes ? sha256(resource.bytes) : null, ...metadata })
  }
  const materials = array(doc.materials).map((material, index) => ({
    index, name: material.name ?? null, shading: material.extensions?.KHR_materials_unlit ? 'unlit' : 'PBR',
    alphaMode: material.alphaMode ?? 'OPAQUE', alphaCutoff: material.alphaCutoff ?? null, doubleSided: material.doubleSided ?? false,
    metallicFactor: material.pbrMetallicRoughness?.metallicFactor ?? 1, roughnessFactor: material.pbrMetallicRoughness?.roughnessFactor ?? 1,
    baseColorFactor: material.pbrMetallicRoughness?.baseColorFactor ?? [1, 1, 1, 1], emissiveFactor: material.emissiveFactor ?? [0, 0, 0], normalScale: material.normalTexture?.scale ?? null, occlusionStrength: material.occlusionTexture?.strength ?? null,
    extensions: Object.keys(material.extensions ?? {}).sort(), properties: material.extensions ?? {},
    textures: textureAssignments(material),
  }))
  for (const material of materials) for (const assignment of material.textures) {
    if (!validIndex(array(doc.textures), assignment.texture)) warn('Invalid material texture reference ' + assignment.texture)
  }
  const gpuResources = new Map()
  const srgbSlots = new Set(['baseColorTexture', 'emissiveTexture', 'diffuseTexture', 'specularGlossinessTexture', 'sheenColorTexture', 'specularColorTexture', 'diffuseTransmissionColorTexture'])
  const textures = array(doc.textures).map((texture, index) => {
    const alternatives = Object.entries(texture.extensions ?? {}).filter(([, value]) => Number.isInteger(value.source)).map(([extension, value]) => ({ extension, image: value.source }))
    if (texture.source !== undefined) alternatives.push({ extension: null, image: texture.source })
    const chosen = alternatives[0], image = images[chosen?.image]
    if (!image) warn('Invalid or missing source for texture ' + index)
    const sampler = texture.sampler === undefined ? {} : doc.samplers?.[texture.sampler]
    if (!sampler) warn('Invalid sampler for texture ' + index)
    const effectiveSampler = { magFilter: sampler?.magFilter ?? 9729, minFilter: sampler?.minFilter ?? 9987, wrapS: sampler?.wrapS ?? 10497, wrapT: sampler?.wrapT ?? 10497 }
    const uses = materials.flatMap(material => material.textures.filter(slot => slot.texture === index).map(slot => ({ material: material.index, ...slot })))
    const colorSpaces = [...new Set(uses.map(use => srgbSlots.has(use.slot.split('.').at(-1)) ? 'sRGB' : 'linear'))].sort()
    const mipmapped = [9984, 9985, 9986, 9987].includes(effectiveSampler.minFilter)
    const compressed = chosen?.extension === 'KHR_texture_basisu' || chosen?.extension === 'MSFT_texture_dds' || !!image?.textureContainer
    let gpuBytesEstimate = null
    if (image?.width && image?.height && !compressed) {
      let width = image.width, height = image.height, pixels = width * height
      while (mipmapped && (width > 1 || height > 1)) { width = Math.max(1, Math.floor(width / 2)); height = Math.max(1, Math.floor(height / 2)); pixels += width * height }
      gpuBytesEstimate = pixels * 4
    }
    // These are unique upload configurations, not a sum of material uses.
    if (image) for (const colorSpace of colorSpaces) gpuResources.set(JSON.stringify([image.resourceKey, effectiveSampler, colorSpace]), { texture: index, colorSpace, bytesEstimate: gpuBytesEstimate })
    return { index, name: texture.name ?? null, image: chosen?.image ?? null, imageInfo: image ? { format: image.format, width: image.width, height: image.height, encodedBytes: image.encodedBytes, decodedRgbaBytesEstimate: image.rgbaBytesEstimate, location: image.location, source: image.source, embeddedMipLevels: image.embeddedMipLevels } : null, sourceAlternatives: alternatives, sampler: effectiveSampler, materialUses: uses, materialReuseCount: new Set(uses.map(use => use.material)).size, preferredSourceNeedsGpuTextureSupport: compressed, gpuBytesEstimatePerUpload: gpuBytesEstimate, mipmaps: compressed ? 'container/device-dependent; see image level count' : mipmapped ? 'likely generated by Three.js' : 'not required by sampler' }
  })
  const accessors = array(doc.accessors), positionAccessors = new Set(), geometryKeys = new Map(), geometryViews = new Set()
  const useAccessor = index => {
    const accessor = accessors[index]
    if (!validIndex(accessors, index) || !Number.isInteger(accessor.count) || accessor.count < 0) { warn('Invalid accessor ' + index); return null }
    if (accessor.bufferView !== undefined) geometryViews.add(accessor.bufferView)
    for (const sparse of [accessor.sparse?.indices, accessor.sparse?.values]) if (sparse?.bufferView !== undefined) geometryViews.add(sparse.bufferView)
    return accessor.count
  }
  const meshes = array(doc.meshes).map((mesh, index) => {
    const primitives = array(mesh.primitives).map((primitive, primitiveIndex) => {
      const position = primitive.attributes?.POSITION
      const vertices = position === undefined ? null : useAccessor(position)
      if (vertices === null) warn('Missing/invalid POSITION at mesh ' + index + ' primitive ' + primitiveIndex)
      else positionAccessors.add(position)
      for (const attribute of Object.values(primitive.attributes ?? {})) useAccessor(attribute)
      for (const target of array(primitive.targets)) for (const attribute of Object.values(target)) useAccessor(attribute)
      const indexed = primitive.indices !== undefined, elements = indexed ? useAccessor(primitive.indices) : vertices, mode = primitive.mode ?? 4
      const triangles = countTriangles(mode, elements)
      if (triangles === null) warn('Unknown topology at mesh ' + index + ' primitive ' + primitiveIndex)
      if (mode === 4 && elements % 3) warn('Nonintegral triangle-list count at mesh ' + index + ' primitive ' + primitiveIndex)
      const draco = primitive.extensions?.KHR_draco_mesh_compression
      if (draco) geometryViews.add(draco.bufferView)
      if (primitive.material !== undefined && !validIndex(materials, primitive.material)) warn('Invalid primitive material at mesh ' + index)
      const attributes = Object.fromEntries(Object.entries(primitive.attributes ?? {}).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
      const geometryKey = JSON.stringify({ attributes, indices: primitive.indices ?? null, mode, targets: primitive.targets ?? [], draco: draco ?? null })
      if (!geometryKeys.has(geometryKey)) geometryKeys.set(geometryKey, { triangles, mesh: index, primitive: primitiveIndex })
      return { index: primitiveIndex, mode, indexed, vertices, elements, triangles, material: primitive.material ?? null, attributes, morphTargets: array(primitive.targets).length, geometryResource: [...geometryKeys.keys()].indexOf(geometryKey), extensions: Object.keys(primitive.extensions ?? {}).sort() }
    })
    return { index, name: mesh.name ?? null, triangles: sumKnown(primitives.map(primitive => primitive.triangles)), primitives }
  })
  const nodes = array(doc.nodes)
  const scenes = array(doc.scenes).map((scene, index) => {
    let nodeInstances = 0, meshInstances = 0, triangles = 0, primitiveDrawsEstimate = 0, unknown = false
    const visit = (id, ancestors = new Set()) => {
      if (!validIndex(nodes, id) || ancestors.has(id)) { warn('Invalid or cyclic scene node ' + id); unknown = true; return }
      const node = nodes[id], next = new Set(ancestors).add(id)
      nodeInstances++
      if (node.mesh !== undefined) {
        const mesh = meshes[node.mesh]
        if (!mesh) { warn('Invalid mesh on node ' + id); unknown = true }
        else {
          const instancing = node.extensions?.EXT_mesh_gpu_instancing?.attributes
          const counts = instancing ? Object.values(instancing).map(useAccessor) : [1]
          const instances = counts[0] ?? null
          if (!counts.length || counts.some(count => count === null || count !== instances)) { warn('Invalid GPU instancing counts on node ' + id); unknown = true }
          meshInstances += instances ?? 0
          primitiveDrawsEstimate += mesh.primitives.length
          if (mesh.triangles === null || instances === null) unknown = true
          else triangles += mesh.triangles * instances
        }
      }
      for (const child of array(node.children)) visit(child, next)
    }
    for (const node of array(scene.nodes)) visit(node)
    return { index, name: scene.name ?? null, nodeInstances, meshInstances: unknown ? null : meshInstances, triangles: unknown ? null : triangles, primitiveDrawsEstimate: unknown ? null : primitiveDrawsEstimate }
  })
  const defaultSceneIndex = doc.scene ?? (scenes.length ? 0 : null), defaultScene = scenes[defaultSceneIndex]
  if (defaultSceneIndex !== null && !defaultScene) warn('Invalid default scene')
  const extensions = new Set([...array(doc.extensionsUsed), ...array(doc.extensionsRequired)])
  for (const mesh of meshes) for (const primitive of mesh.primitives) for (const extension of primitive.extensions) extensions.add(extension)
  for (const view of [...array(doc.bufferViews), ...array(doc.textures)]) for (const extension of Object.keys(view.extensions ?? {})) extensions.add(extension)
  const uniqueImages = [...new Map(images.map(image => [image.resourceKey, image])).values()]
  const duplicateImageGroups = [...new Set(uniqueImages.map(image => image.sha256).filter(Boolean))].map(hash => uniqueImages.filter(image => image.sha256 === hash).map(image => image.index)).filter(group => group.length > 1)
  const externalDependencies = [...dependencies.values()].sort((a, b) => a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0)
  const externalBytes = sumKnown(externalDependencies.map(dependency => dependency.bytes))
  const geometryBufferViewBytes = sumKnown([...geometryViews].map(index => Number.isInteger(doc.bufferViews?.[index]?.byteLength) ? doc.bufferViews[index].byteLength : null))
  const primitives = meshes.flatMap(mesh => mesh.primitives)
  const geometryCompression = [...extensions].filter(extension => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension)).sort()
  const containerImages = images.filter(image => image.textureContainer).length
  return {
    status: warnings.length ? 'partial' : 'ok', warnings: warnings.sort(), format, sha256: sha256(bytes), fileBytes: bytes.length, externalBytes, totalTransferBytes: externalBytes === null ? null : bytes.length + externalBytes, externalDependencies,
    compression: { geometry: geometryCompression, quantization: extensions.has('KHR_mesh_quantization'), textureContainers: containerImages, gpuTextureExtensions: [...extensions].filter(extension => ['KHR_texture_basisu', 'MSFT_texture_dds'].includes(extension)).sort(), extensionsUsed: [...extensions].sort(), extensionsRequired: array(doc.extensionsRequired).toSorted() },
    geometry: { sceneCount: scenes.length, nodeCount: nodes.length, meshCount: meshes.length, primitiveCount: primitives.length, materialCount: materials.length, uniqueGeometryCount: geometryKeys.size, uniqueTriangles: sumKnown([...geometryKeys.values()].map(geometry => geometry.triangles)), meshDefinitionTriangles: sumKnown(meshes.map(mesh => mesh.triangles)), uniqueStoredPositionVertices: sumKnown([...positionAccessors].map(index => accessors[index].count)), uniquePositionAccessors: [...positionAccessors].sort((a, b) => a - b), geometryBufferViewBytes, indexedPrimitiveCount: primitives.filter(primitive => primitive.indexed).length, nonIndexedPrimitiveCount: primitives.filter(primitive => !primitive.indexed).length, animationCount: array(doc.animations).length, skinCount: array(doc.skins).length, skinnedNodes: nodes.filter(node => node.skin !== undefined).length, morphPrimitiveCount: primitives.filter(primitive => primitive.morphTargets > 0).length, defaultSceneIndex, defaultSceneFallback: doc.scene === undefined && !!scenes.length, defaultSceneTriangles: defaultScene?.triangles ?? null, defaultScenePrimitiveDrawsEstimate: defaultScene?.primitiveDrawsEstimate ?? null, lodNodes: nodes.flatMap((node, index) => node.extensions?.MSFT_lod ? [{ index, ids: node.extensions.MSFT_lod.ids }] : []), materialVariants: array(doc.extensions?.KHR_materials_variants?.variants).length, scenes, meshes },
    textureSummary: { imageCount: images.length, uniqueImageSources: uniqueImages.length, textureCount: textures.length, encodedImageBytes: sumKnown(uniqueImages.map(image => image.encodedBytes)), decodedRgbaBytesEstimate: sumKnown(uniqueImages.map(image => image.rgbaBytesEstimate)), gpuUploadConfigurations: gpuResources.size, gpuRgbaBytesEstimate: sumKnown([...gpuResources.values()].map(resource => resource.bytesEstimate)), duplicateImageGroups, unreferencedImages: images.filter(image => !textures.some(texture => texture.sourceAlternatives.some(source => source.image === image.index))).map(image => image.index) },
    materialsSummary: { alphaBlend: materials.filter(material => material.alphaMode === 'BLEND').length, alphaMask: materials.filter(material => material.alphaMode === 'MASK').length, doubleSided: materials.filter(material => material.doubleSided).length, extendedPbr: materials.filter(material => material.extensions.some(extension => extension.startsWith('KHR_materials_') && extension !== 'KHR_materials_unlit')).length },
    largestGeometryContributors: meshes.toSorted((a, b) => (b.triangles ?? -1) - (a.triangles ?? -1) || a.index - b.index).slice(0, 5).map(mesh => ({ mesh: mesh.index, name: mesh.name, triangles: mesh.triangles, primitives: mesh.primitives.length })),
    images, textures, materials,
  }
}
