import * as THREE from 'three'
import type { OrchestraVisualSettings } from '../config'
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
    idlePhase: { value: 0 },
    idleStrength: { value: 0 },
    nodeLow: { value: base.clone().offsetHSL(-hueOffset, 0, -0.04) },
    nodeHigh: { value: base.clone().offsetHSL(hueOffset, 0, 0.04) },
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
attribute float nodeFocus;
attribute float nodeIdle;
varying float vNodeFocus;
varying float vNodeIdle;
attribute vec3 nodePalette;
varying vec3 vNodePalette;
varying float vNodeSeed;
`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vNodeFocus = nodeFocus;
vNodeIdle = nodeIdle;
vNodeSeed = nodeSeed;
vNodePalette = nodePalette;
`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying float vNodeSeed;
varying float vNodeFocus;
varying float vNodeIdle;
varying vec3 vNodePalette;

uniform float nodeVariation, nodeIntensity, nodeActivity;
uniform float nodeShadow;
uniform float idlePhase, idleStrength;
uniform vec3 nodeLow, nodeHigh;
`)
      .replace('#include <color_fragment>', `#include <color_fragment>
float paletteMix = 0.35 + vNodeSeed * 0.3;
vec3 nodeColor = vNodePalette * mix(nodeLow, nodeHigh, paletteMix);
float brightness = 1.0 + (vNodeSeed * 2.0 - 1.0) * nodeVariation;
diffuseColor.rgb *= nodeColor * brightness * nodeIntensity * vNodeFocus * vNodeIdle;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
// View-space interior light gives a bright upper-left core and a shaded lower
// hemisphere. Apply it to emission as well as diffuse so emission cannot flatten it.
float interiorLight = smoothstep(-0.35, 0.9, dot(normal, normalize(vec3(-0.45, 0.65, 0.6))));
float rimDepth = pow(max(dot(normal, normalize(vViewPosition)), 0.0), 0.45);
float volumeShade = mix(1.0, (0.08 + 0.92 * pow(interiorLight, 1.5)) * (0.25 + 0.75 * rimDepth), nodeShadow);
diffuseColor.rgb *= volumeShade;
// Normalize emission's peak channel rather than luminance: saturated reds and
// blues can glow without driving yellows to white. Diffuse retains palette depth.
// Idle luminosity is applied after that normalize so it can actually reach the glow.
vec3 emissionColor = nodeColor / max(max(nodeColor.r, max(nodeColor.g, nodeColor.b)), 0.001);
float idlePulse = (sin(idlePhase * (0.8 + vNodeSeed * 0.5) + vNodeSeed * 31.0)
  + sin(idlePhase * 0.47 + vNodeSeed * 19.0)) * 0.5;
totalEmissiveRadiance *= emissionColor * volumeShade * nodeIntensity * vNodeFocus * vNodeIdle
  * (1.0 + nodeActivity * 0.5) * (1.0 + idlePulse * idleStrength);`)
  }
  material.customProgramCacheKey = () => 'orchestra-nodes-v6'

  return {
    material,
    setTime(seconds: number, idleAmount = 0) {
      uniforms.idlePhase.value = seconds * Math.PI * 2 / Math.max(1, nodes.idle.pulsePeriodSeconds)
      uniforms.idleStrength.value = nodes.idle.enabled ? nodes.idle.brightnessVariation * idleAmount : 0
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
