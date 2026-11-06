/* The 2D experience: layered parallax and canvas rain. Parallax also moves the foreground silhouette
   in 3D mode, tying the painted layer to the 3D camera. Everything is off under reduced motion. */

const reduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function startParallax() {
  const hero = document.getElementById('home');
  const layers = [...document.querySelectorAll('.stage [data-depth]')].map((el) => ({ el, depth: parseFloat(el.dataset.depth) || 0 }));
  if (!hero || !layers.length || reduce()) return;

  let tx = 0, ty = 0, mx = 0, my = 0, raf = 0, heroVisible = true;
  const coarse = matchMedia('(pointer: coarse)').matches;

  if (!coarse) {
    window.addEventListener('pointermove', (e) => {
      tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ty = (e.clientY / window.innerHeight - 0.5) * 2;
      wake();
    }, { passive: true });
  }
  window.addEventListener('scroll', () => wake(), { passive: true });

  const frame = () => {
    raf = 0;
    if (document.hidden || !heroVisible) return;
    mx += (tx - mx) * 0.06;
    my += (ty - my) * 0.06;
    const sy = window.scrollY || 0;
    for (let i = 0; i < layers.length; i++) {
      const { el, depth } = layers[i];
      const x = -mx * depth * 34;
      const y = -my * depth * 20 - sy * depth * 0.16;
      el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
    }
    // stop once the motion has settled: no idle animation loop
    if (Math.abs(tx - mx) > 0.002 || Math.abs(ty - my) > 0.002) wake();
  };
  const wake = () => { if (!raf) raf = requestAnimationFrame(frame); };

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((en) => { heroVisible = en[0].isIntersecting; if (heroVisible) wake(); }).observe(hero);
  }
  wake();
}

/* Lightweight rain for the 2D scene. Runs at 30 fps and only while the hero is on screen. */
let rain = null;

export function startRain2D() {
  if (rain || reduce()) return;
  const canvas = document.getElementById('rain2d');
  const hero = document.getElementById('home');
  if (!canvas || !hero) return;
  const g = canvas.getContext('2d');
  if (!g) return;

  let w = 0, h = 0, drops = [], raf = 0, visible = true, last = 0;

  const size = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(Math.round((w * h) / 12000), 140);
    drops = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      l: 10 + Math.random() * 18, v: 9 + Math.random() * 9, a: 0.1 + Math.random() * 0.22,
    }));
  };

  const draw = (now) => {
    raf = 0;
    if (document.hidden || !visible) return;
    raf = requestAnimationFrame(draw);
    if (now - last < 33) return;
    last = now;
    g.clearRect(0, 0, w, h);
    g.lineWidth = 1;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      d.y += d.v; d.x -= d.v * 0.17;
      if (d.y > h + 20) { d.y = -20; d.x = Math.random() * (w + 80); }
      if (d.x < -20) d.x = w + 10;
      g.strokeStyle = `rgba(165, 200, 255, ${d.a})`;
      g.beginPath();
      g.moveTo(d.x, d.y);
      g.lineTo(d.x + d.l * 0.17, d.y - d.l);
      g.stroke();
    }
  };
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(draw); };

  const onResize = () => size();
  const onVisibility = () => start();
  size();
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibility);
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((en) => { visible = en[0].isIntersecting; start(); }) : null;
  if (io) io.observe(hero);
  start();

  rain = {
    stop() {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (io) io.disconnect();
      g.clearRect(0, 0, w, h);
    },
  };
}

export function stopRain2D() {
  if (rain) { rain.stop(); rain = null; }
}
