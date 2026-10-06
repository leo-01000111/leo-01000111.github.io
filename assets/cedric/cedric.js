/* Cedric the shrimp — animated mascot (v2, works with any design from shrimp.js).
   Usage: Cedric.mount({ design })                         → fixed, bottom-right
          Cedric.mount({ design, target, fixed: false })   → inline, inside `target`
   Options: lines: 'cedric-lines.json' (URL) or { greeting, wake, poke: [...] }
            ink:   'blue' (default) | 'yellow'
            motion: 'auto' (default: honour the OS "reduce motion" setting) | 'always'
            viewBox: 'x y w h' to crop (e.g. a head close-up); default is the whole shrimp
            label:  accessible name for the poke button
            interactive: false → no poke button (use when Cedric sits inside another control)
            draw:   false → appear fully drawn instead of hatching in
   The returned object's destroy() removes Cedric and stops his loop and listeners. */
(function () {
  const NS = 'http://www.w3.org/2000/svg';
  const SLEEP_AFTER_MS = 25000;
  // Used until (or if) the lines file loads.
  const DEFAULT_LINES = { greeting: "hi, I'm Cedric", wake: '!', poke: ["hi, I'm Cedric", 'blub.'] };
  const normLines = j => Array.isArray(j) ? { ...DEFAULT_LINES, poke: j } : { ...DEFAULT_LINES, ...j };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const el = (tag, attrs = {}) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  function buildSvg(design, viewBox) {
    const svg = el('svg', { viewBox: viewBox || design.viewBox, 'aria-hidden': 'true' });
    const groups = {};
    let k = 0;
    // Draw order: shell head → tail, fan, legs, antennae, then the face.
    for (const part of ['body', 'fan', 'legs', 'ant', 'blush', 'face']) {
      const g = el('g', { class: 'cedric__' + part });
      for (const s of design.parts[part] || []) {
        const p = el('path', { d: s.d, 'stroke-width': s.w, pathLength: 1 });
        p.style.setProperty('--i', s.i || 0);
        p.style.setProperty('--s', s.s || 0);
        if (s.o) p.style.transformOrigin = `${s.o[0]}px ${s.o[1]}px`;
        p.dataset.k = k++;
        g.appendChild(p);
      }
      groups[part] = g;
    }
    const aim = el('g');  // cursor aiming lives here so it doesn't fight the CSS wiggle
    aim.appendChild(groups.ant);
    const tp = design.pivots.tail;
    groups.fan.style.transformOrigin = `${tp[0]}px ${tp[1]}px`;
    svg.append(groups.body, groups.fan, groups.legs, aim, groups.blush, groups.face);

    let eye = null, eyeLine = null;
    if (design.eye && design.eye.host) {
      // Eye = short coloured dash riding in a gap of its own hatch line.
      const E = design.eye, { p, q, s: sv } = E.host;
      eyeLine = el('g', { class: 'cedric__eyeline' });
      eyeLine.style.setProperty('--s', sv);
      const host = el('path', { class: 'cedric__host', d: `M${p[0]} ${p[1]}L${q[0]} ${q[1]}`, 'stroke-width': E.w });
      // The eye is a plain line like every other stroke: its end points are recomputed
      // each frame (no transforms on it), so it renders just as crisply as the hatching.
      const at = k => [E.host.p[0] + E.dir[0] * k, E.host.p[1] + E.dir[1] * k];
      const [a0, a1] = [at(E.u0 - E.len / 2), at(E.u0 + E.len / 2)];
      eye = el('path', { class: 'cedric__eye', d: `M${a0[0]} ${a0[1]}L${a1[0]} ${a1[1]}`, 'stroke-width': E.w });
      eyeLine.append(host, eye);
      svg.insertBefore(eyeLine, aim);
      eyeLine.host = host;
    } else if (design.eye) {
      const { c, r, hl } = design.eye;
      eye = el('g', { class: 'cedric__eye cedric__eye--dot' });
      eye.appendChild(el('circle', { cx: c[0], cy: c[1], r }));
      if (hl) eye.appendChild(el('circle', { class: 'cedric__glint', cx: c[0] - r * .32, cy: c[1] - r * .32, r: r * .3 }));
      svg.appendChild(eye);
    }
    const paths = [...svg.querySelectorAll('path')].filter(p => !p.closest('.cedric__eyeline'));
    return { svg, aim, groups, eye, eyeLine, paths };
  }

  function mount(opts = {}) {
    const fixed = opts.fixed !== false;
    const motion = opts.motion === 'always' ? 'always' : 'auto';
    const still = () => motion !== 'always' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const root = document.createElement('div');
    root.className = 'cedric' + (fixed ? ' cedric--fixed' : '');
    root.dataset.motion = motion;
    root.innerHTML = `
      <div class="cedric__bubble" role="status" aria-live="polite"></div>
      <div class="cedric__zzz" aria-hidden="true"><span>z</span><span>z</span><span>z</span></div>
      <div class="cedric__lean"><div class="cedric__bob">
        ${opts.interactive === false ? '<span class="cedric__btn"></span>' : '<button class="cedric__btn" type="button"></button>'}
      </div></div>
      ${fixed ? '<button class="cedric__close" type="button" aria-label="Hide Cedric">×</button>' : ''}`;
    const btn = root.querySelector('.cedric__btn');
    if (opts.interactive !== false) btn.setAttribute('aria-label', opts.label || 'Cedric the shrimp. Poke him.');
    const lean = root.querySelector('.cedric__lean');
    const bubble = root.querySelector('.cedric__bubble');
    (opts.target || document.body).appendChild(root);

    let design, svg, aim, groups, eye, eyeLine, paths;
    function setDesign(d) {
      design = d;
      btn.textContent = '';
      ({ svg, aim, groups, eye, eyeLine, paths } = buildSvg(d, opts.viewBox));
      eyeU = d.eye && d.eye.host ? d.eye.u0 : 0;
      btn.appendChild(svg);
      root.dataset.design = d.name;
      if (opts.draw !== false) draw();
    }

    let lines = DEFAULT_LINES;
    if (typeof opts.lines === 'string') {
      fetch(opts.lines).then(r => r.json()).then(j => { lines = normLines(j); })
        .catch(() => console.warn('Cedric: could not load ' + opts.lines + ', using default lines'));
    } else if (opts.lines) lines = normLines(opts.lines);

    function setInk(ink) { root.dataset.ink = ink === 'yellow' ? 'yellow' : 'blue'; }
    setInk(opts.ink);

    let hidden = false;
    try { hidden = fixed && localStorage.getItem('cedric:hidden') === '1'; } catch (e) {}
    root.hidden = hidden;

    // ---- one-shot animations -------------------------------------------------
    function draw() {
      if (still() || root.hidden) return;
      const step = Math.min(45, 1400 / paths.length);
      paths.forEach(p => p.animate(
        [{ strokeDashoffset: 1, opacity: 0 },
         { strokeDashoffset: 1, opacity: 1, offset: 0.01 },
         { strokeDashoffset: 0, opacity: 1 }],
        { duration: 240, delay: 200 + p.dataset.k * step, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'backwards' }));
      if (eyeLine) eyeLine.host.animate([{ opacity: 0 }, { opacity: 1 }],
        { duration: 240, delay: 200 + paths.length * step * 0.15, fill: 'backwards' });
      if (eyeLine) eyePopAt = performance.now() + 300 + paths.length * step;
      else if (eye) eye.animate(
        [{ transform: 'scale(0)' }, { transform: 'scale(1.25)', offset: .7 }, { transform: 'scale(1)' }],
        { duration: 380, delay: 300 + paths.length * step, easing: 'ease-out', fill: 'backwards' });
    }

    let bubbleTimer;
    function say(text, ms = 1600 + text.length * 45) {
      bubble.textContent = text;
      root.classList.add('is-talking');
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => root.classList.remove('is-talking'), ms);
    }

    // Poke hop: a soft little bounce backwards (tail first, like a real shrimp), then
    // an eased settle. Kept small and slow on purpose so it reads as cute, not violent.
    function flick() {
      if (still()) return;
      const f = design.facing;
      btn.animate([
        { transform: 'none', easing: 'cubic-bezier(.3,0,.5,1)' },
        { transform: `translate(${f * 1}%, 1.5%) scale(1.02, .97)`, offset: 0.14, easing: 'cubic-bezier(.2,.6,.35,1)' },
        { transform: `translate(${-f * 6}%, -9%) rotate(${-f * 5}deg)`, offset: 0.48, easing: 'cubic-bezier(.45,0,.55,1)' },
        { transform: `translate(${-f * 1.5}%, -1%) rotate(${-f * 1}deg)`, offset: 0.8, easing: 'cubic-bezier(.3,0,.3,1)' },
        { transform: 'none' },
      ], { duration: 1100 });
      groups.fan.animate([
        { transform: 'none' }, { transform: 'rotate(-14deg)', offset: 0.3 },
        { transform: 'rotate(5deg)', offset: 0.65 }, { transform: 'none' },
      ], { duration: 1000, easing: 'ease-in-out' });
      blink();
    }

    function blink() {
      if (still() || !eye) return;
      if (eyeLine) { blinkAt = performance.now(); return; }
      eye.animate([{ transform: 'none' }, { transform: 'scaleY(.1)', offset: .5 }, { transform: 'none' }], { duration: 180 });
    }

    function sleep() { root.classList.add('is-asleep'); }
    function wake() {
      const was = root.classList.contains('is-asleep');
      root.classList.remove('is-asleep');
      if (was && lines.wake) say(lines.wake, 900);
    }

    // ---- input ---------------------------------------------------------------
    let pokes = 0;
    if (opts.interactive !== false) btn.addEventListener('click', () => {
      wake();
      flick();
      if (lines.poke.length) say(lines.poke[pokes++ % lines.poke.length]);
    });

    const close = root.querySelector('.cedric__close');
    if (close) close.addEventListener('click', () => {
      root.hidden = true;
      try { localStorage.setItem('cedric:hidden', '1'); } catch (e) {}
    });
    function show() {
      root.hidden = false;
      try { localStorage.removeItem('cedric:hidden'); } catch (e) {}
      draw();
    }

    let idleTimer;
    function activity() {
      wake();
      clearTimeout(idleTimer);
      idleTimer = setTimeout(sleep, SLEEP_AFTER_MS);
    }
    let mouse = null;
    let lastMove = 0;
    const life = new AbortController();
    const on = (type, fn) => addEventListener(type, fn, { passive: true, signal: life.signal });
    on('pointermove', e => { mouse = [e.clientX, e.clientY]; lastMove = performance.now(); activity(); });
    on('keydown', activity);

    // Scroll: he leans gently against the motion (see the frame loop). The event only
    // counts as activity; the lean is computed per frame from a smoothed scroll speed.
    let lastY = scrollY, scrollVel = 0, leanNow = 0;
    on('scroll', activity);

    // ---- frame loop: antenna aiming + scroll lean ------------------------------
    let antNow = 0, eyeU = 0, eyeOpen = 1, saccadeAt = 0, saccadeU = null;
    let eyePopAt = 0, blinkAt = -1e9, nextBlink = performance.now() + rand(2500, 5000);
    function updateEye(asleep, instant) {
      const E = design.eye, now = performance.now();
      let target = E.u0;
      if (instant) {
        // Reduced motion: eye parked at rest, no gliding.
        eyeU = E.u0; eyeOpen = asleep ? 0 : 1;
      } else if (!asleep) {
        if (mouse && now - lastMove < 3000) {
          // Slide toward the cursor, measured along the line as it appears on screen.
          const ctm = svg.getScreenCTM();
          const at = u => new DOMPoint(E.host.p[0] + E.dir[0] * u, E.host.p[1] + E.dir[1] * u).matrixTransform(ctm);
          const a = at(E.u0), b = at(E.u0 + 100), sl = Math.hypot(b.x - a.x, b.y - a.y) || 1;
          const proj = ((mouse[0] - a.x) * (b.x - a.x) + (mouse[1] - a.y) * (b.y - a.y)) / sl;
          const k = clamp(proj / 300, -1, 1);
          target = E.u0 + k * (k > 0 ? E.umax - E.u0 : E.u0 - E.umin);
          saccadeU = null;
        } else {
          // Nobody around: glance about now and then.
          if (now > saccadeAt) {
            saccadeAt = now + rand(1200, 3800);
            saccadeU = Math.random() < .4 ? E.u0 : rand(E.umin, E.umax);
          }
          if (saccadeU !== null) target = saccadeU;
        }
      }
      if (!instant) {
        eyeU += (target - eyeU) * (asleep ? 0.05 : 0.2);
        eyeOpen += ((asleep ? 0 : 1) - eyeOpen) * 0.08;
      }
      // Dash length factor: pops in after the draw-in, squeezes to a dot when blinking.
      let k = 1;
      if (!instant) {
        if (now > nextBlink) { blinkAt = now; nextBlink = now + rand(3500, 6500); }
        const pb = (now - blinkAt) / 180;
        if (pb >= 0 && pb < 1) k = 1 - 0.95 * Math.sin(Math.PI * pb);
        const pp = (now - eyePopAt) / 380;
        if (pp < 0) k = 0;
        else if (pp < 1) k *= pp < .7 ? 1.25 * (pp / .7) : 1.25 - 0.25 * ((pp - .7) / .3);
      }
      const u = eyeU, h = E.len / 2 * k;
      const x0 = E.host.p[0] + E.dir[0] * (u - h), y0 = E.host.p[1] + E.dir[1] * (u - h);
      const x1 = E.host.p[0] + E.dir[0] * (u + h), y1 = E.host.p[1] + E.dir[1] * (u + h);
      eye.setAttribute('d', `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`);
      // Only make it translucent while actually fading (a constant 0.999 costs sharpness).
      const op = k === 0 ? 0 : eyeOpen;
      eye.style.opacity = op > 0.995 ? '' : op.toFixed(3);
      // Host line: solid up to the eye, gap, solid after. Round caps eat w/2 of each side.
      const g = (E.len + 2 * E.w + 2 * E.clear) * eyeOpen;
      const a = u - g / 2;
      eyeLine.host.style.strokeDasharray = eyeOpen < 0.02 ? 'none' : `${a.toFixed(1)} ${g.toFixed(1)} ${E.length * 2}`;
    }

    let dead = false;
    function destroy() {
      dead = true;
      life.abort();
      clearTimeout(idleTimer);
      clearTimeout(bubbleTimer);
      root.remove();
    }

    function frame() {
      if (dead) return;
      requestAnimationFrame(frame);
      if (root.hidden || !svg) return;
      if (still()) {
        // No animation, but the eye still has to be placed on its line.
        if (eyeLine) updateEye(root.classList.contains('is-asleep'), true);
        aim.removeAttribute('transform');
        lean.style.transform = '';
        return;
      }
      const [px, py] = design.pivots.ant;

      const asleep = root.classList.contains('is-asleep');
      if (eyeLine) updateEye(asleep);
      let antTarget = 0;
      if (asleep) antTarget = -design.facing * 18;   // droop
      else if (mouse) {
        const ctm = svg.getScreenCTM();
        if (ctm) {
          const pt = new DOMPoint(px, py).matrixTransform(ctm);
          let a = Math.atan2(mouse[1] - pt.y, mouse[0] - pt.x) * 180 / Math.PI - design.pivots.antRest;
          a = ((a + 540) % 360) - 180;
          antTarget = Math.abs(a) > 110 ? 0 : clamp(a, -16, 16);
        }
      }
      antNow += (antTarget - antNow) * 0.12;
      aim.setAttribute('transform', `rotate(${antNow.toFixed(2)} ${px} ${py})`);

      // Scroll lean. Speed is low-pass filtered so a notched mouse wheel's separate jolts
      // blend into one smooth motion: it picks up fairly quickly and lets go slowly
      // (~1.5 s to straighten). The lean then eases toward that, with no spring/overshoot.
      const dy = scrollY - lastY;
      lastY = scrollY;
      scrollVel += (dy - scrollVel) * (Math.abs(dy) > Math.abs(scrollVel) ? 0.1 : 0.04);
      const leanTarget = clamp(-scrollVel * 0.3, -6, 6);
      leanNow += (leanTarget - leanNow) * 0.07;
      lean.style.transform = Math.abs(leanNow) < 0.02 ? '' : `rotate(${leanNow.toFixed(2)}deg)`;
    }
    requestAnimationFrame(frame);

    setDesign(opts.design);
    activity();
    return {
      root, get svg() { return svg; },
      setDesign, setInk, draw, say, flick, blink, sleep, wake, show, destroy,
      get lines() { return lines; },
    };
  }

  window.Cedric = { mount };
})();
