/* Home page choreography: hero, schematic, stacking work cards, product lab,
   process line, archive filter + cursor preview, and the live bento demos. */
(() => {
  if (typeof window.gsap === 'undefined') return;
  const DN = window.DN || {};
  const motion = () => (DN.motionOK ? DN.motionOK() : !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fine = DN.finePointer ?? matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- Hero ---------- */
  const lines = $$('.hero__line > span');
  const heroIn = $$('[data-hero-in]');
  const sx = $('[data-schematic]');
  const sxPaths = sx ? $$('.sx-path', sx) : [];
  const sxNodes = sx ? $$('.sx-node', sx) : [];

  function heroIntro() {
    if (!motion()) return;
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from(lines, { yPercent: 115, rotate: 3, duration: 1.4, stagger: 0.09 })
      .from(heroIn, { autoAlpha: 0, y: 26, duration: 1.1, stagger: 0.08 }, '-=1.05');
    if (sx) {
      sxPaths.forEach(p => { const l = p.getTotalLength(); gsap.set(p, { strokeDasharray: l, strokeDashoffset: l }); });
      tl.to(sxPaths, { strokeDashoffset: 0, duration: 1.6, stagger: 0.05, ease: 'power2.inOut' }, 0.2)
        .from(sxNodes, { autoAlpha: 0, scale: 0.6, transformOrigin: '50% 50%', duration: 1, stagger: 0.05, ease: 'back.out(1.6)' }, 0.5)
        .from($$('.sx-flow, .sx-ring', sx), { autoAlpha: 0, duration: 1.2 }, 1.1);
    }
  }
  if (document.documentElement.classList.contains('is-loading')) {
    if (motion()) gsap.set(lines, { yPercent: 115 });
    document.addEventListener('dn:ready', () => { gsap.set(lines, { clearProps: 'transform' }); heroIntro(); }, { once: true });
  } else heroIntro();

  // Rotating word with a scramble.
  const rotBox = $('.hero__rotator');
  const rot = rotBox && $('.hero__rot-text', rotBox);
  if (rot && window.ScrambleTextPlugin) {
    const words = JSON.parse(rotBox.dataset.words || '[]');
    let i = 0;
    const next = () => {
      if (!motion() || document.hidden) return;
      i = (i + 1) % words.length;
      gsap.to(rot, { duration: 1.1, scrambleText: { text: words[i], chars: 'aceinorsuv', speed: 0.5, revealDelay: 0.25 }, ease: 'none' });
    };
    setInterval(next, 3200);
  }

  // Schematic: hover/focus a system to light its path and show where it shipped.
  if (sx) {
    const tip = $('.schematic__tip', sx);
    const on = node => {
      const i = node.dataset.i;
      sx.classList.add('is-focus');
      $$(`[data-i="${i}"]`, sx).forEach(el => el.classList.add('is-on'));
      tip.innerHTML = `<b>${node.querySelector('text').textContent}</b>Shipped in: ${node.dataset.used}`;
      const r = node.getBoundingClientRect(), sr = sx.getBoundingClientRect();
      let x = r.left - sr.left + r.width / 2 - 120, y = r.top - sr.top + r.height + 10;
      x = Math.max(0, Math.min(x, sr.width - 240));
      if (y > sr.height - 90) y = r.top - sr.top - 90;
      tip.style.transform = `translate(${x}px, ${y}px)`;
      tip.classList.add('is-on');
    };
    const off = () => { sx.classList.remove('is-focus'); $$('.is-on', sx).forEach(el => el.classList.remove('is-on')); tip.classList.remove('is-on'); };
    $$('.sx-node[data-i]', sx).forEach(n => {
      n.addEventListener('pointerenter', () => on(n));
      n.addEventListener('pointerleave', off);
      n.addEventListener('focus', () => on(n));
      n.addEventListener('blur', off);
    });
    // Idle tour: when nobody is pointing at it, highlight systems one by one.
    let idle = 0, tourT;
    const tour = () => {
      if (!motion() || sx.matches(':hover') || sx.contains(document.activeElement)) return;
      const nodes = $$('.sx-node[data-i]', sx);
      off(); on(nodes[idle++ % nodes.length]);
      tourT = setTimeout(off, 2200);
    };
    ScrollTrigger.create({ trigger: sx, start: 'top 80%', end: 'bottom top', onToggle(self) { clearInterval(sx._t); clearTimeout(tourT); if (self.isActive) sx._t = setInterval(tour, 3000); else off(); } });
  }

  /* ---------- Everything scroll-driven ---------- */
  const mm = gsap.matchMedia();
  mm.add({ desktop: '(min-width: 981px)', motion: '(prefers-reduced-motion: no-preference)' }, ctx => {
    const { desktop } = ctx.conditions;
    if (!motion()) return;
    const cleanups = [];

    // Hero parallax out.
    gsap.to('.hero__copy', { yPercent: -18, autoAlpha: 0.15, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });
    if (sx) gsap.to(sx, { yPercent: 14, rotate: -6, scale: 0.92, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } });

    // Stacking work cards: each card recedes as the next one slides over it.
    if (desktop) {
      const cards = $$('.work-card');
      cards.forEach((card, i) => {
        const nextCard = cards[i + 1];
        if (!nextCard) return;
        const shade = card.querySelector('.work-card__shade');
        gsap.timeline({ scrollTrigger: { trigger: nextCard, start: 'top bottom', end: 'top 20%', scrub: true } })
          .to(card, { scale: 0.93, ease: 'none' }, 0)
          .to(shade, { opacity: 0.55, ease: 'none' }, 0);
      });
    }

    // Product lab: horizontal scroll inside a native sticky stage.
    const lab = $('#lab'), stage = $('.hscroll__stage'), pin = $('.hscroll__pin'), track = $('.hscroll__track'), bar = $('.hscroll__progress i');
    if (desktop && lab && stage && track) {
      lab.classList.add('is-sticky');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      const size = () => stage.style.setProperty('--stage-h', `${pin.offsetHeight + dist()}px`);
      size();
      ScrollTrigger.addEventListener('refreshInit', size);
      gsap.to(track, {
        x: () => -dist(), ease: 'none',
        scrollTrigger: { trigger: stage, start: 'top top+=72', end: 'bottom bottom', scrub: true, invalidateOnRefresh: true,
          onUpdate: self => bar && gsap.set(bar, { scaleX: self.progress }) },
      });
      cleanups.push(() => { lab.classList.remove('is-sticky'); ScrollTrigger.removeEventListener('refreshInit', size); stage.style.removeProperty('--stage-h'); gsap.set(track, { clearProps: 'transform' }); });
    }

    // Process line draws through the steps.
    const proc = $('[data-process]');
    if (proc) {
      const stepsEls = $$('.step', proc);
      ScrollTrigger.create({
        trigger: proc, start: 'top 75%', end: 'bottom 55%', scrub: true,
        onUpdate(self) {
          proc.style.setProperty('--p', self.progress.toFixed(3));
          stepsEls.forEach((s, i) => s.classList.toggle('is-on', self.progress >= i / stepsEls.length - 0.02));
        },
      });
    }

    // Timeline years slide in.
    $$('.tl-year').forEach(y => gsap.from(y, { xPercent: -30, autoAlpha: 0, ease: 'expo.out', duration: 1.2, scrollTrigger: { trigger: y, start: 'top 85%', once: true } }));
    return () => cleanups.forEach(fn => fn());
  });
  if (!motion()) {
    const proc = $('[data-process]');
    if (proc) { proc.style.setProperty('--p', '1'); $$('.step', proc).forEach(s => s.classList.add('is-on')); }
  }

  /* ---------- Archive: Flip filtering + cursor preview ---------- */
  const archive = $('[data-archive]');
  if (archive) {
    const rows = $$('.arow', archive);
    $$('.filter').forEach(btn => btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      $$('.filter').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      const state = window.Flip && motion() ? Flip.getState(rows) : null;
      rows.forEach(r => r.classList.toggle('is-hidden', f !== 'all' && !r.dataset.cats.split(' ').includes(f)));
      if (state) Flip.from(state, { duration: 0.6, ease: 'expo.out', stagger: 0.015, absolute: true, onEnter: els => gsap.fromTo(els, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5 }), onLeave: els => gsap.to(els, { autoAlpha: 0, duration: 0.25 }) });
      ScrollTrigger.refresh();
    }));

    const preview = $('.preview');
    if (preview && fine) {
      const img = preview.querySelector('img');
      const xTo = gsap.quickTo(preview, 'x', { duration: 0.55, ease: 'power3' });
      const yTo = gsap.quickTo(preview, 'y', { duration: 0.55, ease: 'power3' });
      const rTo = gsap.quickTo(preview, 'rotation', { duration: 0.6, ease: 'power3' });
      let lastX = 0;
      archive.addEventListener('pointermove', e => {
        xTo(e.clientX + 28); yTo(e.clientY - 110);
        rTo(gsap.utils.clamp(-10, 10, (e.clientX - lastX) * 0.6)); lastX = e.clientX;
      });
      rows.forEach(r => {
        r.addEventListener('pointerenter', () => {
          if (!r.dataset.img) { gsap.to(preview, { autoAlpha: 0, scale: 0.85, duration: 0.3 }); return; }
          const src = new URL(r.dataset.img, document.baseURI).href;
          if (img.src !== src) img.src = src;
          preview.style.borderColor = getComputedStyle(r).getPropertyValue('--accent');
          gsap.to(preview, { autoAlpha: 1, scale: 1, duration: 0.45, ease: 'expo.out' });
        });
      });
      archive.addEventListener('pointerleave', () => gsap.to(preview, { autoAlpha: 0, scale: 0.85, duration: 0.35 }));
    }
  }

  /* ---------- Bento live demos (run only while visible) ---------- */
  const demos = {
    shield(el) {
      const items = $$('li', el);
      return gsap.timeline({ repeat: -1, repeatDelay: 2.2 })
        .call(() => items.forEach(li => li.classList.remove('is-on')))
        .to({}, { duration: 0.4 })
        .add(items.map((li, i) => gsap.delayedCall(i * 0.32, () => li.classList.add('is-on'))));
    },
    stk(el) {
      const dots = $$('.demo-stk__pin span', el), ok = $('.demo-stk__ok', el);
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.6 });
      tl.call(() => { dots.forEach(d => d.classList.remove('is-on')); ok.classList.remove('is-on'); }).to({}, { duration: 0.6 });
      dots.forEach(d => tl.call(() => d.classList.add('is-on')).to({}, { duration: 0.28 }));
      return tl.to({}, { duration: 0.4 }).call(() => ok.classList.add('is-on')).to({}, { duration: 1.8 });
    },
    invoice(el) {
      const stamp = $('.demo-invoice__stamp', el);
      return gsap.timeline({ repeat: -1, repeatDelay: 2.4 })
        .call(() => { stamp.dataset.state = 'pending'; stamp.textContent = 'Signing…'; })
        .to({}, { duration: 1.4 })
        .call(() => { stamp.dataset.state = 'ok'; stamp.textContent = '✓ KRA signed · CU 0042'; })
        .fromTo(stamp, { scale: 1.25 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' });
    },
    kiosk(el) {
      const line = $('[data-kiosk-new]', el);
      const names = ['C. Mutua', 'D. Achieng', 'E. Kiprono', 'F. Njeri'];
      let n = 0;
      return gsap.timeline({ repeat: -1, repeatDelay: 0.6 })
        .call(() => { line.innerHTML = `08:0${4 + (n % 5)} <b>${names[n % names.length]}</b> · matching…`; })
        .to({}, { duration: 1.3 })
        .call(() => { line.innerHTML = `08:0${4 + (n % 5)} <b>${names[n % names.length]}</b> · in ✓ 98.6%`; n++; })
        .to({}, { duration: 1.4 });
    },
    payroll(el) {
      return gsap.fromTo($$('.demo-payroll__bar i', el), { scaleX: 0 }, { scaleX: 1, duration: 1.4, stagger: 0.12, ease: 'expo.out', repeat: -1, repeatDelay: 3, yoyo: false });
    },
    ai(el) {
      const a = $('.demo-ai__a', el), text = a.dataset.aiText;
      const o = { n: 0 };
      return gsap.timeline({ repeat: -1, repeatDelay: 2.5 })
        .set(o, { n: 0 })
        .call(() => (a.textContent = ''))
        .to({}, { duration: 0.6 })
        .to(o, { n: text.length, duration: text.length * 0.028, ease: 'none', onUpdate: () => (a.textContent = text.slice(0, Math.round(o.n))) });
    },
    receipt(el) {
      return gsap.fromTo(el, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 2.2, ease: 'steps(14)', repeat: -1, repeatDelay: 2.5 });
    },
  };
  $$('[data-demo]').forEach(el => {
    const make = demos[el.dataset.demo];
    if (!make) return;
    if (!motion()) {
      // Static end-states for reduced motion.
      $$('li', el).forEach(li => li.classList.add('is-on'));
      const ok = $('.demo-stk__ok', el); if (ok) ok.classList.add('is-on');
      $$('.demo-stk__pin span', el).forEach(d => d.classList.add('is-on'));
      const a = $('.demo-ai__a', el); if (a) a.textContent = a.dataset.aiText;
      const s = $('.demo-invoice__stamp', el); if (s) { s.dataset.state = 'ok'; s.textContent = '✓ KRA signed'; }
      return;
    }
    let tl;
    ScrollTrigger.create({
      trigger: el, start: 'top bottom', end: 'bottom top',
      onToggle(self) { if (self.isActive) { tl = tl || make(el); tl.play(); } else if (tl) tl.pause(); },
    });
  });
})();
