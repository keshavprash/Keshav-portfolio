/* ==========================================================================
   Keshav Prashar — Portfolio runtime
   Vanilla JS, zero dependencies. Honours prefers-reduced-motion throughout.
   ========================================================================== */
(function () {
  'use strict';

  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var reduce   = mqReduce.matches;
  mqReduce.addEventListener('change', function (e) { reduce = e.matches; });

  var mqCoarse = window.matchMedia('(hover: none), (pointer: coarse)');

  /* ---------- 1. Loader ---------- */
  function loader() {
    var el = $('#loader');
    if (!el) return;
    var hide = function () {
      el.classList.add('done');
      window.setTimeout(function () { el.setAttribute('hidden', ''); }, 700);
    };
    if (document.readyState === 'complete') window.setTimeout(hide, 280);
    else window.addEventListener('load', function () { window.setTimeout(hide, 280); });
    // safety net: never trap the page behind the loader
    window.setTimeout(hide, 4000);
  }

  /* ---------- 2. Year ---------- */
  function year() {
    var y = $('#year');
    if (y) y.textContent = String(new Date().getFullYear());
  }

  /* ---------- 3. Navigation ---------- */
  function nav() {
    var bar    = $('#nav');
    var list   = $('#navlist');
    var toggle = $('#navtoggle');
    if (!bar) return;

    var close = function () {
      if (!list || !toggle) return;
      list.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.removeProperty('overflow');
    };

    if (toggle && list) {
      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        list.classList.toggle('open', !open);
        document.body.style.overflow = !open ? 'hidden' : '';
      });
      list.addEventListener('click', function (e) {
        if (e.target.closest('a')) close();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { close(); toggle.focus(); }
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 980) close();
      });
    }

    // sticky state + progress bar
    var prog = $('#progress');
    var tick = false;
    var onScroll = function () {
      if (tick) return;
      tick = true;
      window.requestAnimationFrame(function () {
        var y = window.scrollY || window.pageYOffset;
        bar.classList.toggle('is-stuck', y > 40);
        if (prog) {
          var h = document.documentElement.scrollHeight - window.innerHeight;
          prog.style.transform = 'scaleX(' + (h > 0 ? Math.min(y / h, 1) : 0) + ')';
        }
        var top = $('#totop');
        if (top) top.classList.toggle('show', y > 600);
        tick = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    // smooth scroll honouring the fixed header + reduced motion
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id === '#') return;
        var t = document.getElementById(id.slice(1));
        if (!t) return;
        e.preventDefault();
        var offset = bar.offsetHeight + 12;
        var top = t.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: top, behavior: reduce ? 'auto' : 'smooth' });
        if (history.replaceState) history.replaceState(null, '', id);
      });
    });

    // scrollspy
    var links = $$('.nav__link');
    var map = {};
    links.forEach(function (l) {
      var h = l.getAttribute('href');
      if (h && h.charAt(0) === '#') map[h.slice(1)] = l;
    });
    var sections = Object.keys(map).map(function (id) { return document.getElementById(id); }).filter(Boolean);
    if (!sections.length || !('IntersectionObserver' in window)) return;

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('is-active'); l.removeAttribute('aria-current'); });
        var active = map[en.target.id];
        if (active) { active.classList.add('is-active'); active.setAttribute('aria-current', 'true'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ---------- 4. Reveal on scroll ---------- */
  function reveals() {
    var items = $$('.rv');
    if (!items.length) return;
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (i) { i.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    items.forEach(function (i) { io.observe(i); });
  }

  /* ---------- 5. Typed role line ---------- */
  function typed() {
    var el = $('#typed');
    if (!el) return;
    var words, i = 0, pos = 0, deleting = false;
    try { words = JSON.parse(el.getAttribute('data-words') || '[]'); } catch (e) { words = []; }
    if (!words.length) return;

    if (reduce) { el.textContent = words[0]; return; }

    var step = function () {
      var w = words[i];
      pos += deleting ? -1 : 1;
      el.textContent = w.slice(0, pos);
      var wait = deleting ? 42 : 78;
      if (!deleting && pos === w.length) { deleting = true; wait = 1700; }
      else if (deleting && pos === 0) { deleting = false; i = (i + 1) % words.length; wait = 320; }
      window.setTimeout(step, wait);
    };
    window.setTimeout(step, 700);
  }

  /* ---------- 6. Hero parallax (scroll + pointer) ---------- */
  function parallax() {
    var hero   = $('#home');
    var layers = $$('[data-depth]');
    if (!hero || !layers.length || reduce) return;

    var mx = 0, my = 0, tx = 0, ty = 0, sy = 0, raf = null, visible = true;

    if (!mqCoarse.matches) {
      window.addEventListener('pointermove', function (e) {
        tx = (e.clientX / window.innerWidth  - 0.5) * 2;
        ty = (e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });
    }
    window.addEventListener('scroll', function () { sy = window.scrollY || 0; }, { passive: true });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; }, { threshold: 0 }).observe(hero);
    }

    var loop = function () {
      if (visible) {
        mx += (tx - mx) * 0.055;
        my += (ty - my) * 0.055;
        layers.forEach(function (l) {
          var d = parseFloat(l.getAttribute('data-depth')) || 0;
          var px = mx * d * 26;
          var py = my * d * 18 + sy * d * 0.17;
          l.style.transform = 'translate3d(' + px.toFixed(2) + 'px,' + py.toFixed(2) + 'px,0)';
        });
      }
      raf = window.requestAnimationFrame(loop);
    };
    loop();

    document.addEventListener('visibilitychange', function () {
      if (document.hidden && raf) { window.cancelAnimationFrame(raf); raf = null; }
      else if (!document.hidden && !raf) loop();
    });
  }

  /* ---------- 7. Drifting petals / light motes (canvas) ---------- */
  function petals() {
    var cv = $('#petals');
    var hero = $('#home');
    if (!cv || !hero || reduce) return;

    var ctx = cv.getContext('2d');
    if (!ctx) return;

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var W = 0, H = 0, bits = [], raf = null, visible = true;
    var COLORS = ['rgba(255,178,36,', 'rgba(94,234,212,', 'rgba(139,124,246,', 'rgba(255,122,138,'];

    var count = function () {
      var w = window.innerWidth;
      if (w < 480) return 14;
      if (w < 980) return 24;
      return 40;
    };

    var make = function () {
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: 1.1 + Math.random() * 3.4,
        vy: 0.14 + Math.random() * 0.46,
        vx: -0.22 + Math.random() * 0.44,
        a: 0.16 + Math.random() * 0.46,
        spin: Math.random() * Math.PI * 2,
        vs: (-0.5 + Math.random()) * 0.018,
        c: COLORS[(Math.random() * COLORS.length) | 0],
        petal: Math.random() > 0.42
      };
    };

    var resize = function () {
      var r = hero.getBoundingClientRect();
      W = Math.max(r.width, 1); H = Math.max(r.height, 1);
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      bits = [];
      for (var i = 0, n = count(); i < n; i++) bits.push(make());
    };

    var draw = function () {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < bits.length; i++) {
        var b = bits[i];
        b.y += b.vy; b.x += b.vx + Math.sin((b.y + b.spin * 40) / 90) * 0.26; b.spin += b.vs;
        if (b.y - 8 > H) { b.y = -10; b.x = Math.random() * W; }
        if (b.x < -14) b.x = W + 10; else if (b.x > W + 14) b.x = -10;

        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(b.spin);
        ctx.fillStyle = b.c + b.a + ')';
        if (b.petal) {
          // original soft petal shape — two mirrored quadratic curves
          ctx.beginPath();
          ctx.moveTo(0, -b.r * 1.5);
          ctx.quadraticCurveTo( b.r * 1.5, 0, 0, b.r * 1.5);
          ctx.quadraticCurveTo(-b.r * 1.5, 0, 0, -b.r * 1.5);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, b.r * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      raf = window.requestAnimationFrame(draw);
    };

    var start = function () { if (!raf && visible && !document.hidden) draw(); };
    var stop  = function () { if (raf) { window.cancelAnimationFrame(raf); raf = null; } };

    resize();
    start();

    var rt;
    window.addEventListener('resize', function () {
      window.clearTimeout(rt);
      rt = window.setTimeout(resize, 180);
    });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        visible = en[0].isIntersecting;
        visible ? start() : stop();
      }, { threshold: 0 }).observe(hero);
    }
  }

  /* ---------- 8. Tabs ---------- */
  function tabs() {
    var tabEls = $$('[role="tab"]');
    if (!tabEls.length) return;

    var select = function (tab, focus) {
      tabEls.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.setAttribute('tabindex', on ? '0' : '-1');
        var p = document.getElementById(t.getAttribute('aria-controls'));
        if (p) { if (on) p.removeAttribute('hidden'); else p.setAttribute('hidden', ''); }
      });
      if (focus) tab.focus();
    };

    tabEls.forEach(function (t, idx) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var k = e.key, next = -1;
        if (k === 'ArrowRight' || k === 'ArrowDown') next = (idx + 1) % tabEls.length;
        else if (k === 'ArrowLeft' || k === 'ArrowUp') next = (idx - 1 + tabEls.length) % tabEls.length;
        else if (k === 'Home') next = 0;
        else if (k === 'End') next = tabEls.length - 1;
        if (next < 0) return;
        e.preventDefault();
        select(tabEls[next], true);
      });
    });
  }

  /* ---------- 9. Project card pointer aura ---------- */
  function cardAura() {
    if (reduce || mqCoarse.matches) return;
    $$('.pcard').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top) + 'px');
      }, { passive: true });
    });
  }

  /* ---------- 10. Copy email — real clipboard, honest states ---------- */
  function copyEmail() {
    var btn = $('#copyEmail');
    var out = $('#copyStatus');
    var addr = $('#emailAddr');
    if (!btn || !out || !addr) return;

    var email = (btn.getAttribute('data-email') || addr.textContent || '').trim();
    var label = btn.querySelector('.mailbox__copy-label');
    var reset;

    var say = function (msg, kind) {
      out.textContent = msg;
      out.className = 'copy-status ' + (kind || '');
    };

    var legacy = function () {
      // execCommand fallback for browsers without async clipboard / insecure context
      var ta = document.createElement('textarea');
      ta.value = email;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, email.length);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      return ok;
    };

    var win = function () {
      btn.classList.add('is-done');
      if (label) label.textContent = 'Copied';
      say('Email copied successfully.', 'ok');
      window.clearTimeout(reset);
      reset = window.setTimeout(function () {
        btn.classList.remove('is-done');
        if (label) label.textContent = 'Copy email';
        say('', '');
      }, 3200);
    };

    var fail = function () {
      // NEVER claim success we did not achieve. Select the text so the visitor can copy manually.
      say('Copy blocked by your browser — the address is selected, press Ctrl/Cmd + C.', 'warn');
      try {
        var range = document.createRange();
        range.selectNodeContents(addr);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (e) {
        say('Copy blocked by your browser — please select the address above and copy it manually.', 'warn');
      }
    };

    btn.addEventListener('click', function () {
      if (!email) { fail(); return; }
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(email).then(win).catch(function () {
          legacy() ? win() : fail();
        });
      } else {
        legacy() ? win() : fail();
      }
    });
  }

  /* ---------- 11. Back to top ---------- */
  function toTop() {
    var btn = $('#totop');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    loader(); year(); nav(); reveals(); typed();
    parallax(); petals(); tabs(); cardAura(); copyEmail(); toTop();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
