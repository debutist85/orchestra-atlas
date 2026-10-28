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
