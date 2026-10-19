/* ==========================================================================
   Shared motion + interaction layer (every page).
   GSAP 3.15 (ScrollTrigger, SplitText, ScrambleText, Flip, DrawSVG) + Lenis 1.3.
   All motion lives inside gsap.matchMedia() so reduced-motion users get a
   calm, complete page rather than a broken one.
   ========================================================================== */
(() => {
  const root = document.documentElement;
  const MOTION_KEY = 'dn-motion';
  const storage = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
    sget(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    sset(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode */ } },
  };

  // User override for motion (footer toggle) on top of the OS setting.
  if (storage.get(MOTION_KEY) === 'off') root.classList.add('reduce-motion');
  const osReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionOK = () => !osReduce.matches && !root.classList.contains('reduce-motion');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const hasGSAP = typeof window.gsap !== 'undefined';
  if (!hasGSAP) { root.classList.remove('is-loading'); return; }

  const plugins = [window.ScrollTrigger, window.SplitText, window.ScrambleTextPlugin, window.Flip, window.DrawSVGPlugin, window.CustomEase].filter(Boolean);
  gsap.registerPlugin(...plugins);
  gsap.defaults({ ease: 'expo.out', duration: 1 });
  if (window.CustomEase) CustomEase.create('dn', '0.16, 1, 0.3, 1');
  ScrollTrigger.config({ ignoreMobileResize: true });

  const DN = (window.DN = window.DN || {});
  DN.motionOK = motionOK;
  DN.finePointer = finePointer;

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  function startLenis() {
    if (lenis || !motionOK() || typeof window.Lenis === 'undefined') return;
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, anchors: { offset: -80 }, autoRaf: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(lenisTick);
    gsap.ticker.lagSmoothing(0);
    DN.lenis = lenis;
  }
  function lenisTick(t) { lenis && lenis.raf(t * 1000); }
  function stopLenis() {
    if (!lenis) return;
    gsap.ticker.remove(lenisTick);
    lenis.destroy(); lenis = null; DN.lenis = null;
  }

  /* ---------- Preloader (first visit per session, ≤ ~1.6 s) ---------- */
  function runPreloader() {
    const pre = document.querySelector('.preloader');
    const done = () => { root.classList.remove('is-loading'); document.dispatchEvent(new CustomEvent('dn:ready')); };
    if (!pre || storage.sget('dn-seen') || !motionOK()) { done(); return; }
    storage.sset('dn-seen', '1');
    const count = pre.querySelector('.preloader__count');
    const bar = pre.querySelector('.preloader__bar');
    const state = { v: 0 };
    const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
    const tl = gsap.timeline();
    tl.to(state, { v: 72, duration: 0.9, ease: 'power2.inOut', onUpdate: () => { count.textContent = String(Math.round(state.v)).padStart(2, '0'); bar.style.transform = `scaleX(${state.v / 100})`; } });
    Promise.race([fonts, new Promise(r => setTimeout(r, 1200))]).then(() => {
      tl.to(state, { v: 100, duration: 0.45, ease: 'power3.out', onUpdate: () => { count.textContent = String(Math.round(state.v)).padStart(2, '0'); bar.style.transform = `scaleX(${state.v / 100})`; } })
        .to(pre, { clipPath: 'inset(0 0 100% 0)', duration: 0.9, ease: 'expo.inOut', onStart: done })
        .set(pre, { display: 'none' });
    });
  }

  /* ---------- Header ---------- */
  function initHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    let last = 0;
    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate(self) {
        const y = self.scroll();
        header.classList.toggle('is-scrolled', y > 24);
        const down = y > last && y > 400;
        header.classList.toggle('is-hidden', down && !root.classList.contains('menu-open'));
        last = y;
      },
    });
    const btn = document.querySelector('.menu-btn');
    const menu = document.querySelector('.mobile-menu');
    if (btn && menu) {
      const set = open => {
        root.classList.toggle('menu-open', open);
        btn.setAttribute('aria-expanded', String(open));
        menu.setAttribute('aria-hidden', String(!open));
        if (open) { lenis && lenis.stop(); menu.querySelector('a')?.focus({ preventScroll: true }); }
        else { lenis && lenis.start(); }
      };
      btn.addEventListener('click', () => set(!root.classList.contains('menu-open')));
      menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => set(false)));
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('menu-open')) { set(false); btn.focus(); } });
    }
  }

  /* ---------- Nairobi clock ---------- */
  function initClock() {
    const els = document.querySelectorAll('[data-clock]');
    if (!els.length) return;
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Nairobi' });
    const tick = () => { const t = fmt.format(new Date()); els.forEach(el => (el.textContent = `NBO ${t} EAT`)); };
    tick(); setInterval(tick, 15000);
  }

  /* ---------- Cursor ---------- */
  function initCursor() {
    if (!finePointer) return;
    const cursor = document.querySelector('.cursor');
    if (!cursor) return;
    root.classList.add('has-cursor');
    const label = cursor.querySelector('.cursor__label');
    const xTo = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3' });
    const yTo = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3' });
    window.addEventListener('pointermove', e => { xTo(e.clientX); yTo(e.clientY); }, { passive: true });
    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor], a, button, input, textarea, select, summary');
      cursor.classList.remove('is-label', 'is-hover', 'is-hidden');
      if (!t) return;
      if (t.matches('input, textarea, select')) { cursor.classList.add('is-hidden'); return; }
      const text = t.getAttribute('data-cursor');
      if (text) { label.textContent = text; cursor.classList.add('is-label'); }
      else cursor.classList.add('is-hover');
    });
    document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('pointerenter', () => cursor.classList.remove('is-hidden'));
  }

  /* ---------- Magnetic elements ---------- */
  function initMagnetic() {
    if (!finePointer) return;
    document.querySelectorAll('[data-magnetic]').forEach(el => {
      const strength = parseFloat(el.dataset.magnetic) || 0.35;
      const inner = el.querySelector('.btn__label, [data-magnetic-inner]');
      const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      const ixTo = inner && gsap.quickTo(inner, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      const iyTo = inner && gsap.quickTo(inner, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
      el.addEventListener('pointermove', e => {
        if (!motionOK()) return;
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        xTo(dx * strength); yTo(dy * strength);
        if (inner) { ixTo(dx * strength * 0.5); iyTo(dy * strength * 0.5); }
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); if (inner) { ixTo(0); iyTo(0); } });
    });
  }

  /* ---------- Spotlight + tilt tiles ---------- */
  function initTiles() {
    if (!finePointer) return;
    document.querySelectorAll('[data-tilt]').forEach(el => {
      const max = parseFloat(el.dataset.tilt) || 6;
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.6, ease: 'power3' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.6, ease: 'power3' });
      gsap.set(el, { transformPerspective: 900 });
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${px * 100}%`); el.style.setProperty('--my', `${py * 100}%`);
        if (!motionOK()) return;
        ry((px - 0.5) * max * 2); rx(-(py - 0.5) * max * 2);
      });
      el.addEventListener('pointerleave', () => { rx(0); ry(0); });
    });
  }

  /* ---------- Scramble on hover ---------- */
  function initScramble() {
    if (!window.ScrambleTextPlugin) return;
    document.querySelectorAll('[data-scramble]').forEach(el => {
      const target = el.querySelector('[data-scramble-text]') || el;
      const original = target.textContent;
      el.addEventListener('pointerenter', () => {
        if (!motionOK()) return;
        gsap.to(target, { duration: 0.6, scrambleText: { text: original, chars: 'upperCase', speed: 0.6, revealDelay: 0.1 }, ease: 'none', overwrite: true });
      });
    });
  }

  /* ---------- Copy to clipboard ---------- */
  function initCopy() {
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const hint = btn.closest('.contact-card')?.querySelector('.contact-card__hint');
        try {
          await navigator.clipboard.writeText(btn.dataset.copy);
          if (hint) {
            if (window.ScrambleTextPlugin && motionOK()) gsap.to(hint, { duration: 0.6, scrambleText: { text: 'Copied to clipboard ✓', chars: '01', speed: 0.8 } });
            else hint.textContent = 'Copied to clipboard ✓';
            setTimeout(() => { hint.textContent = hint.dataset.idle || ''; }, 2400);
          }
        } catch { window.location.href = `mailto:${btn.dataset.copy}`; }
      });
    });
  }

  /* ---------- Layout grid (Ctrl/⌘ + G) + motion toggle ---------- */
  function initToggles() {
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); root.classList.toggle('show-grid'); }
    });
    document.querySelectorAll('[data-motion-toggle]').forEach(btn => {
      const sync = () => btn.setAttribute('aria-pressed', String(!root.classList.contains('reduce-motion')));
      sync();
      btn.addEventListener('click', () => {
        const off = !root.classList.contains('reduce-motion');
        root.classList.toggle('reduce-motion', off);
        storage.set(MOTION_KEY, off ? 'off' : 'on');
        sync();
        window.location.reload();
      });
    });
  }

  /* ---------- Generic reveals ---------- */
  function initReveals() {
    // Masked line reveals for headings.
    if (window.SplitText) {
      document.querySelectorAll('[data-split]').forEach(el => {
        SplitText.create(el, {
          type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
          onSplit(self) {
            return gsap.from(self.lines, {
              yPercent: 110, duration: 1.1, stagger: 0.08, ease: 'expo.out',
              scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            });
          },
        });
      });
    }
    // Fade-up blocks, batched for efficiency.
    const items = gsap.utils.toArray('[data-reveal]');
    if (items.length) {
      gsap.set(items, { autoAlpha: 0, y: 40 });
      ScrollTrigger.batch(items, {
        start: 'top 90%', once: true,
        onEnter: batch => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.08, ease: 'expo.out', overwrite: true }),
      });
    }
    // Clip-path image reveals.
    gsap.utils.toArray('[data-clip]').forEach(el => {
      gsap.fromTo(el, { clipPath: 'inset(12% 8% 12% 8% round 24px)', scale: 1.04 }, {
        clipPath: 'inset(0% 0% 0% 0% round 14px)', scale: 1, ease: 'none',
        scrollTrigger: { trigger: el, start: 'top 95%', end: 'top 35%', scrub: 0.6 },
      });
    });
    // Counters: final value lives in the HTML; animate from zero once.
    document.querySelectorAll('[data-count]').forEach(el => {
      const end = parseFloat(el.dataset.count);
      const fmt = new Intl.NumberFormat('en-US');
      const obj = { v: 0 };
      gsap.to(obj, {
        v: end, duration: 1.8, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
        onUpdate: () => { el.textContent = fmt.format(Math.round(obj.v)); },
      });
    });
  }

  /* ---------- Marquee: velocity-driven skew + speed ---------- */
  function initMarquee() {
    document.querySelectorAll('.marquee').forEach(m => {
      const track = m.querySelector('.marquee__track');
      const skewEl = m.querySelector('.marquee__skew');
      if (!track) return;
      const anim = track.getAnimations ? track.getAnimations()[0] : null;
      const skewTo = skewEl && gsap.quickTo(skewEl, 'skewX', { duration: 0.6, ease: 'power3' });
      ScrollTrigger.create({
        trigger: m, start: 'top bottom', end: 'bottom top',
        onUpdate(self) {
          const v = gsap.utils.clamp(-1600, 1600, self.getVelocity());
          if (skewTo) skewTo(v / -220);
          if (anim) anim.playbackRate = 1 + Math.abs(v) / 500;
        },
        onToggle(self) { if (anim) self.isActive ? anim.play() : anim.pause(); },
      });
    });
  }

  /* ---------- Browser frames: scroll the full-page shot on hover ---------- */
  function initScrollShots() {
    document.querySelectorAll('.browser__view.is-scroll').forEach(view => {
      const img = view.querySelector('img');
      if (!img) return;
      let tween;
      const travel = () => Math.max(0, img.getBoundingClientRect().height - view.getBoundingClientRect().height);
      const trigger = view.closest('[data-shot-host]') || view;
      if (finePointer) {
        trigger.addEventListener('pointerenter', () => {
          if (!motionOK()) return;
          const d = travel();
          tween && tween.kill();
          tween = gsap.to(img, { y: -d, duration: Math.max(2, d / 420), ease: 'power1.inOut' });
        });
        trigger.addEventListener('pointerleave', () => { tween && tween.kill(); tween = gsap.to(img, { y: 0, duration: 1.1, ease: 'expo.out' }); });
      } else if (motionOK()) {
        gsap.to(img, { y: () => -travel(), ease: 'none', scrollTrigger: { trigger: view, start: 'top 80%', end: 'bottom 20%', scrub: true, invalidateOnRefresh: true } });
      }
    });
  }

  /* ---------- Before/after compare slider ---------- */
  function initCompare() {
    document.querySelectorAll('.compare').forEach(c => {
      const set = pct => c.style.setProperty('--pos', `${Math.max(0, Math.min(100, pct))}%`);
      const fromEvent = e => { const r = c.getBoundingClientRect(); set(((e.clientX - r.left) / r.width) * 100); };
      let drag = false;
      c.addEventListener('pointerdown', e => { drag = true; c.setPointerCapture(e.pointerId); fromEvent(e); });
      c.addEventListener('pointermove', e => { if (drag || finePointer) fromEvent(e); });
      c.addEventListener('pointerup', () => { drag = false; });
      const handle = c.querySelector('.compare__handle button');
      handle?.addEventListener('keydown', e => {
        const cur = parseFloat(getComputedStyle(c).getPropertyValue('--pos')) || 50;
        if (e.key === 'ArrowLeft') { set(cur - 5); e.preventDefault(); }
        if (e.key === 'ArrowRight') { set(cur + 5); e.preventDefault(); }
      });
      if (motionOK()) {
        gsap.fromTo(c, { '--pos': '12%' }, { '--pos': '50%', duration: 1.6, ease: 'expo.inOut', scrollTrigger: { trigger: c, start: 'top 75%', once: true } });
      }
    });
  }

  /* ---------- Boot ---------- */
  root.classList.add('js');
  initClock();
  initHeader();
  initCopy();
  initToggles();
  initCompare();

  const mm = gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)', () => {
    if (!motionOK()) return;
    startLenis();
    initCursor();
    initMagnetic();
    initTiles();
    initScramble();
    initReveals();
    initMarquee();
    initScrollShots();
    return () => stopLenis();
  });
  // Static-but-complete fallbacks for reduced motion.
  if (!motionOK()) {
    document.querySelectorAll('[data-count]').forEach(el => (el.textContent = new Intl.NumberFormat('en-US').format(parseFloat(el.dataset.count))));
  }

  runPreloader();
  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
