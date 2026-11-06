/* Scroll interactions shared by both stages: section reveals, the progress bar, the experience timeline
   and the dimming that keeps text readable over the scene. */

export function initScrollStory() {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const progress = document.getElementById('progress');
  const timeline = document.getElementById('timeline');
  const hero = document.getElementById('home');

  // reveals
  const items = [...document.querySelectorAll('.rv')];
  if (!reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -7% 0px', threshold: 0.06 });
    items.forEach((el) => io.observe(el));
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  // everything else is measured once per frame at most, and only when scrolling
  let queued = false;
  const measure = () => {
    queued = false;
    const y = window.scrollY || 0;
    const vh = window.innerHeight;
    const max = root.scrollHeight - vh;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? Math.min(y / max, 1) : 0})`;

    const nav = document.getElementById('nav');
    if (nav) nav.classList.toggle('is-stuck', y > 40);

    const heroH = hero ? hero.offsetHeight : vh;
    root.classList.toggle('is-past-hero', y > heroH * 0.62);
    // in the 2D scene nothing dims the backdrop for us: darken it as the visitor moves on to read
    root.style.setProperty('--shade', root.dataset.stage === '2d' ? (Math.min(y / heroH, 1) * 0.5).toFixed(3) : '0');

    if (timeline && !reduce) {
      const r = timeline.getBoundingClientRect();
      const fill = Math.min(Math.max((vh * 0.72 - r.top) / Math.max(r.height, 1), 0), 1);
      timeline.style.setProperty('--fill', fill.toFixed(3));
    }
  };
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(measure); } };
  window.addEventListener('scroll', queue, { passive: true });
  window.addEventListener('resize', queue, { passive: true });
  queue();
}
