/* The rooftop: wet deck with real planar reflections, parapet and rail, water tank, air-conditioning units,
   stair hut, vending machine and antenna. All geometry is procedural; nothing is downloaded. */
import * as THREE from '../../vendor/three.custom.min.js';
import { NOISE, ATMOSPHERE } from './glsl.js';

export const DECK = { x: 11, z: 8 };
export const WORKSTATION = new THREE.Vector3(3.0, 0, -2.7);
export const CHARACTER_POS = new THREE.Vector3(2.2, 0, -0.75);

const deckVertex = /* glsl */`
  uniform mat4 textureMatrix;
  varying vec4 vUvR; varying vec3 vWorld;
  void main() {
    vUvR = textureMatrix * vec4(position, 1.0);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vWorld = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const deckFragment = (reflect, ripples) => /* glsl */`
  uniform vec3 color; uniform sampler2D tDiffuse;
  uniform float uTime, uRain, uDawn;
  uniform vec3 uWorkstation, uCharacter;
  varying vec4 vUvR; varying vec3 vWorld;
  ${NOISE}
  ${ATMOSPHERE}

  // expanding rain rings, one per cell
  vec2 rainRipples(vec2 p, float t) {
    vec2 sum = vec2(0.0);
    vec2 ci = floor(p);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 id = ci + vec2(float(x), float(y));
      vec2 r = hash22(id);
      float life = fract(t * (0.6 + r.x * 0.5) + r.y * 7.0);
      vec2 d = p - (id + r);
      float l = length(d);
      float radius = life * 0.75;
      float ring = sin((l - radius) * 44.0) * smoothstep(0.11, 0.0, abs(l - radius)) * (1.0 - life) * (1.0 - life);
      if (l > 0.0001) sum += (d / l) * ring;
    }
    return sum;
  }

  void main() {
    vec2 p = vWorld.xz;

    // concrete tiles
    vec2 g = abs(fract(p / 1.25) - 0.5);
    float joint = smoothstep(0.482, 0.5, max(g.x, g.y));
    float large = fbm(p * 0.42 + 3.0, 3);
    float fine = vnoise(p * 7.0);
    float puddle = smoothstep(0.5, 0.64, large - joint * 0.06);

    vec3 albedo = mix(vec3(0.05, 0.055, 0.085), vec3(0.12, 0.13, 0.18), fine * 0.6 + large * 0.4);
    albedo *= 1.0 - joint * 0.55;

    vec2 bump = (vec2(vnoise(p * 9.0), vnoise(p * 9.0 + 19.0)) - 0.5) * 0.3 * (1.0 - puddle);
    ${ripples ? 'if (puddle > 0.02 && uRain > 0.01) bump += rainRipples(p * 1.35, uTime) * 0.16 * uRain * puddle;' : ''}
    vec3 N = normalize(vec3(bump.x, 1.0, bump.y));
    vec3 V = normalize(cameraPosition - vWorld);
    float F = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float gloss = mix(0.3, 1.0, puddle);

    vec3 refl;
    ${reflect ? /* glsl */`
      vec4 uv = vUvR;
      float spread = mix(0.11, 0.012, puddle);
      uv.xy += N.xz * uv.w * spread;
      refl  = texture2DProj(tDiffuse, uv).rgb * 0.4;
      refl += texture2DProj(tDiffuse, uv + vec4(0.0,  spread * 0.5 * uv.w, 0.0, 0.0)).rgb * 0.2;
      refl += texture2DProj(tDiffuse, uv + vec4(0.0, -spread * 0.5 * uv.w, 0.0, 0.0)).rgb * 0.2;
      refl += texture2DProj(tDiffuse, uv + vec4(0.0,  spread * uv.w, 0.0, 0.0)).rgb * 0.1;
      refl += texture2DProj(tDiffuse, uv + vec4(0.0, -spread * uv.w, 0.0, 0.0)).rgb * 0.1;
    ` : /* glsl */`
      refl = mix(vec3(0.09, 0.065, 0.26), vec3(0.015, 0.024, 0.08), clamp(V.y * 2.2, 0.0, 1.0));
    `}

    // pools of coloured light, computed rather than lit, which keeps the deck cheap
    float dW = length((p - uWorkstation.xz) * vec2(1.0, 1.25));
    vec3 pools = vec3(0.16, 0.70, 0.95) * exp(-dW * dW * 0.2) * 0.95;
    pools += vec3(0.55, 0.32, 1.0) * exp(-pow(length(p - vec2(-7.5, -6.0)), 2.0) * 0.055) * 0.34;
    pools += vec3(0.4, 0.86, 1.0) * exp(-pow(length((p - vec2(7.4, -7.0)) * vec2(1.0, 1.4)), 2.0) * 0.28) * 0.75;
    pools += vec3(1.0, 0.62, 0.24) * exp(-pow(length(p - vec2(-8.7, 2.8)), 2.0) * 0.36) * 0.7;

    // contact shadows
    float dC = length((p - uCharacter.xz) * vec2(1.0, 1.9));
    float occl = 1.0 - 0.8 * exp(-dC * dC * 7.0);
    float dT = length((p - vec2(-7.6, -5.4)) * vec2(0.8, 1.0));
    occl *= 1.0 - 0.45 * exp(-dT * dT * 0.42);

    vec3 ambient = vec3(0.075, 0.085, 0.16);
    vec3 col = albedo * (ambient + pools * 1.9) * occl;
    col += refl * F * gloss * 1.25 * mix(0.8, 1.0, occl);
    col += pools * pow(max(N.y, 0.0), 40.0) * puddle * 0.07;

    float dist = length(vWorld - cameraPosition);
    col = mix(col, hazeColor(uDawn), 1.0 - exp(-dist * 0.003));
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function buildDeck(ctx, addAnimated) {
  const q = ctx.quality;
  const uniforms = {
    color: { value: new THREE.Color(0xffffff) },
    tDiffuse: { value: null },
    textureMatrix: { value: new THREE.Matrix4() },
    uTime: ctx.uniforms.uTime, uRain: ctx.uniforms.uRain, uDawn: ctx.uniforms.uDawn,
    uWorkstation: { value: WORKSTATION }, uCharacter: { value: CHARACTER_POS },
  };
  const geo = new THREE.PlaneGeometry(DECK.x * 2, DECK.z * 2);

  if (q.reflect) {
    const reflector = new THREE.Reflector(geo, {
      textureWidth: q.reflect.width, textureHeight: q.reflect.height, clipBias: 0.001, multisample: 0,
      shader: { name: 'WetDeck', uniforms, vertexShader: deckVertex, fragmentShader: deckFragment(true, q.ripples) },
    });
    const m = reflector.material;
    // Reflector clones the uniforms: re-link the shared ones so they keep updating
    m.uniforms.uTime = ctx.uniforms.uTime;
    m.uniforms.uRain = ctx.uniforms.uRain;
    m.uniforms.uDawn = ctx.uniforms.uDawn;
    m.uniforms.uWorkstation = uniforms.uWorkstation;
    m.uniforms.uCharacter = uniforms.uCharacter;

    // rain and the camera-facing motes would only add noise in the mirror
    const render = reflector.onBeforeRender;
    reflector.onBeforeRender = function (renderer, scene, camera) {
      if (!ctx.reflectionsEnabled) return;
      ctx.reflectTick = (ctx.reflectTick || 0) + 1;
      if (ctx.reflectTick % 2 && !ctx.still) return;
      const hidden = ctx.hideInReflection;
      hidden.forEach((o) => { o.visible = false; });
      render.call(this, renderer, scene, camera);
      hidden.forEach((o) => { o.visible = true; });
    };
    reflector.rotation.x = -Math.PI / 2;
    ctx.reflector = reflector;
    return reflector;
  }

  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: deckVertex, fragmentShader: deckFragment(false, q.ripples) });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

