/* Decides how much 3D this device should run. Imports nothing heavy: this runs
   before Three.js is downloaded, so a device that will use the 2D scene never pays for it.

   Tiers
     high    desktop with a dedicated GPU: reflections, MSAA, full bloom
     medium  integrated GPUs and capable phones: reduced resolution and effects
     low     weak phones: no post-processing, no reflections, minimal rain
     2d      no WebGL2, software rendering or data saver: original 2D scene

   Reduced motion does not choose a tier. It decides whether the scene moves, see stage.js.

   ?quality=high|medium|low|2d overrides detection (useful for testing a specific path). */

export const QUALITY = {
  high: {
    tier: 'high', maxDpr: 1.75, hdr: true, samples: 4, bloomLevels: 5,
    reflect: { width: 800, height: 450 }, rain: 2200, buildings: 560, cloudOctaves: 4, mist: true, motes: 170, ripples: true,
  },
  medium: {
    tier: 'medium', maxDpr: 1.25, hdr: true, samples: 0, bloomLevels: 4,
    reflect: { width: 480, height: 270 }, rain: 900, buildings: 340, cloudOctaves: 3, mist: true, motes: 80, ripples: true,
  },
  low: {
    tier: 'low', maxDpr: 1, hdr: false, samples: 0, bloomLevels: 0,
    reflect: null, rain: 320, buildings: 170, cloudOctaves: 3, mist: false, motes: 0, ripples: false,
  },
};

/* Fast path: asks a worker, so the main thread never blocks on context creation. */
function probeInWorker() {
  return new Promise((resolve) => {
    if (!('Worker' in window) || !('OffscreenCanvas' in window)) { resolve(null); return; }
    let worker;
    const done = (value) => { clearTimeout(timer); if (worker) worker.terminate(); resolve(value); };
    const timer = setTimeout(() => done(null), 2500);
    try {
      worker = new Worker(new URL('./gpu-probe.worker.js', import.meta.url));
      worker.onmessage = (e) => done(e.data);
      worker.onerror = () => done(null);
      worker.postMessage(0);
    } catch (e) { done(null); }
  });
}

function probeOnMainThread() {
  const canvas = document.createElement('canvas');
  // failIfMajorPerformanceCaveat refuses software rasterisers, which could not hold a usable frame rate.
  const gl = canvas.getContext('webgl2', { failIfMajorPerformanceCaveat: true, powerPreference: 'high-performance' });
  if (!gl) return null;
  const info = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = String((info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) || gl.getParameter(gl.RENDERER) || '');
  const canHalfFloat = !!(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'));
  const lose = gl.getExtension('WEBGL_lose_context');
  if (lose) lose.loseContext();
  return { renderer, canHalfFloat };
}

export async function detectTier() {
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced === '2d') return { tier: '2d', reason: 'requested' };

  if (!forced) {
    const conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ''))) return { tier: '2d', reason: 'data-saver' };
  }

  let gpu = null;
  const fromWorker = await probeInWorker();
  if (fromWorker && fromWorker.hardware) gpu = fromWorker;
  else if (fromWorker && fromWorker.offscreen) return { tier: '2d', reason: 'software-rendering' };
  else { try { gpu = probeOnMainThread(); } catch (e) { gpu = null; } }
  if (!gpu) return { tier: '2d', reason: 'no-webgl2-or-software-rendering' };
  if (/swiftshader|llvmpipe|softpipe|basic render|software/i.test(gpu.renderer)) return { tier: '2d', reason: 'software-rendering', renderer: gpu.renderer };

  if (forced && QUALITY[forced]) return { tier: forced, reason: 'requested', renderer: gpu.renderer };

  const coarse = matchMedia('(pointer: coarse)').matches;
  const phoneSized = Math.min(screen.width, screen.height) < 820;
  const memory = navigator.deviceMemory || 8;
  const cores = navigator.hardwareConcurrency || 4;

  let tier;
  if (!gpu.canHalfFloat) tier = 'low';
  else if (coarse && phoneSized) tier = memory <= 3 || cores <= 4 ? 'low' : 'medium';
  else if (memory <= 2 || cores <= 2) tier = 'low';
  else if (/intel|uhd|iris|radeon\(tm\)|vega|mali|adreno|powervr|apple gpu/i.test(gpu.renderer)) tier = 'medium';
  else tier = 'high';

  return { tier, reason: 'detected', renderer: gpu.renderer };
}
