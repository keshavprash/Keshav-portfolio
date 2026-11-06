/* The city: one instanced box mesh, one draw call. Windows are generated in the shader from
   world position, so no textures are downloaded and they stay crisp at every distance. */
import * as THREE from '../../vendor/three.custom.min.js';
import { NOISE, ATMOSPHERE } from './glsl.js';

export const GROUND_Y = -72;

function mulberry(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Named towers frame the rooftop and line the canyon the camera later flies through. They also carry neon signs. */
export const LANDMARKS = [
  // x, z, width, depth, top
  [-30, -24, 15, 15, 34], [31, -27, 13, 14, 25], [40, -52, 16, 15, 46], [-37, -52, 17, 15, 21],
  [10, -60, 16, 13, 6], [-5, -74, 12, 12, -3],
  // canyon around x = -20, flown through during the Projects section
  [-32, -84, 13, 15, 14], [-8, -86, 13, 15, 20], [-33, -110, 14, 16, 26], [-7, -114, 14, 14, 10],
  [-34, -138, 14, 16, 12], [-6, -142, 14, 14, 30], [-33, -168, 15, 15, 34], [-6, -172, 15, 15, 16],
];

function layout(count) {
  const rand = mulberry(20260811);
  const list = LANDMARKS.map(([x, z, w, d, top]) => ({ x, z, w, d, top }));
  const blocked = (x, z, w, d) => LANDMARKS.some(([lx, lz, lw, ld]) => Math.abs(x - lx) < (w + lw) * 0.5 + 2 && Math.abs(z - lz) < (d + ld) * 0.5 + 2);

  const nearCount = Math.floor(count * 0.42);
  const midCount = Math.floor(count * 0.33);
  let guard = 0;

  // near: low rooftops around the building we stand on
  while (list.length < LANDMARKS.length + nearCount && guard++ < 6000) {
    const x = -130 + rand() * 260, z = 60 - rand() * 240;
    const w = 7 + rand() * 9, d = 7 + rand() * 9;
    if (Math.abs(x) < 15 + w / 2 && Math.abs(z) < 12 + d / 2) continue; // our own building
    if (x > -27 && x < -13 && z < -18 && z > -240) continue;            // keep the canyon clear
    if (blocked(x, z, w, d)) continue;
    const centre = Math.abs(x) < 42 && z < -10;                         // keep the view to the moon open
    const top = centre ? -22 + rand() * 18 : -24 + rand() * rand() * 44;
    list.push({ x, z, w, d, top });
  }
  // mid: the body of the skyline
  guard = 0;
  const midEnd = list.length + midCount;
  while (list.length < midEnd && guard++ < 6000) {
    const z = -130 - rand() * 300, x = (rand() - 0.5) * 560;
    const w = 12 + rand() * 18, d = 12 + rand() * 18;
    if (x > -29 && x < -11 && z > -240) continue;
    if (blocked(x, z, w, d)) continue;
    const top = -2 + rand() * rand() * 96 * (Math.abs(x) < 40 ? 0.42 : 1);
    list.push({ x, z, w, d, top });
  }
  // far: tall silhouettes fading into the haze
  while (list.length < count) {
    const a = -Math.PI * (0.06 + rand() * 0.88);
    const r = 430 + rand() * 520;
    const w = 20 + rand() * 34, d = 20 + rand() * 34;
    list.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, w, d, top: 8 + rand() * rand() * 170 });
  }
  return { list, rand };
}

