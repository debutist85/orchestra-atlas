import { Color, ShaderMaterial } from 'three'

export const referenceSettings = {
  speed: 0.65, complexity: 1, distortion: 1, strands: 5,
  thickness: 1, brightness: 1.2, folds: 0.18, ambient: 0.035,
  highlights: 2.4, glow: 0.65, glowRadius: 1, opacity: 1, color: '#35c9ff',
}
export type OrbSettings = typeof referenceSettings

export function createLiquidMaterial() {
  return new ShaderMaterial({
    depthTest: false, depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      ...Object.fromEntries(Object.entries(referenceSettings).map(([key, value]) =>
        [key, { value: key === 'color' ? new Color(value) : value }])),
    },
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform float uTime, complexity, distortion, strands, thickness, brightness;
      uniform float folds, ambient, highlights, glow, glowRadius, opacity;
      uniform vec3 color;

      // A smooth, bounded field. Sampling on the unit circle avoids a polar seam.
      float field(vec3 p) {
        return (sin(p.x + sin(p.y * 1.31 + p.z))
          + sin(p.y * 1.17 + sin(p.z * 0.93 + p.x))
          + sin(p.z + sin(p.x * 1.23 + p.y))) / 3.;
      }
      void main() {
        vec2 p = (vUv - .5) * 2.8;
        float r = length(p);
        vec2 dir = p / max(r, .0001);
        float t = uTime;
        float aa = max(fwidth(r), .001);
        float core = 0.; float haze = 0.; float silk = 0.;
        for (int i = 0; i < 8; i++) {
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
        gl_FragColor = vec4((1. - exp(-light)) * opacity, 1.);
        #include <colorspace_fragment>
      }
    `,
  })
}
