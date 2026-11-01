import assert from 'node:assert/strict'
import sharp from 'sharp'
import { optimizeTextures } from '../scripts/optimize-model-textures.mjs'
import { parseContainer } from '../scripts/lib/gltf-inventory.mjs'

const pad = (bytes, fill = 0) => Buffer.concat([bytes, Buffer.alloc((4 - bytes.length % 4) % 4, fill)])
function glb(doc, binary) {
  const json = pad(Buffer.from(JSON.stringify(doc)), 32), bin = pad(binary)
  const h = Buffer.alloc(12), j = Buffer.alloc(8), b = Buffer.alloc(8)
  h.writeUInt32LE(0x46546c67); h.writeUInt32LE(2, 4); h.writeUInt32LE(28 + json.length + bin.length, 8)
  j.writeUInt32LE(json.length); j.writeUInt32LE(0x4e4f534a, 4)
  b.writeUInt32LE(bin.length); b.writeUInt32LE(0x004e4942, 4)
  return Buffer.concat([h, j, json, b, bin])
}
const flat = await sharp({ create: { width: 8, height: 8, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } }).png().toBuffer()
const raw = Buffer.alloc(8 * 8 * 4)
for (let i = 0; i < raw.length; i += 4) { raw[i] = i % 251; raw[i + 1] = 128; raw[i + 2] = 240; raw[i + 3] = 255 }
const detail = await sharp(raw, { raw: { width: 8, height: 8, channels: 4 } }).png().toBuffer()
const geometry = Buffer.from(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer)
const parts = [flat, geometry, flat, detail, detail].map(b => pad(b))
let offset = 0
const lengths = [flat.length, geometry.length, flat.length, detail.length, detail.length]
const views = parts.map((p, i) => { const v = { buffer: 0, byteOffset: offset, byteLength: lengths[i] }; offset += p.length; return v })
const doc = {
  asset: { version: '2.0', extras: { author: 'fixture', license: 'retained verbatim' } },
  buffers: [{ byteLength: offset }], bufferViews: views,
  accessors: [{ bufferView: 1, componentType: 5126, count: 3, type: 'VEC3' }],
  images: [0, 2, 3, 4].map(bufferView => ({ bufferView, mimeType: 'image/png' })),
  textures: [0, 1, 2, 3].map(source => ({ source })),
  materials: [
    { pbrMetallicRoughness: { baseColorTexture: { index: 0 } } },
    { normalTexture: { index: 1 } },
    { normalTexture: { index: 2 } },
    { normalTexture: { index: 3 }, emissiveTexture: { index: 3 } },
  ],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, material: 0 }] }],
  nodes: [{ mesh: 0, extras: { bufferView: 99 } }], scenes: [{ nodes: [0] }], scene: 0,
}
const source = glb(doc, Buffer.concat(parts))
const { output } = await optimizeTextures(source, { dataSize: 4, colorSize: 8 })
const { document: result, binary } = parseContainer(output, 'glb')
assert.equal(result.images.length, 3, 'identical solid images share one source')
assert.deepEqual(result.asset, doc.asset)
assert.deepEqual(result.nodes, doc.nodes, 'application extras must not be remapped')
assert.deepEqual(result.materials, doc.materials)
const v = result.bufferViews[result.accessors[0].bufferView]
assert.ok(binary.subarray(v.byteOffset, v.byteOffset + v.byteLength).equals(geometry), 'geometry survives interleaved image view removal')
async function pixels(texture) {
  const image = result.images[result.textures[texture].source], v = result.bufferViews[image.bufferView]
  return sharp(binary.subarray(v.byteOffset, v.byteOffset + v.byteLength)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
}
const solid = await pixels(0), data = await pixels(2), mixed = await pixels(3)
assert.equal(solid.info.width, 1)
assert.deepEqual([...solid.data], [10, 20, 30, 128], 'solid RGB and alpha survive')
assert.equal(data.info.width, 4)
assert.equal(mixed.info.width, 8, 'mixed color/data usage retains color resolution')
assert.ok(mixed.data.equals(raw), 'full-resolution color pixels are lossless')
assert.ok((await optimizeTextures(source, { dataSize: 4, colorSize: 8 })).output.equals(output), 'deterministic export')
const preserved = parseContainer((await optimizeTextures(source, { dataSize: 4, colorSize: 8, imageSizeOverrides: { 2: 8 } })).output, 'glb')
const detailImage = preserved.document.images[preserved.document.textures[2].source]
const detailView = preserved.document.bufferViews[detailImage.bufferView]
const preservedPixels = await sharp(preserved.binary.subarray(detailView.byteOffset, detailView.byteOffset + detailView.byteLength)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
assert.equal(preservedPixels.info.width, 8, 'an asset-specific map can retain its original resolution')
assert.ok(preservedPixels.data.equals(raw), 'preserved detail pixels remain unchanged')
await assert.rejects(optimizeTextures(source, { imageSizeOverrides: { 2: 0 } }))
const unsupported = structuredClone(doc); unsupported.buffers[0].uri = 'external.bin'
await assert.rejects(optimizeTextures(glb(unsupported, Buffer.concat(parts))))
console.log('Model texture optimization checks passed')
