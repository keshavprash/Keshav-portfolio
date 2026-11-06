/* The holographic developer workstation: a real 3D desk and laptop under floating code panels.
   Panel text uses only details verified from this portfolio. */
import * as THREE from '../../vendor/three.custom.min.js';
import { WORKSTATION } from './rooftop.js';

function paintPanel(lines, opts = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = opts.width || 720;
  canvas.height = opts.height || 900;
  const g = canvas.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, canvas.width, canvas.height);
  const fs = opts.size || 30;
  g.font = `500 ${fs}px "JetBrains Mono", Consolas, monospace`;
  g.textBaseline = 'top';
  const lh = fs * 1.5;
  lines.forEach((line, i) => {
    // brightness encodes emphasis: the shader tints everything hologram-blue
    const y = 20 + i * lh;
    if (typeof line === 'string') {
      g.fillStyle = line.trim().startsWith('//') ? '#7c7c7c' : '#e6e6e6';
      g.fillText(line, 28, y);
    } else {
      g.fillStyle = '#ffffff';
      g.fillRect(28 + line.x * fs * 0.6, y + fs * 0.25, line.w * fs * 0.6, fs * 0.5);
    }
  });
  return canvas;
}

const CODE = [
  '// keshav-prashar/portfolio',
  'const developer = {',
  '  name: "Keshav Prashar",',
  '  role: "Full Stack Developer",',
  '  stack: "MERN",',
  '  based: "Jaipur, India",',
  '};',
  '',
  'app.get("/api/projects", auth,',
  '  async (req, res) => {',
  '    const items = await Project',
  '      .find({ owner: req.user.id });',
  '    res.json({ items });',
  '  });',
  '',
  'io.on("connection", (socket) => {',
  '  socket.join(socket.user.room);',
  '});',
  '',
];

const STACK = [
  '// stack', 'MongoDB', 'Express.js', 'React.js', 'Node.js', '', '// also', 'Next.js', 'Tailwind CSS', 'Docker', 'Git',
];

const GIT = [
  '$ git status', 'On branch main', '', '$ npm run dev', '> vite', '', '$ docker compose up', '',
  { x: 0, w: 16 }, { x: 2, w: 22 }, { x: 0, w: 12 }, { x: 4, w: 18 }, { x: 2, w: 9 },
];

export async function buildWorkstation(ctx) {
  const group = new THREE.Group();
  group.position.copy(WORKSTATION);
  const animated = [];

  const holoMat = (canvas, tint, scroll, power = 1) => {
    const map = ctx.texture(canvas, false);
    map.wrapT = THREE.RepeatWrapping;
    const m = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { map: { value: map }, uTime: ctx.uniforms.uTime, uTint: { value: new THREE.Color(tint) }, uScroll: { value: scroll }, uPower: { value: power } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D map; uniform float uTime, uScroll, uPower; uniform vec3 uTint;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          float t = texture2D(map, vec2(uv.x, fract(uv.y * 0.72 + uTime * uScroll))).r;
          float scan = 0.82 + 0.18 * sin(uv.y * 520.0 - uTime * 5.0);
          vec2 e = min(uv, 1.0 - uv);
          float frame = smoothstep(0.012, 0.0, min(e.x, e.y * 1.4));
          float corner = step(min(e.x, e.y * 1.4), 0.02) * step(max(e.x, e.y * 1.4), 0.11);
          float fill = 0.05 + 0.05 * smoothstep(0.0, 1.0, uv.y);
          float fadeEdge = smoothstep(0.0, 0.05, e.y) * smoothstep(0.0, 0.03, e.x);
          float a = (fill + t * 0.95 * fadeEdge) * scan + frame * 0.45 + corner * 1.5;
          gl_FragColor = vec4(uTint * a * 1.2 * uPower, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
    });
    return m;
  };

  const panel = (canvas, w, h, x, y, z, ry, rx, tint, scroll, power) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), holoMat(canvas, tint, scroll, power));
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, 0);
    mesh.renderOrder = 4;
    group.add(mesh);
    animated.push({ mesh, y, phase: x * 3.1 });
    return mesh;
  };

  panel(paintPanel(CODE, { width: 900, height: 1024, size: 34 }), 2.15, 1.3, -0.25, 1.95, -0.65, 0.03, -0.03, 0x4feaff, 0.012, 1);
  await ctx.pause();
  panel(paintPanel(STACK, { width: 512, height: 640, size: 42 }), 1.0, 1.0, -1.85, 1.72, 0.05, 0.56, 0, 0x8e8bff, 0.0, 1.05);
  await ctx.pause();
  panel(paintPanel(GIT, { width: 640, height: 768, size: 34 }), 1.05, 1.0, 1.42, 1.78, 0.0, -0.5, 0, 0x4fb8ff, 0.006, 1);
  await ctx.pause();

  // desk
  const top = new THREE.MeshStandardMaterial({ color: 0x151a2e, roughness: 0.3, metalness: 0.6 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x2a3148, roughness: 0.42, metalness: 0.8 });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.055, 0.84), top);
  desk.position.set(-0.1, 0.92, 0);
  group.add(desk);
  [[-1.2, 0], [1.0, 0]].forEach(([x]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.92, 0.7), metal);
    leg.position.set(x, 0.46, 0);
    group.add(leg);
  });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(2.48, 0.012, 0.012), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 1.9, 2.4) }));
  strip.position.set(-0.1, 0.895, 0.42);
  group.add(strip);

  // laptop
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.022, 0.42), metal);
  base.position.set(-0.4, 0.96, 0.08);
  group.add(base);
  const screen = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.014), metal);
  screen.position.set(-0.4, 1.15, -0.15);
  screen.rotation.x = -0.26;
  group.add(screen);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.36), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.28, 1.05, 1.3) }));
  glow.position.set(-0.4, 1.15, -0.141);
  glow.rotation.x = -0.26;
  group.add(glow);

  // projector ring and a slowly turning wireframe core
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.9, 2.4) }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0.62, 0.955, 0.02);
  group.add(ring);

  const coneMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: `varying float vH; void main(){ vH = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */`
      varying float vH;
      void main() {
        float a = pow(1.0 - vH, 2.0) * 0.2;
        gl_FragColor = vec4(vec3(0.25, 1.1, 1.5) * a, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.18, 0.62, 28, 1, true), coneMat);
  cone.position.set(0.62, 1.26, 0.02);
  group.add(cone);

  const coreGeo = new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.2, 1));
  const core = new THREE.LineSegments(coreGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(0.35, 1.5, 2.0), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  core.position.set(0.62, 1.34, 0.02);
  group.add(core);
  const coreInner = new THREE.Mesh(new THREE.IcosahedronGeometry(0.075, 0), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 0.6, 2.2) }));
  coreInner.position.copy(core.position);
  group.add(coreInner);

  return {
    object: group,
    update(dt, time) {
      core.rotation.y += dt * 0.38;
      core.rotation.x += dt * 0.13;
      coreInner.rotation.y -= dt * 0.8;
      for (let i = 0; i < animated.length; i++) {
        const a = animated[i];
        a.mesh.position.y = a.y + Math.sin(time * 0.7 + a.phase) * 0.012;
      }
    },
  };
}
