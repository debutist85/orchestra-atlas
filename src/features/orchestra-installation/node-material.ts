import * as THREE from 'three'
import type { OrchestraVisualSettings } from './config'
import { neutralSectionVisualState, type SectionVisualState } from './visual-state'

// Stable across presets and rebuilds; independent of mesh grouping/order.
export function nodeSeed(id: string): number {
  let hash = 2166136261
  for (const character of id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619)
  return (hash >>> 0) / 4294967296
}

export function createNodeMaterial(color: string, settings: OrchestraVisualSettings) {
  const { nodes } = settings
  const hueOffset = nodes.palette.hueVariationDegrees / 360
  const base = new THREE.Color(color)
  const uniforms = {
    nodeTime: { value: 0 },
    nodeLow: { value: base.clone().offsetHSL(-hueOffset, 0, -0.04) },
    nodeHigh: { value: base.clone().offsetHSL(hueOffset, 0, 0.04) },
    nodeScale: { value: nodes.swirl.scale },
    nodeContrast: { value: nodes.swirl.contrast },
    nodeVariation: { value: nodes.palette.brightnessVariation },
    nodeIntensity: { value: settings.interaction.neutralIntensity },
    nodeActivity: { value: 0 },
    nodeShadow: { value: nodes.internalShadow },
  }
  const material = new THREE.MeshStandardMaterial({
    color: '#ffffff', emissive: '#ffffff',
    emissiveIntensity: nodes.emissiveIntensity,
    roughness: nodes.roughness, metalness: 0,
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float nodeSeed;
attribute vec3 nodePalette;
varying vec3 vNodePalette;
varying float vNodeSeed;
varying vec3 vNodePosition;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vNodeSeed = nodeSeed;
vNodePalette = nodePalette;
vNodePosition = position;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vNodeSeed;
varying vec3 vNodePalette;
varying vec3 vNodePosition;
uniform float nodeTime, nodeScale, nodeContrast, nodeVariation, nodeIntensity, nodeActivity;
uniform float nodeShadow;
uniform vec3 nodeLow, nodeHigh;
float nodeHash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float nodeNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(nodeHash(i), nodeHash(i + vec3(1,0,0)), f.x),
                 mix(nodeHash(i + vec3(0,1,0)), nodeHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(nodeHash(i + vec3(0,0,1)), nodeHash(i + vec3(1,0,1)), f.x),
                 mix(nodeHash(i + vec3(0,1,1)), nodeHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
vec3 p = vNodePosition * nodeScale + vNodeSeed * 31.7;
float t = nodeTime * 6.2831853;
vec3 flow = vec3(sin(p.y + t), cos(p.z - t * 0.7), sin(p.x + t * 0.8));
float patches = smoothstep(0.2, 0.8, nodeNoise(p + flow * 0.65));
float paletteMix = clamp(patches * 0.7 + vNodeSeed * 0.3, 0.0, 1.0);
vec3 nodeColor = vNodePalette * mix(nodeLow, nodeHigh, paletteMix);
float brightness = 1.0 + (vNodeSeed * 2.0 - 1.0) * nodeVariation;
float depth = mix(1.0 - nodeContrast, 1.0, patches);
diffuseColor.rgb *= nodeColor * brightness * nodeIntensity;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// View-space interior light gives a bright upper-left core and a shaded lower
// hemisphere. Apply it to emission as well as diffuse so emission cannot flatten it.
float interiorLight = smoothstep(-0.35, 0.9, dot(normal, normalize(vec3(-0.45, 0.65, 0.6))));
float rimDepth = pow(max(dot(normal, normalize(vViewPosition)), 0.0), 0.45);
float volumeShade = mix(1.0, (0.08 + 0.92 * pow(interiorLight, 1.5)) * (0.25 + 0.75 * rimDepth), nodeShadow);
diffuseColor.rgb *= volumeShade;
// Normalize emission's peak channel rather than luminance: saturated reds and
// blues can glow without driving yellows to white. Diffuse retains palette depth.
vec3 emissionColor = nodeColor / max(max(nodeColor.r, max(nodeColor.g, nodeColor.b)), 0.001);
totalEmissiveRadiance *= emissionColor * depth * volumeShade * nodeIntensity * (1.0 + nodeActivity * 0.5);`)
  }
  material.customProgramCacheKey = () => 'orchestra-flowing-nodes-v2'

  return {
    material,
    setTime(seconds: number) {
      uniforms.nodeTime.value = nodes.swirl.enabled ? seconds * nodes.swirl.speed : 0
    },
    setState(state: SectionVisualState = neutralSectionVisualState) {
      const emphasis = THREE.MathUtils.clamp(state.emphasis, -1, 1)
      uniforms.nodeIntensity.value = emphasis < 0
        ? THREE.MathUtils.lerp(settings.interaction.neutralIntensity, settings.interaction.dimmedIntensity, -emphasis)
        : THREE.MathUtils.lerp(settings.interaction.neutralIntensity, settings.interaction.highlightedIntensity, emphasis)
      uniforms.nodeActivity.value = THREE.MathUtils.clamp(state.activity, 0, 1)
      material.opacity = THREE.MathUtils.clamp(state.opacity, 0, 1)
      const transparent = material.opacity < 1
      if (material.transparent !== transparent) {
        material.transparent = transparent
        material.depthWrite = !transparent
        material.needsUpdate = true
      }
    },
  }
}
