import type { Texture } from 'three'
import type { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { liquidOrbConfig } from './config'

// UnrealBloomPass.radius redistributes light between blur layers rather than
// limiting its reach. Attenuate the broad layers as well for a compact halo.
export function configureOrbBloom(pass: UnrealBloomPass) {
  const material = pass.compositeMaterial
  material.uniforms.orbBloomLayers = { value: [...liquidOrbConfig.rendering.bloomLayerWeights] }
  material.fragmentShader = material.fragmentShader
    .replace('uniform float bloomStrength;', 'uniform float bloomStrength; uniform float orbBloomLayers[NUM_MIPS];')
    .replace(/lerpBloomFactor\( bloomFactors\[ (\d) \] \)/g, '$& * orbBloomLayers[ $1 ]')
}


// Keep source extraction and silhouette masking identical in the map and GPU
// regression harness. Source alpha decides which discs occlude blurred light.
export function configureOrbBloomSource(pass: UnrealBloomPass, source: Texture) {
  const extraction = pass.materialHighPassFilter
  extraction.uniforms.orbSource = { value: source }
  extraction.uniforms.orbEnabled = { value: liquidOrbConfig.constellation.enabled ? 1 : 0 }
  extraction.fragmentShader = extraction.fragmentShader
    .replace('float v = luminance( texel.xyz );', 'float v = max( texel.r, max( texel.g, texel.b ) );')
    .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse; uniform sampler2D orbSource; uniform float orbEnabled;')
    .replace('vec4 texel = texture2D( tDiffuse, vUv );', 'vec4 texel = mix(texture2D(tDiffuse, vUv), texture2D(orbSource, vUv), orbEnabled);')
  const blend = pass.blendMaterial
  blend.uniforms.orbSource = extraction.uniforms.orbSource
  blend.uniforms.orbEnabled = extraction.uniforms.orbEnabled
  blend.fragmentShader = blend.fragmentShader
    .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse; uniform sampler2D orbSource; uniform float orbEnabled;')
    .replace('gl_FragColor = opacity * texel;', 'gl_FragColor = opacity * texel * (1. - clamp(texture2D(orbSource, vUv).a, 0., 1.) * orbEnabled);')
}
