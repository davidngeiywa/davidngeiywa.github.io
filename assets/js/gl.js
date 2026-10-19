// Hero background: a single full-screen OGL shader — domain-warped noise with topographic
// contour lines that drift and lean toward the cursor. Falls back to the CSS aurora.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('reduce-motion');
const canvas = document.getElementById('hero-gl');

if (canvas && !reduce) {
  import('https://cdn.jsdelivr.net/npm/ogl@1.0.11/+esm').then(({ Renderer, Program, Mesh, Triangle }) => {
    const coarse = matchMedia('(hover: none), (pointer: coarse)').matches;
    let renderer;
    try {
      renderer = new Renderer({ canvas, dpr: Math.min(window.devicePixelRatio || 1, coarse ? 1 : 1.5), alpha: false, antialias: false, powerPreference: 'low-power' });
    } catch { return; }
    const gl = renderer.gl;
    gl.clearColor(0.043, 0.051, 0.063, 1);

    const program = new Program(gl, {
      vertex: /* glsl */ `
        attribute vec2 uv; attribute vec2 position; varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`,
      fragment: /* glsl */ `
        precision highp float;
        uniform float uTime; uniform vec2 uRes; uniform vec2 uMouse; uniform float uFade;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
        }
        float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
        void main() {
          vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
          vec2 m = (uMouse - 0.5) * vec2(uRes.x / uRes.y, 1.0);
          float t = uTime * 0.04;
          vec2 pull = (m - p) * 0.18 * exp(-length(p - m) * 1.8);
          vec2 q = vec2(fbm(p * 1.5 + t + pull), fbm(p * 1.5 - t + 3.1));
          vec2 r = vec2(fbm(p * 2.0 + q * 1.7 + vec2(1.7, 9.2) + t * 1.3), fbm(p * 2.0 + q * 1.7 + vec2(8.3, 2.8) - t));
          float f = fbm(p * 1.3 + r * 1.5);
          vec3 ink = vec3(0.043, 0.051, 0.063);
          vec3 volt = vec3(0.83, 1.0, 0.23);
          vec3 blue = vec3(0.17, 0.33, 0.92);
          vec3 col = ink;
          col += blue * pow(f, 3.2) * 0.55;
          col += volt * pow(clamp(r.x * f * 1.25, 0.0, 1.0), 3.0) * 0.30;
          float d = length(p - m);
          col += volt * exp(-d * 3.0) * 0.07;
          float c = abs(fract(f * 9.0) - 0.5);
          float line = smoothstep(0.035, 0.0, c);
          col += mix(vec3(0.75, 0.8, 0.9), volt, exp(-d * 2.2)) * line * (0.035 + exp(-d * 2.4) * 0.09);
          col *= smoothstep(1.35, 0.25, length(p * vec2(0.75, 1.0)));
          col = mix(col, ink, uFade);
          gl_FragColor = vec4(col, 1.0);
        }`,
      uniforms: { uTime: { value: 0 }, uRes: { value: [1, 1] }, uMouse: { value: [0.7, 0.6] }, uFade: { value: 0 } },
    });
    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const hero = canvas.closest('.hero');
    const resize = () => {
      const w = hero.clientWidth, h = hero.clientHeight;
      renderer.setSize(w, h);
      program.uniforms.uRes.value = [gl.drawingBufferWidth, gl.drawingBufferHeight];
    };
    new ResizeObserver(resize).observe(hero);
    resize();

    const target = [0.7, 0.6], cur = [0.7, 0.6];
    window.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      target[0] = (e.clientX - r.left) / r.width;
      target[1] = 1 - (e.clientY - r.top) / r.height;
    }, { passive: true });

    let visible = true, raf = 0, frame = 0, started = false;
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }, { threshold: 0 }).observe(hero);
    document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !raf) raf = requestAnimationFrame(loop); });

    function loop(t) {
      raf = 0;
      if (!visible || document.hidden) return;
      frame++;
      if (!(coarse && frame % 2)) {
        cur[0] += (target[0] - cur[0]) * 0.05; cur[1] += (target[1] - cur[1]) * 0.05;
        program.uniforms.uMouse.value = cur;
        program.uniforms.uTime.value = t * 0.001;
        const r = hero.getBoundingClientRect();
        program.uniforms.uFade.value = Math.min(1, Math.max(0, -r.top / r.height)) * 0.85;
        renderer.render({ scene: mesh });
        if (!started) { started = true; document.documentElement.classList.add('gl-on'); }
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);
  }).catch(() => { /* CSS aurora remains */ });
}
