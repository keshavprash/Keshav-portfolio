/* 3D scene initialisation: builds the renderer and world, then wires them to the loop and camera rig. */
import * as THREE from '../vendor/three.custom.min.js';
import { Post } from './post.js';
import { Loop } from './loop.js';
import { CameraRig } from './camera-rig.js';
import { disposeTree } from './dispose.js';
import { buildSky } from './world/sky.js';
import { buildCity, buildMist } from './world/city.js';
import { buildSigns } from './world/signs.js';
import { buildRooftop } from './world/rooftop.js';
import { buildWorkstation } from './world/workstation.js';
import { buildCharacter } from './world/character.js';
import { buildRain, buildMotes } from './world/weather.js';

const NARROW_ASPECT = 0.95;

/* Yields to the browser so input and painting can run during long set-up work. */
const pause = () => (globalThis.scheduler && scheduler.yield ? scheduler.yield() : new Promise((r) => setTimeout(r)));

export async function createScene({ canvas, context, quality, assets, onContextChange, transparent }) {
  const q = { ...quality };
  const locked = new URLSearchParams(location.search).has('lockquality');

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    antialias: !q.hdr,          // the HDR path handles anti-aliasing itself
    alpha: !!transparent,
    preserveDrawingBuffer: !!transparent,
    stencil: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.setClearColor(0x03040c, 1);

  let dpr = Math.min(window.devicePixelRatio || 1, q.maxDpr);
  renderer.setPixelRatio(dpr);

  const scene = new THREE.Scene();
  scene.fog = null;
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 2600);

  const tracked = new Set();
  const ctx = {
    quality: q,
    assets,
    reflectionsEnabled: !!q.reflect,
    hideInReflection: [],
    uniforms: {
      uTime: { value: 0 }, uDawn: { value: 0 }, uRain: { value: 1 },
      uCam: { value: new THREE.Vector3() }, uPointScale: { value: 1 },
    },
    pause,
    track(t) { tracked.add(t); return t; },
    texture(canvasEl, srgb = true) {
      const t = new THREE.CanvasTexture(canvasEl);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      tracked.add(t);
      return t;
    },
  };

  // Canvas signs use the display fonts: wait briefly, but never let fonts hold up the scene.
  if (document.fonts && document.fonts.load) {
    await Promise.race([
      Promise.all([document.fonts.load('800 60px "Archivo Expanded"'), document.fonts.load('500 30px "JetBrains Mono"')]),
      new Promise((r) => setTimeout(r, 1200)),
    ]).catch(() => {});
  }

  // built one step at a time, handing the main thread back in between, so scrolling and clicks stay responsive
  const builders = [buildSky, buildCity, q.mist ? buildMist : null, buildSigns, buildRooftop, buildWorkstation, buildCharacter, buildRain, buildMotes];
  const parts = [];
  for (const build of builders) {
    if (!build) continue;
    const part = await build(ctx);
    if (part) { parts.push(part); scene.add(part.object); }
    await pause();
  }

  const rig = new CameraRig(camera);
  const post = q.hdr ? new Post(renderer, q) : null;

  let width = 0, height = 0, heightMax = 0;

  const frame = { time: 0, exposure: 1, dawn: 0, rain: 1, shot: 0 };
  const frameFromRig = (s) => {
    frame.exposure = s.exposure;
    frame.dawn = s.dawn;
    frame.rain = s.rain;
    frame.shot = s.shot;
    ctx.uniforms.uDawn.value = s.dawn;
    ctx.uniforms.uRain.value = s.rain;
    ctx.uniforms.uCam.value.copy(camera.position);
  };

  const applySize = (force) => {
    const w = window.innerWidth;
    let h = window.innerHeight;
    // Mobile URL bars change the height constantly while scrolling. Keep the tallest height for a given width.
    if (w !== width) heightMax = 0;
    heightMax = Math.max(heightMax, h);
    if (matchMedia('(pointer: coarse)').matches) h = heightMax;
    if (!force && w === width && h === height) return;
    width = w; height = h;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const narrow = camera.aspect < NARROW_ASPECT;
    if (narrow !== rig.narrow) rig.build(narrow);
    camera.updateProjectionMatrix();
    if (post) {
      const size = renderer.getDrawingBufferSize(new THREE.Vector2());
      post.setSize(size.x, size.y);
    }
    ctx.uniforms.uPointScale.value = (height / 900) * dpr;
    rig.measure(window.innerHeight);
    rig.setScroll(window.scrollY || 0);
  };

  applySize(true);
  rig.snap();

  const firstCamera = rig.update(0.016, 0);
  frameFromRig(firstCamera);

  // Shaders are compiled for the target they will really draw to (a different program from drawing to the screen).
  // The browser compiles them in parallel, so the first frame does not stall the page.
  try {
    renderer.setRenderTarget(post ? post.hdr : null);
    await renderer.compileAsync(scene, camera);
    renderer.setRenderTarget(null);
    if (post) await post.warmUp();
  } catch (e) { renderer.setRenderTarget(null); /* the first render compiles instead */ }

  // Texture uploads block, so they go one per step
  for (const t of tracked) { renderer.initTexture(t); await pause(); }


  const update = (dt) => {
    frame.time += dt;
    ctx.uniforms.uTime.value = frame.time;
    frameFromRig(rig.update(dt, frame.time));
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].update) parts[i].update(dt, frame.time, frame, camera);
    }
  };

  const render = () => {
    if (post) post.render(scene, camera, frame);
    else {
      renderer.toneMappingExposure = 1.1 * frame.exposure;
      renderer.render(scene, camera);
    }
  };

  /* Governor steps, in the order they cost the least visual quality. */
  const degradeSteps = [
    () => { if (dpr > 1) { dpr = Math.max(1, dpr - 0.25); applySize(true); return `dpr ${dpr}`; } return null; },
    () => { if (ctx.reflectionsEnabled && ctx.reflector) { ctx.reflector.visible = true; ctx.reflectionsEnabled = false; return 'reflections frozen'; } return null; },
    () => { if (post && post.bloomEnabled) { post.setBloom(false); return 'bloom off'; } return null; },
    () => { if (dpr > 0.75) { dpr = 0.75; applySize(true); return `dpr ${dpr}`; } return null; },
  ];

  const loop = new Loop({
    update,
    render,
    onDegrade(fps) {
      if (locked) return;
      for (const step of degradeSteps) {
        const result = step();
        if (result) { api.log.push(`${Math.round(fps)}fps -> ${result}`); return; }
      }
      if (api.onTooSlow) api.onTooSlow(fps);
    },
  });

  const onContextLost = (e) => {
    e.preventDefault();
    loop.stop();
    if (onContextChange) onContextChange('lost');
  };
  const onContextRestored = () => {
    if (onContextChange) onContextChange('restored');
    loop.start();
  };
  canvas.addEventListener('webglcontextlost', onContextLost);
  canvas.addEventListener('webglcontextrestored', onContextRestored);

  const api = {
    tier: q.tier,
    log: [],
    onTooSlow: null,
    rig,
    loop,
    scene,
    camera,
    ctx,
    parts,
    renderer,
    frame,
    start() { loop.start(); },
    stop() { loop.stop(); },
    resize() { applySize(false); },
    remeasure() { rig.measure(window.innerHeight); rig.setScroll(window.scrollY || 0); },
    setScroll(y) { rig.setScroll(y); },
    setPointer(x, y) { rig.setPointer(x, y); },
    setLowPower(on) { loop.setLowPower(on); },
    /** Draws one frame immediately (first paint, and tests). */
    renderNow() { update(0.016); render(); },
    stats() {
      return { tier: q.tier, fps: Math.round(loop.fps), running: loop.running, frames: loop.renderedFrames, dpr, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, log: api.log.slice() };
    },
    /** Frees all GPU resources and the WebGL context. */
    dispose() {
      loop.dispose();
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      const released = disposeTree(scene);
      tracked.forEach((t) => t.dispose());
      if (ctx.reflector) ctx.reflector.dispose();
      if (post) post.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      return released;
    },
  };
  return api;
}