export function buildRooftop(ctx) {
  const group = new THREE.Group();
  group.add(buildDeck(ctx));

  const mat = (color, roughness = 0.82, metalness = 0.1) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const concrete = mat(0x1a1d2c, 0.92, 0);
  const steel = mat(0x262b3e, 0.48, 0.72);
  const dark = mat(0x0c0e18, 0.7, 0.3);
  const paint = mat(0x31384e, 0.62, 0.3);
  const rust = mat(0x38303a, 0.86, 0.2);

  const box = (w, h, d, material, x, y, z, parent = group) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  const cyl = (rt, rb, h, material, x, y, z, seg = 16, parent = group) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), material);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };

  // parapet on all four sides
  const pH = 0.62, pT = 0.3;
  box(DECK.x * 2 + pT, pH, pT, concrete, 0, pH / 2, -DECK.z);
  box(DECK.x * 2 + pT, pH, pT, concrete, 0, pH / 2, DECK.z);
  box(pT, pH, DECK.z * 2, concrete, -DECK.x, pH / 2, 0);
  box(pT, pH, DECK.z * 2, concrete, DECK.x, pH / 2, 0);

  // handrail: instanced posts plus two runs of pipe
  const postGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.75, 6);
  const positions = [];
  for (let x = -DECK.x; x <= DECK.x; x += 1.5) positions.push([x, pH + 0.37, -DECK.z]);
  for (let z = -DECK.z + 1.5; z < DECK.z; z += 1.5) { positions.push([-DECK.x, pH + 0.37, z]); positions.push([DECK.x, pH + 0.37, z]); }
  const posts = new THREE.InstancedMesh(postGeo, steel, positions.length);
  const m4 = new THREE.Matrix4();
  positions.forEach((p, i) => { m4.makeTranslation(p[0], p[1], p[2]); posts.setMatrixAt(i, m4); });
  group.add(posts);
  [pH + 0.75, pH + 0.4].forEach((y) => {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, DECK.x * 2, 6), steel);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, y, -DECK.z);
    group.add(rail);
    [-DECK.x, DECK.x].forEach((x) => {
      const side = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, DECK.z * 2, 6), steel);
      side.rotation.x = Math.PI / 2;
      side.position.set(x, y, 0);
      group.add(side);
    });
  });

  // water tank on stilts
  const tank = new THREE.Group();
  tank.position.set(-7.6, 0, -5.4);
  group.add(tank);
  cyl(1.35, 1.35, 2.2, rust, 0, 3.5, 0, 24, tank);
  cyl(0.15, 1.42, 0.55, dark, 0, 4.87, 0, 24, tank);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([x, z]) => {
    cyl(0.055, 0.055, 2.4, steel, x * 0.9, 1.2, z * 0.9, 6, tank);
  });
  [0.9, 1.75].forEach((y) => { box(2, 0.05, 0.05, steel, 0, y, 0.9, tank); box(2, 0.05, 0.05, steel, 0, y, -0.9, tank); box(0.05, 0.05, 2, steel, 0.9, y, 0, tank); box(0.05, 0.05, 2, steel, -0.9, y, 0, tank); });
  for (let y = 0.3; y < 4.5; y += 0.34) box(0.42, 0.03, 0.03, steel, 1.44, y, 0, tank);
  box(0.03, 4.4, 0.03, steel, 1.44, 2.2, 0.2, tank);
  box(0.03, 4.4, 0.03, steel, 1.44, 2.2, -0.2, tank);

  // air-conditioning units with spinning fans
  const fans = [];
  const fanGeo = new THREE.CylinderGeometry(0.27, 0.27, 0.02, 5);
  const grillGeo = new THREE.TorusGeometry(0.31, 0.022, 6, 22);
  [[6.4, -4.7], [8.4, -4.7], [6.4, -2.6], [8.4, -2.6], [8.7, 1.2]].forEach(([x, z]) => {
    const unit = new THREE.Group();
    unit.position.set(x, 0, z);
    group.add(unit);
    box(1.3, 0.92, 0.82, paint, 0, 0.56, 0, unit);
    box(1.3, 0.1, 0.9, dark, 0, 0.05, 0, unit);
    const grill = new THREE.Mesh(grillGeo, steel);
    grill.position.set(0, 0.56, 0.42);
    unit.add(grill);
    const fan = new THREE.Mesh(fanGeo, dark);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(0, 0.56, 0.415);
    unit.add(fan);
    fans.push(fan);
  });
  // pipework along the right parapet
  [0.82, 1.05].forEach((y, i) => {
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05 - i * 0.012, 0.05 - i * 0.012, 11, 8), i ? steel : paint);
    pipe.rotation.x = Math.PI / 2;
    pipe.position.set(10.35, y - 0.42, -2.2);
    group.add(pipe);
  });

  // stair hut with a warm door light
  box(4, 2.9, 3.4, concrete, -8.6, 1.45, 4.5);
  box(4.2, 0.14, 3.6, dark, -8.6, 2.97, 4.5);
  box(1.04, 2.05, 0.06, paint, -8.2, 1.03, 2.78);
  box(1.2, 0.05, 0.5, steel, -8.2, 2.3, 2.56);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.09, 0.14), new THREE.MeshBasicMaterial({ color: new THREE.Color(3.6, 2.1, 0.8) }));
  lamp.position.set(-8.2, 2.22, 2.62);
  group.add(lamp);

  // vending machine: a small glowing room of its own
  const vm = new THREE.Group();
  vm.position.set(7.4, 0, -7.35);
  group.add(vm);
  box(1.2, 1.95, 0.72, mat(0x151a2c, 0.5, 0.3), 0, 0.98, 0, vm);
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 420;
  const g = canvas.getContext('2d');
  g.fillStyle = '#d5f7ff'; g.fillRect(0, 0, 256, 420);
  const cols = ['#ff9f43', '#4feaff', '#7a5cff', '#f5f7ff', '#ffb648', '#2d7dff'];
  for (let r = 0; r < 4; r++) {
    g.fillStyle = '#0c1a34'; g.fillRect(10, 28 + r * 78 + 58, 236, 8);
    for (let c = 0; c < 5; c++) {
      g.fillStyle = cols[(r * 2 + c * 3) % cols.length];
      g.fillRect(19 + c * 46, 28 + r * 78, 34, 58);
      g.fillStyle = '#ffffff99';
      g.fillRect(22 + c * 46, 32 + r * 78, 7, 50);
    }
  }
  g.fillStyle = '#0c1a34'; g.fillRect(16, 352, 224, 52);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 1.74), new THREE.MeshBasicMaterial({ map: ctx.texture(canvas), color: new THREE.Color(0.95, 0.95, 0.95) }));
  face.position.set(0, 1.0, 0.365);
  vm.add(face);

  // antenna mast and dish
  cyl(0.04, 0.07, 8.4, steel, 8.8, 4.2, -6.9, 8);
  [3, 4.6, 6.2].forEach((y, i) => { box(1.6 - i * 0.4, 0.03, 0.03, steel, 8.8, y, -6.9); });
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.02, 0.02) }));
  beacon.position.set(8.8, 8.45, -6.9);
  group.add(beacon);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, 0.9), paint);
  dish.material.side = THREE.DoubleSide;
  dish.position.set(10.1, 1.5, -6.9);
  dish.rotation.set(-0.8, 0.4, 0.5);
  group.add(dish);
  cyl(0.03, 0.04, 1.1, steel, 10.1, 0.85, -6.9, 6);

  // lights: few and purposeful
  const hemi = new THREE.HemisphereLight(0x4a5fb8, 0x05060f, 1.25);
  const moon = new THREE.DirectionalLight(0xffdcae, 0.85);
  moon.position.set(25, 30, -80);
  const holoLight = new THREE.PointLight(0x4feaff, 34, 15, 2);
  holoLight.position.set(WORKSTATION.x - 0.2, 1.9, WORKSTATION.z + 0.4);
  const violet = new THREE.PointLight(0x9a7bff, 46, 22, 2);
  violet.position.set(-7.2, 4.4, -2.0);
  const vmLight = new THREE.PointLight(0x9fe9ff, 9, 9, 2);
  vmLight.position.set(7.4, 1.2, -6.5);
  const door = new THREE.PointLight(0xffa64a, 8, 8, 2);
  door.position.set(-8.2, 2.1, 2.2);
  group.add(hemi, moon, holoLight, violet, vmLight, door);

  return {
    object: group,
    holoLight,
    update(dt, time, frame) {
      fans.forEach((f, i) => { f.rotation.y += dt * (8 + i * 2.3); });
      beacon.material.color.setRGB(0.2 + Math.max(Math.sin(time * 1.4), 0) * 5.5, 0.03, 0.02);
      holoLight.intensity = 30 + Math.sin(time * 2.1) * 2.5;
      hemi.intensity = 1.25 + frame.dawn * 1.8;
      moon.color.setHex(0xffdcae);
      moon.intensity = 0.85 + frame.dawn * 2.2;
    },
  };
}
