/* Rain and drifting motes. Everything moves in the vertex shader: the CPU updates one number per frame,
   however many drops there are. */
import * as THREE from '../../vendor/three.custom.min.js';
import { WORKSTATION } from './rooftop.js';

const BOX = new THREE.Vector3(26, 15, 26);

export function buildRain(ctx) {
  const count = ctx.quality.rain;
  const offset = new Float32Array(count * 2 * 3);
  const seed = new Float32Array(count * 2);
  const isEnd = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * BOX.x, y = Math.random() * BOX.y, z = Math.random() * BOX.z, s = Math.random();
    for (let e = 0; e < 2; e++) {
      const k = i * 2 + e;
      offset[k * 3] = x; offset[k * 3 + 1] = y; offset[k * 3 + 2] = z;
      seed[k] = s;
      isEnd[k] = e;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(offset, 3));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(isEnd, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: ctx.uniforms.uTime, uRain: ctx.uniforms.uRain, uBox: { value: BOX }, uCam: ctx.uniforms.uCam, uWorkstation: { value: WORKSTATION } },
    vertexShader: /* glsl */`
      attribute float aSeed, aEnd;
      uniform float uTime, uRain; uniform vec3 uBox, uCam, uWorkstation;
      varying float vA; varying vec3 vTint;
      void main() {
        float speed = 11.0 + aSeed * 7.0;
        vec3 wind = vec3(-0.17, -1.0, -0.05);
        vec3 p = position + wind * uTime * speed;
        // wrap inside a box centred on the camera: rain is always near, however far the camera flies
        p = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
        float len = 0.22 + aSeed * 0.34;
        p -= wind * len * aEnd;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float near = smoothstep(14.0, 2.0, -mv.z);
        vA = (0.09 + near * 0.3) * uRain * (aEnd > 0.5 ? 0.15 : 1.0);
        // drops pick up the hologram's colour as they pass it
        float lit = exp(-dot(p - uWorkstation, p - uWorkstation) * 0.09);
        vTint = mix(vec3(0.55, 0.68, 1.0), vec3(0.3, 1.5, 2.0), lit);
      }
    `,
    fragmentShader: /* glsl */`
      varying float vA; varying vec3 vTint;
      void main() {
        gl_FragColor = vec4(vTint * vA, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 9;
  ctx.hideInReflection.push(lines);

  return {
    object: lines,
    update(_dt, _t, frame) { lines.visible = frame.rain > 0.01; },
  };
}

export function buildMotes(ctx) {
  const count = ctx.quality.motes;
  if (!count) return null;
  const pos = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = WORKSTATION.x + (Math.random() - 0.5) * 7;
    pos[i * 3 + 1] = Math.random() * 3.8;
    pos[i * 3 + 2] = WORKSTATION.z + (Math.random() - 0.5) * 6;
    phase[i] = Math.random() * 6.28;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: ctx.uniforms.uTime, uScale: ctx.uniforms.uPointScale },
    vertexShader: /* glsl */`
      attribute float aPhase; uniform float uTime, uScale; varying float vA;
      void main() {
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.05 + fract(aPhase) * 0.09), 3.8);
        p.x += sin(uTime * 0.4 + aPhase) * 0.2;
        p.z += cos(uTime * 0.33 + aPhase * 1.4) * 0.2;
        vec4 mv = viewMatrix * vec4(p, 1.0);
        vA = (0.4 + 0.6 * sin(uTime * 1.1 + aPhase * 3.0)) * smoothstep(0.0, 0.5, p.y) * smoothstep(3.8, 2.8, p.y);
        gl_PointSize = clamp(uScale * 26.0 / max(-mv.z, 0.5), 1.5, 8.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vA;
      void main() {
        float a = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(vec3(0.35, 1.5, 2.1) * a * max(vA, 0.0) * 0.8, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 8;
  ctx.hideInReflection.push(points);
  return { object: points };
}
