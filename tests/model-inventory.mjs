import assert from 'node:assert/strict'
import { mkdtemp, writeFile, readFile, rm, realpath } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import sharp from 'sharp'
import { analyzeModel, parseContainer, publicUri, sha256 } from '../scripts/lib/gltf-inventory.mjs'
import { auditModels, renderReports } from '../scripts/audit-models.mjs'

const directory = await mkdtemp(path.join(os.tmpdir(), 'orchestra-model-inventory-'))
const pad = (bytes, fill = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, fill)])
function glb(doc, bin) {
  const json = pad(Buffer.from(JSON.stringify(doc)), 32), binary = pad(bin), header = Buffer.alloc(12), a = Buffer.alloc(8), b = Buffer.alloc(8)
  header.writeUInt32LE(0x46546c67); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + json.length + binary.length, 8)
  a.writeUInt32LE(json.length); a.writeUInt32LE(0x4e4f534a, 4); b.writeUInt32LE(binary.length); b.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([header, a, json, b, binary])
}
try {
  const image = await sharp({ create: { width: 4, height: 4, channels: 4, background: '#123456' } }).png().toBuffer()
  const positions = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer)
  const indices = Buffer.from(new Uint16Array([0, 1, 2]).buffer)
  const binary = Buffer.concat([positions, pad(indices), Buffer.alloc(48), image])
  const doc = {
    asset: { version: '2.0' }, buffers: [{ byteLength: binary.length }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }, { buffer: 0, byteOffset: 44, byteLength: 48 }, { buffer: 0, byteOffset: 92, byteLength: image.length }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }, { bufferView: 2, componentType: 5126, count: 4, type: 'VEC3' }],
    images: [{ bufferView: 3, mimeType: 'image/png' }], textures: [{ source: 0 }, { source: 0 }, { source: 0, sampler: 0 }], samplers: [{ minFilter: 9729 }],
    materials: [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }, { alphaMode: 'BLEND', doubleSided: true, normalTexture: { index: 2 }, pbrMetallicRoughness: { baseColorTexture: { index: 1 } } }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }, { primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 1 }] }],
    nodes: [{ mesh: 0 }, { mesh: 1, children: [2] }, { mesh: 0 }, { mesh: 0, extensions: { EXT_mesh_gpu_instancing: { attributes: { TRANSLATION: 2 } } } }],
    scenes: [{ nodes: [0, 1, 3] }, { nodes: [0] }], scene: 0,
  }
  const file = path.join(directory, 'shared.glb'), original = glb(doc, binary)
  await writeFile(file, original)
  const model = await analyzeModel(file, { root: directory })
  assert.equal(model.status, 'ok')
  assert.equal(model.geometry.uniqueTriangles, 1)
  assert.equal(model.geometry.meshDefinitionTriangles, 2)
  assert.equal(model.geometry.uniqueStoredPositionVertices, 3)
  assert.equal(model.geometry.defaultSceneTriangles, 7)
  assert.equal(model.geometry.defaultScenePrimitiveDrawsEstimate, 4)
  assert.equal(model.geometry.scenes[1].triangles, 1)
  assert.equal(model.textureSummary.decodedRgbaBytesEstimate, 64)
  assert.equal(model.textureSummary.gpuRgbaBytesEstimate, 148, 'one shared mipmapped sRGB upload (84 B), one nonmipmapped linear upload (64 B)')
  assert.equal(model.textures[0].materialReuseCount, 1)
  assert.equal(model.materialsSummary.alphaBlend, 1)
  assert.equal(model.materialsSummary.doubleSided, 1)
  assert.equal(model.totalTransferBytes, original.length)
  assert.equal(sha256(await readFile(file)), sha256(original), 'source remains unchanged')
  assert.deepEqual(await analyzeModel(file, { root: directory }), model, 'deterministic metadata')

  await writeFile(path.join(directory, 'positions.bin'), positions)
  await writeFile(path.join(directory, 'shared.png'), image)
  const external = structuredClone(doc)
  external.buffers = [{ uri: 'positions.bin', byteLength: positions.length }]
  external.bufferViews = [{ buffer: 0, byteLength: positions.length }]
  external.accessors = [doc.accessors[0]]
  external.meshes = [{ primitives: [{ attributes: { POSITION: 0 } }] }]
  external.nodes = [{ mesh: 0 }]; external.scenes = [{ nodes: [0] }]
  external.images = [{ uri: 'shared.png' }, { uri: 'shared.png' }]
  external.textures = [{ source: 0 }, { source: 1 }]; external.materials = []
  const externalFile = path.join(directory, 'external.gltf')
  await writeFile(externalFile, JSON.stringify(external))
  const analyzedExternal = await analyzeModel(externalFile, { root: directory })
  assert.equal(analyzedExternal.externalBytes, positions.length + image.length)
  assert.equal(analyzedExternal.textureSummary.uniqueImageSources, 1)
  assert.equal(analyzedExternal.textureSummary.decodedRgbaBytesEstimate, 64)
  assert.equal(analyzedExternal.textureSummary.duplicateImageGroups.length, 0, 'already shared references are not duplicate-payload candidates')
  assert.equal(analyzedExternal.geometry.nonIndexedPrimitiveCount, 1)

  external.buffers[0].uri = 'https://username:password@example.com/buffer.bin?token=SECRET'
  external.images = [{ uri: 'missing.png' }]
  await writeFile(externalFile, JSON.stringify(external))
  const missing = await analyzeModel(externalFile, { root: directory })
  assert.equal(missing.status, 'partial')
  assert.equal(missing.totalTransferBytes, null)
  assert.equal(missing.textureSummary.decodedRgbaBytesEstimate, null)
  assert.ok(!/SECRET|password|username/.test(JSON.stringify(missing)), 'remote credentials/query never enter reports')
  assert.equal(publicUri('https://user:secret@example.com/a.glb?X-Amz-Signature=SECRET#fragment'), 'https://example.com/a.glb')

  const ktx = Buffer.alloc(112)
  Buffer.from('ab4b5458203230bb0d0a1a0a', 'hex').copy(ktx)
  ktx.writeUInt32LE(4, 20); ktx.writeUInt32LE(4, 24); ktx.writeUInt32LE(1, 40)
  ktx.writeBigUInt64LE(104n, 80); ktx.writeBigUInt64LE(8n, 88); ktx.writeBigUInt64LE(8n, 96)
  const compressed = structuredClone(external)
  compressed.buffers = []; compressed.images = [{ uri: 'data:image/ktx2;base64,' + ktx.toString('base64') }]
  compressed.meshes = []; compressed.nodes = []; compressed.scenes = []
  compressed.textures = [{ extensions: { KHR_texture_basisu: { source: 0 } } }]
  compressed.materials = [{ pbrMetallicRoughness: { baseColorTexture: { index: 0 } } }]
  const compressedFile = path.join(directory, 'compressed.gltf')
  await writeFile(compressedFile, JSON.stringify(compressed))
  const analyzedCompressed = await analyzeModel(compressedFile, { root: directory })
  assert.equal(analyzedCompressed.images[0].format, 'ktx2')
  assert.equal(analyzedCompressed.images[0].embeddedMipLevels, 1)
  assert.equal(analyzedCompressed.textureSummary.gpuRgbaBytesEstimate, null, 'device transcode residency is not guessed')
  assert.deepEqual(analyzedCompressed.compression.gpuTextureExtensions, ['KHR_texture_basisu'])
  assert.equal(analyzedCompressed.geometry.defaultSceneTriangles, null)

  const invalid = Buffer.from(original); invalid.writeUInt32LE(0, 8)
  assert.throws(() => parseContainer(invalid, 'glb'), /Invalid GLB/)
  assert.throws(() => parseContainer(Buffer.from('{}'), 'fbx'), /Unsupported/)
  const reports = renderReports({ scope: 'test', models: [{ ...model, localPath: 'a,"quoted".glb', instrumentName: 'Fixture', instrumentId: null }], warnings: [], method: [], validation: [] })
  assert.match(reports.csv, /a,""quoted"".glb/)
  assert.match(reports.markdown, /estimated/)
  await writeFile(path.join(directory, 'unsupported.fbx'), 'unsupported fixture')
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ instruments: [{ instrument: 'missing', file: '/old/workspace/missing.glb' }] }))
  const discovered = await auditModels(await realpath(directory))
  assert.equal(discovered.models.filter(model => model.status === 'failed').length, 2, 'missing and unsupported assets do not stop other analyses')
  assert.ok(discovered.models.some(model => model.localPath.endsWith('shared.glb') && model.status === 'ok'))
  assert.ok(discovered.models.some(model => model.localPath.endsWith('missing/missing.glb') && model.status === 'failed'))
  assert.equal(sha256(await readFile(file)), sha256(original), 'full discovery/audit also leaves source unchanged')
  console.log('Passed model inventory: shared geometry/instances, GPU instancing, shared images/uploads, external bytes, unknowns, URI redaction, compressed textures, invalid containers, deterministic output and source immutability.')
} finally { await rm(directory, { recursive: true, force: true }) }
