/* Orchestrates the stage: picks 2D or 3D, lazy-loads Three.js only when it will be used, crossfades,
   feeds in scroll and pointer, and falls back to the 2D scene whenever 3D cannot continue. */
import { detectTier, QUALITY } from './capability.js';
import { startParallax, startRain2D, stopRain2D } from '../fallback/parallax-2d.js';

const assets = {
  character: 'images/art/character-figure.webp',
  characterWind: 'images/art/character-wind.webp',
};

/* Reduced motion means the scene holds still, not that it disappears. This includes Windows' "Animation effects"
   switch, which is also turned off by the "Adjust for best performance" setting. An explicit choice made with the
   Play/Pause button wins, and is remembered. */
const MOTION_KEY = 'kp-scene-motion';
const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
const readChoice = () => { try { return localStorage.getItem(MOTION_KEY); } catch (e) { return null; } };
const writeChoice = (value) => {
  try { if (value) localStorage.setItem(MOTION_KEY, value); else localStorage.removeItem(MOTION_KEY); } catch (e) { /* private mode */ }
};
const shouldHoldStill = () => {
  const choice = readChoice();
  if (choice === 'play') return false;
  if (choice === 'pause') return true;
  return reduceQuery.matches;
};

export async function bootStage() {
  const root = document.documentElement;
  const canvas = document.getElementById('scene3d');

  root.dataset.stage = 'pending';
  const status = { requested: null, stage: 'pending', instance: null, error: null };
  window.__stage = status; // read-only diagnostics for testing

  startParallax();

  const use2D = (reason) => {
    status.stage = '2d';
    status.reason = reason;
    root.dataset.stage = '2d';
    const toggle = document.getElementById('sceneToggle');
    if (toggle) toggle.hidden = true;
    startRain2D();
  };

  const cap = await detectTier();
  status.requested = cap;
  root.dataset.tier = cap.tier;

  if (cap.tier === '2d' || !canvas) { use2D(cap.reason); return; }

  const load = async () => {
    try {
      // The worker's answer is not proof the page itself may use WebGL (browser policy can differ).
      // Creating the real context first means a refusal costs nothing: Three.js is never downloaded.
      const quality = QUALITY[cap.tier];
      const context = canvas.getContext('webgl2', {
        alpha: false, depth: true, stencil: false, antialias: !quality.hdr,
        premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance',
      });
      if (!context) { use2D('webgl-context-refused'); return; }

      const { createScene } = await import('./scene.js');
      const instance = await createScene({
        canvas,
        context,
        quality,
        assets,
        onContextChange(state) {
          if (state === 'lost') use2D('context-lost');
          else {
            stopRain2D();
            status.stage = '3d';
            root.dataset.stage = '3d';
            const toggle = document.getElementById('sceneToggle');
            if (toggle) toggle.hidden = false;
          }
        },
      });
      status.instance = instance;
      wire(instance, () => use2D('too-slow'));
      instance.renderNow();
      instance.setStill(shouldHoldStill());
      syncToggle(instance);
      // let the first frame reach the screen before fading it in
      requestAnimationFrame(() => {
        status.stage = '3d';
        root.dataset.stage = '3d';
      });
    } catch (err) {
      status.error = String(err && err.message ? err.message : err);
      console.warn('3D scene unavailable, using the 2D scene.', err);
      use2D('init-failed');
    }
  };

  // Content first: 3D starts once the page has loaded and the main thread is free.
  const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1400 }) : setTimeout(fn, 300));
  if (document.readyState === 'complete') idle(load);
  else window.addEventListener('load', () => idle(load), { once: true });
}

function syncToggle(instance) {
  const toggle = document.getElementById('sceneToggle');
  if (!toggle) return;
  const still = instance.isStill();
  toggle.hidden = false;
  toggle.dataset.state = still ? 'paused' : 'playing';
  toggle.querySelector('span').textContent = still ? 'Play scene' : 'Pause scene';
}

function wire(instance, fallBack) {
  const hero = document.getElementById('home');
  let idleTimer = 0;
  let scrollQueued = false;

  const onScrollFrame = () => {
    scrollQueued = false;
    const y = window.scrollY || 0;
    instance.setScroll(y);
    const pastHero = hero ? y > hero.offsetHeight : y > window.innerHeight;
    instance.setLowPower(false);
    clearTimeout(idleTimer);
    // reading below the hero: nothing moves quickly, so half the frame rate looks the same and saves battery
    if (pastHero) idleTimer = setTimeout(() => instance.setLowPower(true), 1400);
  };
  const onScroll = () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScrollFrame); } };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScrollFrame();

  const onPointer = (e) => instance.setPointer((e.clientX / window.innerWidth - 0.5) * 2, -(e.clientY / window.innerHeight - 0.5) * 2);
  if (!matchMedia('(pointer: coarse)').matches) window.addEventListener('pointermove', onPointer, { passive: true });

  let resizeTimer = 0;
  const onResize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => instance.resize(), 120); };
  window.addEventListener('resize', onResize, { passive: true });

  // section heights change as images and fonts load
  let measureTimer = 0;
  const remeasure = () => { clearTimeout(measureTimer); measureTimer = setTimeout(() => instance.remeasure(), 160); };
  const main = document.getElementById('main');
  let ro = null;
  if (main && 'ResizeObserver' in window) { ro = new ResizeObserver(remeasure); ro.observe(main); }

  const toggle = document.getElementById('sceneToggle');
  const onToggle = () => {
    const play = instance.isStill();
    writeChoice(play ? 'play' : 'pause');
    instance.setStill(!play);
    syncToggle(instance);
  };
  if (toggle) toggle.addEventListener('click', onToggle);

  // the most recent signal wins: turning reduced motion on or off mid-visit overrides an earlier button choice
  const onReduceChange = (e) => {
    writeChoice(null);
    instance.setStill(e.matches);
    syncToggle(instance);
  };
  reduceQuery.addEventListener('change', onReduceChange);

  const unload = () => {
    if (toggle) { toggle.removeEventListener('click', onToggle); toggle.hidden = true; }
    reduceQuery.removeEventListener('change', onReduceChange);
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('resize', onResize);
    if (ro) ro.disconnect();
    clearTimeout(idleTimer);
    const released = instance.dispose();
    const status = window.__stage;
    status.instance = null;
    status.released = released;
    return released;
  };
  window.__stage.unload = unload;

  // 3D that cannot hold its frame rate even at the lowest settings gives way to the 2D scene
  instance.onTooSlow = () => { unload(); fallBack(); };
}
