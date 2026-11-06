/* Procedural sky: midnight gradient, moon, stars and drifting clouds. Warms to first light as the page ends. */
import * as THREE from '../../vendor/three.custom.min.js';
import { NOISE } from './glsl.js';

export const MOON_DIR = new THREE.Vector3(0.125, 0.215, -0.97).normalize();

export function buildSky(ctx) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    defines: { OCTAVES: ctx.quality.cloudOctaves },
    uniforms: { uTime: ctx.uniforms.uTime, uDawn: ctx.uniforms.uDawn, uMoonDir: { value: MOON_DIR } },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = p.xyww; // always at the far plane, wherever the camera flies
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime, uDawn; uniform vec3 uMoonDir;
      varying vec3 vDir;
      ${NOISE}
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;

        // night
        vec3 zenith  = vec3(0.0035, 0.0065, 0.026);
        vec3 upper   = vec3(0.012, 0.022, 0.082);
        vec3 horizon = vec3(0.078, 0.052, 0.235);
        vec3 glow    = vec3(0.19, 0.085, 0.42);
        // first light
        vec3 zenithD  = vec3(0.022, 0.05, 0.16);
        vec3 upperD   = vec3(0.17, 0.15, 0.38);
        vec3 horizonD = vec3(1.25, 0.56, 0.26);
        vec3 glowD    = vec3(1.7, 0.78, 0.30);

        float dawn = uDawn;
        zenith = mix(zenith, zenithD, dawn); upper = mix(upper, upperD, dawn);
        horizon = mix(horizon, horizonD, dawn); glow = mix(glow, glowD, dawn);

        vec3 col = mix(horizon, upper, smoothstep(0.0, 0.26, h));
        col = mix(col, zenith, smoothstep(0.16, 0.72, h));
        col += glow * exp(-max(h, 0.0) * 11.0) * 0.62;

        // stars fade out as the sky lightens
        vec2 sp = d.xz / (abs(d.y) + 0.35) * 150.0;
        vec2 si = floor(sp);
        float sr = hash21(si);
        float star = smoothstep(0.9965, 1.0, sr) * smoothstep(0.42, 0.04, length(fract(sp) - 0.5));
        star *= 0.55 + 0.45 * sin(uTime * (1.0 + sr * 3.0) + sr * 40.0);
        col += vec3(0.8, 0.88, 1.0) * star * smoothstep(0.04, 0.3, h) * (1.0 - dawn) * 1.6;

        // moon: a large pale-gold disc with soft maria
        float m = dot(d, uMoonDir);
        float ang = acos(clamp(m, -1.0, 1.0));
        float disc = smoothstep(0.086, 0.0835, ang);
        vec3 tang = normalize(cross(uMoonDir, vec3(0, 1, 0)));
        vec3 bitan = cross(tang, uMoonDir);
        vec3 moonCol = vec3(0.0);
        if (ang < 0.09) {
          vec2 mp = vec2(dot(d, tang), dot(d, bitan)) * 11.5;
          float maria = fbm(mp * 1.6 + 3.1, 4);
          moonCol = mix(vec3(1.0, 0.8, 0.5), vec3(0.6, 0.45, 0.36), smoothstep(0.42, 0.7, maria)) * 1.02;
        }
        float halo = exp(-ang * 12.0) * 0.1 + exp(-ang * 3.2) * 0.035;
        col += vec3(1.0, 0.76, 0.46) * halo * (1.0 - dawn * 0.75);
        col = mix(col, moonCol * (1.0 - dawn * 0.82), disc * (1.0 - dawn * 0.65));

        // clouds on a plane above the city
        if (h > -0.03) {
          float k = 1.0 / (max(h, 0.0) + 0.17);
          vec2 cp = d.xz * k * 1.15 + vec2(uTime * 0.0065, uTime * 0.0022);
          float n = fbm(cp, OCTAVES);
          float n2 = fbm(cp * 2.4 - vec2(uTime * 0.004, 0.0), 2);
          float cov = smoothstep(0.43, 0.78, n * 0.8 + n2 * 0.28);
          // lit from below by the city, edged by the moon
          vec3 under = mix(vec3(0.05, 0.035, 0.145), vec3(0.74, 0.34, 0.25), dawn);
          vec3 top = mix(vec3(0.16, 0.18, 0.40), vec3(1.5, 0.92, 0.62), dawn);
          vec3 cloud = mix(under, top, smoothstep(0.45, 0.9, n2 + exp(-ang * 2.6) * 0.5));
          cloud += vec3(1.0, 0.78, 0.5) * exp(-ang * 5.0) * 0.32 * (1.0 - dawn);
          float fade = smoothstep(-0.03, 0.05, h) * smoothstep(0.92, 0.3, h);
          col = mix(col, cloud, cov * fade * 0.86);
        }

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const geometry = new THREE.SphereGeometry(10, 32, 20);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10; // drawn after opaque geometry, so the depth test skips every covered pixel
  return { object: mesh };
}
