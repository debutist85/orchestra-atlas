import { Color, ShaderMaterial } from 'three'

import { liquidOrbConfig } from './config'
export type { OrbSettings } from './config'
export const referenceSettings = liquidOrbConfig.material

export function createLiquidMaterial(instanced = false, filled = false) {
  return new ShaderMaterial({
    depthTest: instanced, depthWrite: false,
    transparent: instanced, premultipliedAlpha: instanced,
    defines: { ...(filled ? { PROTOTYPE_FILLED: 1 } : {}), LIQUID_MAX_STRANDS: liquidOrbConfig.rendering.maxStrands, ...(instanced ? { LIQUID_INSTANCED: 1 } : {}) },
    uniforms: {
      orbDrawLayer: { value: 0 },
      orbPriorityBloom: { value: 0 },
      uTime: { value: 0 },
      fillBrightness: { value: liquidOrbConfig.filled.brightness },
      rimActivity: { value: 0 },
      rimMinThickness: { value: liquidOrbConfig.rim.minThickness },
      rimMaxThickness: { value: liquidOrbConfig.rim.maxThickness },
      rimBrightness: { value: liquidOrbConfig.rim.brightness },
      rimGlow: { value: liquidOrbConfig.rim.glow },
      halfExtent: { value: liquidOrbConfig.rendering.halfExtent },
      darkVolumeOpacity: { value: liquidOrbConfig.rendering.darkVolumeOpacity },
      ...Object.fromEntries(Object.entries(referenceSettings).map(([key, value]) =>
        [key, { value: key === 'color' ? new Color(value) : value }])),
    },
    vertexShader: `varying vec2 vUv;
      #ifdef LIQUID_INSTANCED
        #ifndef PROTOTYPE_FILLED
          attribute vec4 orbFlow;
        #endif
        #ifdef PROTOTYPE_FILLED
          attribute float orbForeground;
          uniform float orbDrawLayer;
        #endif
        attribute vec4 orbLight;
        attribute vec3 nodePalette;
        #ifndef PROTOTYPE_FILLED
          varying vec4 vFlow;
        #endif
        varying vec4 vLight;
        varying vec3 vColor;
      #endif
      void main() {
        vUv = uv;
        #ifdef LIQUID_INSTANCED
          #ifndef PROTOTYPE_FILLED
            vFlow = orbFlow;
          #endif
          vLight = orbLight; vColor = nodePalette;
          #ifdef PROTOTYPE_FILLED
            if (abs(orbForeground - orbDrawLayer) > .5) {
              gl_Position = vec4(2., 2., 2., 1.);
              return;
            }
          #endif
          mat4 world = modelMatrix * instanceMatrix;
          vec4 center = viewMatrix * world * vec4(0., 0., 0., 1.);
          vec2 size = vec2(length(world[0].xyz), length(world[1].xyz));
          gl_Position = projectionMatrix * (center + vec4(position.xy * size, 0., 0.));
        #else
          gl_Position = vec4(position.xy, 0., 1.);
        #endif
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float thickness, folds, ambient, highlights, halfExtent, darkVolumeOpacity;
      #ifdef LIQUID_INSTANCED
        #ifndef PROTOTYPE_FILLED
          varying vec4 vFlow;
        #endif
        varying vec4 vLight;
        varying vec3 vColor;
        #define uTime vFlow.x
        #define complexity vFlow.y
        #define distortion vFlow.z
        #define strands vFlow.w
        #define brightness vLight.x
        #define glow vLight.y
        #define glowRadius vLight.z
        #define opacity vLight.w
        #define color vColor
      #else
        uniform float uTime, complexity, distortion, strands, brightness;
        uniform float glow, glowRadius, opacity;
        uniform vec3 color;
      #endif


      #ifdef PROTOTYPE_FILLED
        uniform float rimMinThickness, rimMaxThickness, rimBrightness, rimGlow;
        #ifdef LIQUID_INSTANCED
          uniform float orbDrawLayer, orbPriorityBloom;
          #define fillBrightness vLight.x
          #define rimActivity vLight.y
        #else
          uniform float fillBrightness, rimActivity;
        #endif
      #endif
      // A smooth, bounded field. Sampling on the unit circle avoids a polar seam.
      float field(vec3 p) {
        return (sin(p.x + sin(p.y * 1.31 + p.z))
          + sin(p.y * 1.17 + sin(p.z * 0.93 + p.x))
          + sin(p.z + sin(p.x * 1.23 + p.y))) / 3.;
      }
      void main() {
        vec2 p = (vUv - .5) * (2. * halfExtent);
        float r = length(p);
        #ifndef PROTOTYPE_FILLED
          vec2 dir = p / max(r, .0001);
          float t = uTime;
        #endif
        float aa = max(fwidth(r), .001);
        #ifdef PROTOTYPE_FILLED
          float disk = 1. - smoothstep(1. - aa, 1. + aa, r);
          vec3 emission = color / max(max(color.r, max(color.g, color.b)), .001);
          vec3 fill = emission * fillBrightness * disk;
          float activity = clamp(rimActivity, 0., 1.);
          float rimWidth = mix(rimMinThickness, max(rimMinThickness, rimMaxThickness), activity);
          #ifdef PROTOTYPE_DISC_ONLY
            // Repaint the foreground disc after bloom, occluding the rear corona.
            // Keep opacity as a light fade while the silhouette remains opaque.
            #ifdef LIQUID_INSTANCED
              gl_FragColor = vec4(fill * opacity, disk * opacity);
            #else
              gl_FragColor = vec4(emission * fillBrightness * opacity, disk);
            #endif
          #else
            float outside = 1. - disk;
            float distance = max(r - 1., 0.);
            float rim = (1. - smoothstep(0., rimWidth + aa, distance)) * outside;
            float visibility = smoothstep(0., .04, activity);
            float shine = rimBrightness * (.7 + .3 * activity);
            float halo = exp(-distance / max(.003, rimWidth * 1.5)) * outside * rimGlow * shine * visibility;
            // An exponential tail never reaches zero. Fade the whole corona
            // radially inside the billboard so its square bounds cannot show,
            // including in the HDR bloom source and transparency coverage.
            float haloEnd = max(1.001, halfExtent - 2. * aa);
            float haloStart = 1. + (haloEnd - 1.) * .5;
            float haloMask = 1. - smoothstep(haloStart, haloEnd, r);
            float corona = (rim * shine * visibility + halo) * haloMask;
            vec3 radiance = fill + vec3(corona);
            #ifdef LIQUID_INSTANCED
              #ifdef ORB_BLOOM_SOURCE
                // During foreground compositing, inactive discs no longer mask
                // bloom; only the foreground disc occludes its own inward glow.
                float occlusion = mix(1., orbDrawLayer, orbPriorityBloom);
                gl_FragColor = vec4(radiance * opacity * vLight.z, disk * opacity * occlusion);
              #else
                float coverage = max(disk, clamp(corona, 0., 1.));
                gl_FragColor = vec4(radiance * opacity, coverage * opacity);
              #endif
            #else
              gl_FragColor = vec4(radiance * opacity, 1.);
            #endif
          #endif
        #else
        float core = 0.; float haze = 0.; float silk = 0.;
        for (int i = 0; i < LIQUID_MAX_STRANDS; i++) {
          float k = float(i);
          float enabled = clamp(strands - k, 0., 1.);
          vec3 domain = vec3(dir * (2.1 + .35 * complexity), k * 2.73);
          float warp = field(domain + vec3(t * .21, -t * .17, t * .13));
          float flow = field(domain * 1.7 + vec3(warp * 1.8, t * .29, -t * .23));
          // Narrow inward pleats stretch and flatten as independent fields meet.
          float pleat = pow(.5 + .5 * sin(dot(dir, vec2(2.7, -1.6))
            + k * 1.9 + warp * 3.1 + t * (.19 + k * .017)), 8.);
          float radius = .99 + distortion * (.025 * warp + .018 * flow
            - (.07 + .018 * k) * pleat) - .009 * k;
          float d = abs(r - radius);
          float gate = smoothstep(-.55, .6, flow + .3 * warp);
          float light = (.035 + pow(gate, highlights) * 1.3) * enabled;
          float width = .0025 * thickness * (.55 + gate * .65);
          float line = 1. - smoothstep(width, width + aa * 1.2, d);
          core += line * light;
          haze += light * (.24 * exp(-d / (.017 * glowRadius))
            + .055 * exp(-d / (.065 * glowRadius)));
          // One-sided diffusion reads as a translucent membrane below each crest.
          silk += light * exp(-d / .035) * (1. - smoothstep(radius - .035, radius + .004, r));
        }
        float inside = 1. - smoothstep(.94, 1.01, r);
        float z = sqrt(max(0., 1. - r * r));
        vec3 surface = vec3(p, z);
        float foldField = field(surface * (3.4 * complexity) + vec3(t * .12, -t * .16, t * .09));
        float folded = field(surface * 6. + foldField * 2. + vec3(-t * .16, t * .11, 1.));
        float veins = pow(max(0., 1. - abs(folded) * 8.), 3.);
        float edge = pow(clamp(r, 0., 1.), 3.);
        float interior = inside * (ambient * (.15 + edge * .7)
          + folds * (veins * .15 + silk * .3) * edge);
        vec3 light = color * (interior + haze * glow + core * brightness);
        light += mix(color, vec3(.8, .95, 1.), .78)
          * pow(max(core - .45, 0.), 1.6) * brightness * .65;
        // Exponential rolloff retains color in overlapping highlights.
        vec3 radiance = 1. - exp(-light);
        #ifdef LIQUID_INSTANCED
          // Premultiplied transparency preserves dark volume over the video,
          // with localized transparent glow. OutputPass owns color conversion.
          float alpha = max(inside * darkVolumeOpacity, max(radiance.r, max(radiance.g, radiance.b)));
          gl_FragColor = vec4(radiance * opacity, alpha * opacity);
        #else
          gl_FragColor = vec4(radiance * opacity, 1.);
          #include <colorspace_fragment>
        #endif
        #endif
      }
    `,
  })
}
