/* Camera controls: one cinematic shot per page section, joined by a spline.
   Scroll position picks a place on the path; damping keeps it smooth; the pointer adds parallax. */
import * as THREE from '../vendor/three.custom.min.js';

/* World layout: the rooftop deck is y = 0, x in [-11, 11], z in [-8, 8]. The skyline lies toward -z.
   `narrow` overrides apply to portrait screens, where the character is framed centrally. */
export const SHOTS = [
  { id: 'home',       pos: [-0.55, 1.34, 4.5],  look: [0.34, 1.86, -12],  fov: 40, exposure: 1.0,  dawn: 0,    rain: 1,
    narrow: { pos: [2.05, 1.75, 4.3], look: [2.15, -1.55, -6], fov: 58 } },
  { id: 'about',      pos: [5.9, 1.62, 1.5],    look: [-4.1, 1.72, -1.6], fov: 38, exposure: 0.84, dawn: 0.02, rain: 0.85,
    narrow: { pos: [5.2, 2.2, 3.4], look: [2.4, 1.5, -3.0], fov: 56 } },
  { id: 'skills',     pos: [-0.4, 5.2, 4.4],    look: [0.7, 0.3, -3.6],   fov: 42, exposure: 0.8, dawn: 0.05, rain: 0.7,
    narrow: { pos: [1.2, 5.6, 5.0], look: [2.6, 0.2, -3.2], fov: 60 } },
  { id: 'experience', pos: [-3.8, 3.3, -7.1],   look: [-20, 9, -52],      fov: 44, exposure: 0.72, dawn: 0.14, rain: 0.55,
    narrow: { pos: [-3.8, 3.3, -7.1], look: [-19, 10, -52], fov: 62 } },
  { id: 'work',       pos: [-20, -1.5, -72],    look: [-20, -3.5, -160],    fov: 50, exposure: 0.76, dawn: 0.32, rain: 0.35,
    narrow: { pos: [-20, -1.5, -72], look: [-20, -3, -160], fov: 66 } },
  { id: 'contact',    pos: [-6, 34, -118],      look: [18, 34, -520],     fov: 46, exposure: 0.92, dawn: 0.86, rain: 0,
    narrow: { pos: [-6, 34, -118], look: [14, 36, -520], fov: 64 } },
];

const smooth = (x) => x * x * x * (x * (x * 6 - 15) + 10); // smootherstep: lingers at each shot

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.t = 0;
    this.target = 0;
    this.pointer = new THREE.Vector2();
    this.pointerDamped = new THREE.Vector2();
    this.anchors = [0];
    this.narrow = false;
    this.still = false;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.state = { exposure: 1, dawn: 0, rain: 1, shot: 0 };
    this.sections = [];
    this.build(false);
  }

  build(narrow) {
    this.narrow = narrow;
    const get = (s, key) => (narrow && s.narrow && s.narrow[key] ? s.narrow[key] : s[key]);
    const vec = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    this.posCurve = new THREE.CatmullRomCurve3(SHOTS.map((s) => vec(get(s, 'pos'))), false, 'centripetal');
    this.lookCurve = new THREE.CatmullRomCurve3(SHOTS.map((s) => vec(get(s, 'look'))), false, 'centripetal');
    this.fovs = SHOTS.map((s) => (narrow && s.narrow && s.narrow.fov) || s.fov);
  }

  /** Reads where each section sits. Each shot is fully reached when its section is centred on screen. */
  measure(vh) {
    const scrollTop = window.scrollY || 0;
    this.anchors = SHOTS.map((s, i) => {
      const el = document.querySelector(`[data-shot="${s.id}"]`);
      if (!el || i === 0) return 0;
      const r = el.getBoundingClientRect();
      const top = r.top + scrollTop;
      return Math.max(0, top + Math.min(r.height / 2, vh * 0.9) - vh / 2);
    });
    const maxScroll = Math.max(0, document.documentElement.scrollHeight - vh);
    this.anchors = this.anchors.map((a) => Math.min(a, maxScroll));
    // the last section may be too short to centre: make sure anchors still increase
    for (let i = 1; i < this.anchors.length; i++) {
      if (this.anchors[i] <= this.anchors[i - 1]) this.anchors[i] = this.anchors[i - 1] + 1;
    }
  }

  setScroll(y) {
    const a = this.anchors;
    const n = a.length - 1;
    let shot = n;
    if (y <= a[0]) shot = 0;
    else if (y < a[n]) {
      for (let i = 0; i < n; i++) {
        if (y < a[i + 1]) { shot = i + smooth((y - a[i]) / (a[i + 1] - a[i])); break; }
      }
    }
    // holding still: the camera never travels, it cuts to the nearest shot
    this.target = this.still ? Math.round(shot) : shot;
  }

  setPointer(x, y) { if (!this.still) this.pointer.set(x, y); }

  /** Reduced motion: no camera travel and no pointer parallax. */
  setStill(on) {
    this.still = on;
    if (on) { this.pointer.set(0, 0); this.pointerDamped.set(0, 0); }
  }

  /** Jump without damping, used when the page loads part-way down. */
  snap() { this.t = this.target; }

  update(dt, time) {
    const n = SHOTS.length - 1;
    if (this.still) this.t = this.target;
    else this.t += (this.target - this.t) * (1 - Math.exp(-dt * 3.4));
    this.pointerDamped.lerp(this.pointer, 1 - Math.exp(-dt * 2.6));

    const u = Math.min(this.t / n, 1);
    this.posCurve.getPoint(u, this.pos);
    this.lookCurve.getPoint(u, this.look);

    const i = Math.min(Math.floor(this.t), n - 1);
    const f = this.t - i;
    const lerp = (key) => SHOTS[i][key] + (SHOTS[i + 1][key] - SHOTS[i][key]) * f;

    // parallax is strongest on the rooftop and fades as the camera travels away
    const sway = THREE.MathUtils.clamp(1.15 - this.t * 0.2, 0.45, 1);
    const px = this.pointerDamped.x * 0.34 * sway + Math.sin(time * 0.19) * 0.035;
    const py = this.pointerDamped.y * 0.17 * sway + Math.sin(time * 0.27) * 0.022;

    const heroWeight = THREE.MathUtils.clamp(1 - this.t, 0, 1);
    const slide = this.narrow ? 0 : THREE.MathUtils.clamp(1.78 - this.camera.aspect, 0, 0.85) * 1.8 * heroWeight;

    const cam = this.camera;
    cam.position.set(this.pos.x + px + slide, this.pos.y + py, this.pos.z);
    cam.lookAt(this.look.x + px * 2.2 + slide, this.look.y + py * 1.4, this.look.z);

    const fov = this.fovs[i] + (this.fovs[i + 1] - this.fovs[i]) * f;
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }

    this.state.exposure = lerp('exposure');
    this.state.dawn = lerp('dawn');
    this.state.rain = lerp('rain');
    this.state.shot = this.t;
    return this.state;
  }
}
