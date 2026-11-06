/* The 2D anime-inspired character standing inside the 3D world.
   Two painted cards in real space, like cels on a multiplane camera: the figure, and behind it
   the wind layer (jacket tail and strap) which the vertex shader moves on its own. */
import * as THREE from '../../vendor/three.custom.min.js';
import { CHARACTER_POS } from './rooftop.js';

const ASPECT = 760 / 1160;
const FIGURE_HEIGHT = 1.84;                  // metres, feet to crown
const CARD_HEIGHT = (FIGURE_HEIGHT * 1160) / 1084; // the art has a margin around the figure
const FEET_OFFSET = (CARD_HEIGHT * 62) / 1160;

function load(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function material(ctx, texture, wind) {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { map: { value: texture }, uTime: ctx.uniforms.uTime, uWind: { value: wind }, uLight: { value: 1 }, uDawn: ctx.uniforms.uDawn },
    vertexShader: /* glsl */`
      uniform float uTime, uWind;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 p = position;
        if (uWind > 0.5) {
          // the jacket tail ripples, more toward its free end at the right
          float free = smoothstep(0.62, 0.98, uv.x) * smoothstep(0.2, 0.42, uv.y);
          p.y += sin(uTime * 2.3 + uv.x * 9.0) * 0.034 * free;
          p.x += sin(uTime * 1.5 + uv.y * 6.0) * 0.022 * free;
        } else {
          // the hair lifts slightly, the whole figure breathes
          float hair = smoothstep(0.78, 0.98, uv.y) * smoothstep(0.42, 0.74, uv.x);
          p.x += sin(uTime * 1.9 + uv.y * 16.0) * 0.012 * hair;
          p.y += sin(uTime * 2.4 + uv.x * 14.0) * 0.008 * hair;
          p.y += sin(uTime * 1.25) * 0.0035 * smoothstep(0.45, 0.8, uv.y);
        }
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform sampler2D map; uniform float uLight, uDawn;
      varying vec2 vUv;
      void main() {
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.01) discard;
        vec3 c = t.rgb * t.rgb * uLight;                       // art is authored for display: bring it close to linear
        c *= 1.0 + 0.5 * smoothstep(0.7, 1.0, max(t.r, max(t.g, t.b))); // the painted rims catch the bloom
        c = mix(c, c * vec3(1.25, 0.95, 0.85), uDawn);
        gl_FragColor = vec4(c, t.a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export async function buildCharacter(ctx) {
  const [figureImg, windImg] = await Promise.all([load(ctx.assets.character), load(ctx.assets.characterWind)]);
  const make = (img) => {
    const t = new THREE.Texture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    t.needsUpdate = true;
    ctx.track(t);
    return t;
  };

  const group = new THREE.Group();
  group.position.copy(CHARACTER_POS);

  const geo = new THREE.PlaneGeometry(CARD_HEIGHT * ASPECT, CARD_HEIGHT, 18, 26);
  const windMat = material(ctx, make(windImg), 1);
  const figureMat = material(ctx, make(figureImg), 0);

  const wind = new THREE.Mesh(geo, windMat);
  wind.position.set(0, CARD_HEIGHT / 2 - FEET_OFFSET, -0.12);
  wind.renderOrder = 6;
  const figure = new THREE.Mesh(geo, figureMat);
  figure.position.set(0, CARD_HEIGHT / 2 - FEET_OFFSET, 0);
  figure.renderOrder = 7;
  group.add(wind, figure);

  return {
    object: group,
    /* Turns gently toward the camera, so the card never shows its flat edge. */
    update(dt, time, frame, camera) {
      const dx = camera.position.x - group.position.x;
      const dz = camera.position.z - group.position.z;
      const want = Math.atan2(dx, dz);
      group.rotation.y += (want - group.rotation.y) * (1 - Math.exp(-dt * 4));
      const pulse = 1.0 + Math.sin(time * 2.1) * 0.02;
      figureMat.uniforms.uLight.value = pulse;
      windMat.uniforms.uLight.value = pulse * 0.92;
      // once the camera has left the roof, drawing the character is wasted work
      group.visible = frame.shot < 3.4;
    },
  };
}