export function buildCity(ctx) {
  const { list, rand } = layout(ctx.quality.buildings);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const seeds = new Float32Array(list.length);
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: ctx.uniforms.uTime, uDawn: ctx.uniforms.uDawn },
    vertexShader: /* glsl */`
      attribute float aSeed;
      varying vec3 vWorld; varying vec3 vN; varying float vSeed;
      void main() {
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = w.xyz; vN = normal; vSeed = aSeed;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uTime, uDawn;
      varying vec3 vWorld; varying vec3 vN; varying float vSeed;
      ${NOISE}
      ${ATMOSPHERE}
      void main() {
        vec3 n = abs(vN);
        bool roof = n.y > 0.5;
        vec2 uv = n.x > 0.5 ? vWorld.zy : vWorld.xy;

        // concrete: faces away from the moon are darker
        float shade = vN.z > 0.5 ? 1.0 : (vN.x > 0.5 ? 0.62 : 0.46);
        float heightTint = smoothstep(-72.0, 60.0, vWorld.y);
        vec3 base = mix(vec3(0.010, 0.012, 0.028), vec3(0.030, 0.036, 0.078), heightTint) * shade;
        vec3 col = base;

        if (roof) {
          col = vec3(0.012, 0.014, 0.03);
        } else {
          vec2 cellSize = mix(vec2(1.2, 2.0), vec2(1.8, 2.7), vSeed);
          vec2 cell = uv / cellSize + vSeed * 37.0;
          vec2 id = floor(cell), f = fract(cell);
          vec2 aa = fwidth(cell) + 0.004;
          float pane = smoothstep(0.17 - aa.x, 0.17 + aa.x, f.x) * smoothstep(0.83 + aa.x, 0.83 - aa.x, f.x) * smoothstep(0.23 - aa.y, 0.23 + aa.y, f.y) * smoothstep(0.77 + aa.y, 0.77 - aa.y, f.y);

          float r = hash21(id + vSeed * 91.0);
          float lit = step(0.76 - vSeed * 0.16, r);
          // a few windows slowly switch on and off, so the city feels occupied
          float blink = step(0.97, hash21(id * 1.7 + vSeed)) * step(0.5, fract(uTime * 0.035 + r * 9.0));
          lit = max(lit * (1.0 - blink), blink * 0.0);

          float r2 = hash21(id + 5.1);
          vec3 warm = vec3(1.0, 0.66, 0.32), cool = vec3(0.45, 0.86, 1.0), pale = vec3(0.86, 0.9, 1.0), violet = vec3(0.62, 0.44, 1.0);
          vec3 win = r2 < 0.5 ? warm : (r2 < 0.72 ? pale : (r2 < 0.9 ? cool : violet));
          float power = (0.16 + r * r * 0.72) * (1.0 - uDawn * 0.72);

          vec3 facade = base + win * lit * pane * power;
          // unlit glass catches a little sky
          facade += vec3(0.012, 0.016, 0.04) * pane * (1.0 - lit);

          // distant windows blend to their average, which prevents shimmer
          float lod = max(length(dFdx(cell)), length(dFdy(cell)));
          float avg = (0.30 + vSeed * 0.14) * (1.0 - uDawn * 0.72);
          vec3 distant = base + mix(warm, cool, vSeed * 0.6) * avg * 0.17;
          col = mix(facade, distant, smoothstep(0.3, 0.85, lod));

          // floor lines add scale up close
          float ledge = smoothstep(0.03, 0.0, abs(fract(vWorld.y / 14.0) - 0.5));
          col = mix(col, col * 0.55, ledge * (1.0 - smoothstep(0.3, 0.85, lod)));
        }

        // sunlight rakes the east faces at the end
        col += vec3(0.5, 0.26, 0.14) * uDawn * uDawn * step(0.5, vN.z) * 0.20 * smoothstep(-40.0, 100.0, vWorld.y);

        float dist = length(vWorld - cameraPosition);
        float groundHaze = mix(1.3, 0.72, smoothstep(-72.0, 30.0, vWorld.y));
        float fog = 1.0 - exp(-dist * 0.0030 * groundHaze);
        col = mix(col, hazeColor(uDawn), fog);

        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });

  const mesh = new THREE.InstancedMesh(geometry, material, list.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const s = new THREE.Vector3();
  list.forEach((b, i) => {
    const h = b.top - GROUND_Y;
    p.set(b.x, GROUND_Y + h / 2, b.z);
    s.set(b.w, h, b.d);
    m.compose(p, q, s);
    mesh.setMatrixAt(i, m);
    seeds[i] = rand();
  });
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  mesh.frustumCulled = false;

  // our own building, seen when the camera leaves the roof
  const own = new THREE.Mesh(new THREE.BoxGeometry(22, -GROUND_Y, 16), new THREE.MeshBasicMaterial({ color: 0x05060f }));
  own.position.set(0, GROUND_Y / 2 - 0.01, 0);

  // red aircraft beacons on the taller roofs
  const tall = list.filter((b) => b.top > 22).slice(0, 34);
  const beaconGeo = new THREE.BufferGeometry();
  beaconGeo.setAttribute('position', new THREE.Float32BufferAttribute(tall.flatMap((b) => [b.x, b.top + 2.4, b.z]), 3));
  beaconGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(tall.map(() => rand() * 6.28), 1));
  const beaconMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: ctx.uniforms.uTime, uScale: ctx.uniforms.uPointScale, uDawn: ctx.uniforms.uDawn },
    vertexShader: /* glsl */`
      attribute float aPhase; uniform float uTime, uScale; varying float vA;
      void main() {
        vec4 mv = viewMatrix * vec4(position, 1.0);
        vA = smoothstep(0.55, 1.0, 0.5 + 0.5 * sin(uTime * 1.5 + aPhase));
        gl_PointSize = clamp(uScale * 1500.0 / max(-mv.z, 1.0), 2.0, 13.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */`
      varying float vA; uniform float uDawn;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.9, 0.16, 0.12) * a * a * (0.25 + vA * 2.0) * (1.0 - uDawn * 0.6), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const beacons = new THREE.Points(beaconGeo, beaconMat);
  beacons.frustumCulled = false;

  const group = new THREE.Group();
  group.add(mesh, own, beacons);

  // a monorail crossing the middle distance keeps the city moving
  const train = new THREE.Group();
  const trainMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.5, 2.1) });
  const carGeo = new THREE.BoxGeometry(11, 1.6, 1.8);
  for (let i = 0; i < 6; i++) { const car = new THREE.Mesh(carGeo, trainMat); car.position.x = i * 12; train.add(car); }
  train.position.set(-280, -13.6, -122);
  const beamMat = new THREE.MeshBasicMaterial({ color: 0x03040c });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(800, 0.7, 1.1), beamMat);
  beam.position.set(0, -14.8, -122);
  group.add(train, beam);

  return {
    object: group,
    update(dt) {
      train.position.x += dt * 26;
      if (train.position.x > 260) train.position.x = -340;
    },
  };
}

/* Soft layers of mist between skyline depths: the multiplane trick that sells distance. */
export function buildMist(ctx) {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: ctx.uniforms.uTime, uDawn: ctx.uniforms.uDawn },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uDawn; varying vec2 vUv;
      ${NOISE}
      void main() {
        float n = fbm(vec2(vUv.x * 7.0 + uTime * 0.012, vUv.y * 2.2), 3);
        float a = smoothstep(0.3, 0.74, n) * smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.45, vUv.y) * smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);
        vec3 c = mix(vec3(0.17, 0.11, 0.42), vec3(1.0, 0.5, 0.26), uDawn);
        gl_FragColor = vec4(c * a * 0.42, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(1, 1);
  [[-175, 800, 56, -28], [-310, 1100, 90, -16], [-520, 1600, 150, 8]].forEach(([z, w, h, y], i) => {
    const plane = new THREE.Mesh(geo, mat);
    plane.position.set(i * 60 - 40, y, z);
    plane.scale.set(w, h, 1);
    plane.renderOrder = 1;
    group.add(plane);
  });
  return { object: group };
}
