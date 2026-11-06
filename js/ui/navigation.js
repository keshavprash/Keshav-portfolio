/* Header state, mobile menu (keyboard and focus safe) and scrollspy. Smooth scrolling itself is CSS. */

export function initNavigation() {
  const nav = document.getElementById('nav');
  const list = document.getElementById('navList');
  const toggle = document.getElementById('navToggle');
  const main = document.getElementById('main');
  if (!nav || !list || !toggle) return;

  const isMobile = () => matchMedia('(max-width: 860px)').matches;

  const setOpen = (open, returnFocus) => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    list.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    if (main) main.inert = open;
    if (open) { const first = list.querySelector('a'); if (first) first.focus(); }
    else if (returnFocus) toggle.focus();
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true', true));
  list.addEventListener('click', (e) => { if (e.target.closest('a')) setOpen(false, false); });

  document.addEventListener('keydown', (e) => {
    const open = toggle.getAttribute('aria-expanded') === 'true';
    if (!open) return;
    if (e.key === 'Escape') { setOpen(false, true); return; }
    if (e.key === 'Tab') {
      // keep Tab inside the open menu: toggle button + links
      const items = [toggle, ...list.querySelectorAll('a')];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  window.addEventListener('resize', () => { if (!isMobile() && list.classList.contains('is-open')) setOpen(false, false); }, { passive: true });

  // scrollspy
  const links = [...list.querySelectorAll('a[href^="#"]')];
  const map = new Map(links.map((l) => [l.getAttribute('href').slice(1), l]));
  const sections = [...map.keys()].map((id) => document.getElementById(id)).filter(Boolean);
  const hero = document.getElementById('home');
  if (hero) sections.push(hero);

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        links.forEach((l) => l.removeAttribute('aria-current'));
        const active = map.get(en.target.id);
        if (active) active.setAttribute('aria-current', 'true');
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach((s) => spy.observe(s));
  }
}
