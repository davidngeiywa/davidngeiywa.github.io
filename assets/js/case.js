/* Case-study pages: hero cover parallax and a pull-through "next project" title. */
(() => {
  if (typeof window.gsap === 'undefined') return;
  const motion = () => (window.DN?.motionOK ? window.DN.motionOK() : !matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!motion()) return;
  const mm = gsap.matchMedia();
  mm.add('(min-width: 861px)', () => {
    const cover = document.querySelector('.case-cover img');
    if (cover) gsap.fromTo(cover, { yPercent: 0 }, { yPercent: -8, ease: 'none', scrollTrigger: { trigger: '.case-cover', start: 'top 70%', end: 'bottom top', scrub: true } });
    const next = document.querySelector('.next-case__t');
    if (next) gsap.from(next, { xPercent: 12, ease: 'none', scrollTrigger: { trigger: '.next-case', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  });
})();
