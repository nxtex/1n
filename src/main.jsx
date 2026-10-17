import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import './styles.css';

const nodeData = {
  A: { x: 1350, y: 486, r: 5.5 }, B: { x: 1044, y: 619, r: 5 }, C: { x: 1124, y: 417, r: 4.6 },
  D: { x: 922, y: 535, r: 4.8 }, E: { x: 777, y: 538, r: 6, soft: 1 }, F: { x: 836, y: 654, r: 4 },
  G: { x: 636, y: 698, r: 5 }, H: { x: 1185, y: 707, r: 9, soft: 1 }, J: { x: 1391, y: 367, r: 4 },
  K: { x: 1398, y: 698, r: 8, soft: 1 }, I: { x: 1414, y: 289, r: 9, soft: 1 },
};
const rawEdges = [
  ['A','B'],['A','H'],['A','C'],['A','J'],['A',[1536,418]],['A',[1536,512]],['A',[1480,610]],['A','K'],['A',[1250,790]],
  ['B','D'],['B','C'],['B','F'],['B','G'],['B','H'],['B',[1330,760]],['B',[1000,760]],
  ['C','D'],['C',[1062,300]],['C',[1180,300]],['C','J'],['D','E'],['D','F'],['D','G'],['D',[860,430]],
  ['E',[560,470]],['E',[640,610]],['F','G'],['F','H'],['G',[520,742]],['G',[690,760]],['H',[1100,800]],['H',[1290,770]],
  ['J','I'],['J',[1500,330]],['I',[1480,230]],
];
const orbData = [
  [1358,172,26],[1510,202,30],[967,380,18],[1040,402,11],[835,430,16],[556,489,22],[693,508,17],
  [313,586,20],[519,654,16],[608,638,13],[220,681,24],[950,918,28],[1030,858,20],[430,730,10],
  [1296,252,12],[1465,640,14],[880,300,9],[740,770,12],
];

function Icon({ name = 'arrow' }) {
  const paths = {
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
    play: <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />,
    chev: <path d="M9 5l7 7-7 7" />,
  };
  return <svg className="i" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function NetworkCanvas() {
  const canvasRef = useRef(null);
  const pageRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const page = pageRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !page || !ctx) return undefined;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const canHover = window.matchMedia('(hover: hover) and (pointer: fine)');
    const W = 1536;
    const H = 1024;
    const nodes = Object.fromEntries(Object.entries(nodeData).map(([key, n]) => [key, { ...n, pulse: 1 }]));
    const nodeKeys = Object.keys(nodes);
    const edges = rawEdges.map((edge) => {
      const point = (p) => typeof p === 'string' ? { x: nodes[p].x, y: nodes[p].y } : { x: p[0], y: p[1] };
      return { a: point(edge[0]), b: point(edge[1]), far: typeof edge[1] !== 'string' };
    });
    const orbs = orbData.map((o) => ({ x: o[0], y: o[1], r: o[2], dx: 0, dy: 0, a: 1 }));

    let seed = 7;
    const randSeed = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const dust = [];
    edges.forEach((edge) => {
      const count = 5 + Math.floor(randSeed() * 8);
      for (let i = 0; i < count; i += 1) {
        const t = randSeed();
        const offset = (randSeed() - 0.5) * 7;
        dust.push({
          x: edge.a.x + (edge.b.x - edge.a.x) * t + offset,
          y: edge.a.y + (edge.b.y - edge.a.y) * t + offset * 0.6,
          r: 0.5 + randSeed() * 1.1,
          a: 0.25 + randSeed() * 0.5,
          tw: randSeed() * 6.28,
        });
      }
    });
    for (let i = 0; i < 90; i += 1) dust.push({ x: 700 + randSeed() * 836, y: 250 + randSeed() * 560, r: 0.4 + randSeed() * 0.8, a: 0.12 + randSeed() * 0.3, tw: randSeed() * 6.28 });

    const pulses = edges.map((edge, index) => ({ edge, index, t: 0, a: 0 }))
      .filter((pulse) => !pulse.edge.far)
      .sort((a, b) => ((a.index * 37) % 101) - ((b.index * 37) % 101))
      .slice(0, 9);
    const state = { reveal: reducedMotion.matches ? 1 : 0, px: 0, py: 0, time: 0 };
    let cw = 0; let ch = 0; let dpr = 1; let scale = 1; let ox = 0; let oy = 0;
    let raf = 0; let resizeTimer = 0; let lastFrame = 0; let introTimeline; let idleTweens = [];
    let disposed = false;
    const eventCleanups = [];
    const listen = (element, eventName, handler, options) => {
      element.addEventListener(eventName, handler, options);
      eventCleanups.push(() => element.removeEventListener(eventName, handler, options));
    };

    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const random = (a, b) => a + Math.random() * (b - a);
    const X = (x) => ox + x * scale;
    const Y = (y) => oy + y * scale;

    function size() {
      const rect = page.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = rect.width; ch = rect.height;
      if (!cw || !ch) return;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      scale = Math.max(cw / W, ch / H);
      if (cw / ch < W / H) {
        ox = cw - W * scale * 0.78;
        oy = (ch - H * scale) * 0.55;
      } else {
        ox = (cw - W * scale) / 2;
        oy = (ch - H * scale) / 2;
      }
    }

    function draw(time = performance.now()) {
      if (disposed || !cw || !ch) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cw, ch);
      ctx.globalAlpha = 1;
      const reveal = state.reveal;
      const orbAlpha = clamp(reveal * 1.3, 0, 1);
      const nodeAlpha = clamp(reveal * 1.6 - 0.3, 0, 1);
      const sx = state.px; const sy = state.py;
      state.time += Math.min((time - (lastFrame || time)) / 1000, 0.05);
      lastFrame = time;

      orbs.forEach((orb) => {
        const radius = orb.r * scale * 1.6;
        const x = X(orb.x + orb.dx + sx * 26);
        const y = Y(orb.y + orb.dy + sy * 22);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(255,190,120,${(0.3 * orb.a * orbAlpha).toFixed(3)})`);
        gradient.addColorStop(0.55, `rgba(255,170,100,${(0.12 * orb.a * orbAlpha).toFixed(3)})`);
        gradient.addColorStop(1, 'rgba(255,170,100,0)');
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      });

      ctx.lineWidth = Math.max(0.8, scale * 0.9);
      edges.forEach((edge, index) => {
        const progress = reducedMotion.matches ? 1 : clamp(reveal * 1.6 - (index / edges.length) * 0.6, 0, 1);
        if (progress <= 0) return;
        const ax = X(edge.a.x + sx * 12); const ay = Y(edge.a.y + sy * 10);
        const bx = X(edge.b.x + sx * 12); const by = Y(edge.b.y + sy * 10);
        const gradient = ctx.createLinearGradient(ax, ay, bx, by);
        gradient.addColorStop(0, 'rgba(214,224,248,.50)');
        gradient.addColorStop(edge.far ? 0.7 : 1, edge.far ? 'rgba(170,190,235,.14)' : 'rgba(214,224,248,.40)');
        if (edge.far) gradient.addColorStop(1, 'rgba(170,190,235,0)');
        ctx.strokeStyle = gradient; ctx.beginPath(); ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (bx - ax) * progress, ay + (by - ay) * progress); ctx.stroke();
      });

      dust.forEach((particle) => {
        const twinkle = reducedMotion.matches ? 1 : 0.7 + 0.3 * Math.sin(state.time * 1.1 + particle.tw);
        ctx.fillStyle = `rgba(255,214,170,${(particle.a * twinkle * orbAlpha).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(X(particle.x + sx * 6), Y(particle.y + sy * 5), particle.r * scale, 0, Math.PI * 2); ctx.fill();
      });

      pulses.forEach((pulse) => {
        if (pulse.a <= 0.01 || reducedMotion.matches) return;
        const edge = pulse.edge;
        const x = X(edge.a.x + (edge.b.x - edge.a.x) * pulse.t + sx * 12);
        const y = Y(edge.a.y + (edge.b.y - edge.a.y) * pulse.t + sy * 10);
        const radius = 16 * scale;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, `rgba(255,240,215,${(0.95 * pulse.a).toFixed(3)})`);
        gradient.addColorStop(0.3, `rgba(255,190,120,${(0.4 * pulse.a).toFixed(3)})`);
        gradient.addColorStop(1, 'rgba(255,170,100,0)');
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      });

      ctx.globalAlpha = nodeAlpha;
      nodeKeys.forEach((key, index) => {
        const node = nodes[key];
        const x = X(node.x + sx * 12); const y = Y(node.y + sy * 10); const radius = node.r * scale;
        const pulse = reducedMotion.matches ? 1 : (0.88 + 0.12 * Math.sin(state.time * 0.77 + index * 1.9)) * node.pulse;
        const glow = radius * (node.soft ? 4.2 : 7) * pulse;
        let gradient = ctx.createRadialGradient(x, y, 0, x, y, glow);
        gradient.addColorStop(0, node.soft ? 'rgba(255,200,140,.55)' : 'rgba(255,224,180,.55)');
        gradient.addColorStop(0.25, 'rgba(255,176,100,.22)');
        gradient.addColorStop(1, 'rgba(255,160,90,0)');
        ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, glow, 0, Math.PI * 2); ctx.fill();
        if (!node.soft) {
          gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 1.7);
          gradient.addColorStop(0, 'rgba(255,255,255,1)');
          gradient.addColorStop(0.45, 'rgba(255,238,210,.95)');
          gradient.addColorStop(1, 'rgba(255,200,140,0)');
          ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius * 1.7, 0, Math.PI * 2); ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    }

    function tick(time) {
      draw(time);
      if (!disposed && !reducedMotion.matches) raf = requestAnimationFrame(tick);
    }
    function paintOnce() { cancelAnimationFrame(raf); draw(); }

    function clearIdle() {
      idleTweens.forEach((tween) => tween.kill());
      idleTweens = [];
      gsap.killTweensOf([...Object.values(nodes), ...orbs, ...pulses]);
    }

    function startIdle() {
      if (reducedMotion.matches || disposed) return;
      nodeKeys.forEach((key) => idleTweens.push(gsap.to(nodes[key], { pulse: random(1.08, 1.3), duration: random(1.4, 2.6), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: random(0, 1.5) })));
      orbs.forEach((orb) => {
        idleTweens.push(gsap.to(orb, { dx: random(-10, 10), dy: random(-10, 10), duration: random(4, 8), ease: 'sine.inOut', yoyo: true, repeat: -1 }));
        idleTweens.push(gsap.to(orb, { a: random(0.45, 0.7), duration: random(2.5, 5), ease: 'sine.inOut', yoyo: true, repeat: -1, delay: random(0, 2) }));
      });
      pulses.forEach((pulse, index) => {
        const timeline = gsap.timeline({ repeat: -1, repeatDelay: random(1, 4), delay: index * 0.45 + random(0, 1.5) });
        timeline.fromTo(pulse, { t: 0, a: 0 }, { t: 1, duration: random(2.2, 3.8), ease: 'power1.inOut', onUpdate: () => { pulse.a = Math.sin(Math.PI * pulse.t); } }).set(pulse, { a: 0 });
        idleTweens.push(timeline);
      });
    }

    function resize() {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        size();
        if (reducedMotion.matches) paintOnce();
      }, 80);
    }

    size();
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(page);
    window.addEventListener('resize', resize, { passive: true });

    const motionChange = () => {
      clearIdle();
      if (reducedMotion.matches) {
        state.reveal = 1;
        introTimeline?.kill();
        gsap.set('.nav, .eyebrow, h1, .lede, .actions, .scroll, .card, .services, .foot > *', { clearProps: 'all' });
        paintOnce();
      }
    };
    reducedMotion.addEventListener?.('change', motionChange);

    state.reveal = 1;
    gsap.set('.nav, .eyebrow, h1, .lede, .actions, .scroll, .card, .services, .foot > *, .ln', { autoAlpha: 1, clearProps: 'transform' });
    if (reducedMotion.matches) {
      paintOnce();
    } else {
      raf = requestAnimationFrame(tick);
      startIdle();
      // Keep only subtle ambient details; no staged entrance animation.
      idleTweens.push(gsap.to(page.querySelector('h1 .ln:nth-child(2) > span'), { backgroundPosition: '100% 0', duration: 7, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 3.7 }));
      idleTweens.push(gsap.to(page.querySelector('.scroll svg'), { y: 6, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 4 }));
      idleTweens.push(gsap.to(page.querySelector('.scroll span'), { opacity: 0.35, duration: 1.3, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 4 }));
      idleTweens.push(gsap.to(page.querySelector('.trust .chev'), { x: 5, duration: 0.9, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: 4 }));
    }

    if (canHover.matches && !reducedMotion.matches) {
      [...page.querySelectorAll('.glass')].forEach((element) => {
        listen(element, 'pointerenter', () => gsap.to(element, { '--sheen': 0.13, duration: 0.6 }));
        listen(element, 'pointermove', (event) => {
          const rect = element.getBoundingClientRect();
          element.style.setProperty('--mx', `${event.clientX - rect.left}px`);
          element.style.setProperty('--my', `${event.clientY - rect.top}px`);
        });
        listen(element, 'pointerleave', () => gsap.to(element, { '--sheen': 0, duration: 0.8 }));
      });
      const links = [...page.querySelectorAll('.links a')];
      links.forEach((link) => {
        listen(link, 'pointerenter', () => {
          gsap.to(links, { opacity: 0.42, duration: 0.3, overwrite: 'auto' });
          gsap.to(link, { opacity: 1, duration: 0.3, overwrite: 'auto' });
        });
        listen(link, 'pointerleave', () => gsap.to(links, { opacity: 1, duration: 0.4, overwrite: 'auto' }));
      });
      function magnet(element, strength) {
        if (!element) return;
        listen(element, 'pointermove', (event) => {
          const rect = element.getBoundingClientRect();
          gsap.to(element, { x: (event.clientX - rect.left - rect.width / 2) * strength, y: (event.clientY - rect.top - rect.height / 2) * strength, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
        });
        listen(element, 'pointerleave', () => gsap.to(element, { x: 0, y: 0, duration: 0.9, ease: 'elastic.out(1, .4)', overwrite: 'auto' }));
      }
      function animateArrow(element, svg) {
        if (!element || !svg) return;
        listen(element, 'pointerenter', () => gsap.to(svg, { xPercent: 140, duration: 0.2, ease: 'power2.in', overwrite: true, onComplete: () => gsap.fromTo(svg, { xPercent: -140 }, { xPercent: 0, duration: 0.5, ease: 'power3.out' }) }));
      }
      page.querySelectorAll('.cta').forEach((element) => { magnet(element, 0.22); animateArrow(element, element.querySelector('.dot svg')); });
      page.querySelectorAll('.btn-round').forEach((element) => { magnet(element, 0.3); animateArrow(element, element.querySelector('svg')); });
      page.querySelectorAll('.play').forEach((element) => magnet(element, 0.3));
      page.querySelectorAll('.svc').forEach((element) => {
        const go = element.querySelector('.go');
        magnet(go, 0.25); animateArrow(element, go?.querySelector('svg'));
        listen(element, 'pointerenter', () => gsap.to(element.querySelector('.t'), { x: 6, duration: 0.45 }));
        listen(element, 'pointerleave', () => gsap.to(element.querySelector('.t'), { x: 0, duration: 0.6 }));
      });
      const all = page.querySelector('.all');
      if (all) {
        listen(all, 'pointerenter', () => gsap.to(all.querySelector('.plus2'), { rotate: 90, scale: 1.12, duration: 0.6, ease: 'back.out(2)' }));
        listen(all, 'pointerleave', () => gsap.to(all.querySelector('.plus2'), { rotate: 0, scale: 1, duration: 0.6 }));
      }
      const card = page.querySelector('.card');
      if (card) {
        listen(card, 'pointerenter', () => {
          gsap.to(card.querySelector('.plus'), { rotate: 90, scale: 1.1, duration: 0.6, ease: 'back.out(2)' });
          gsap.to(card.querySelector('.bar'), { scaleX: 1.75, transformOrigin: '0 50%', duration: 0.6 });
        });
        listen(card, 'pointerleave', () => {
          gsap.to(card.querySelector('.plus'), { rotate: 0, scale: 1, duration: 0.6 });
          gsap.to(card.querySelector('.bar'), { scaleX: 1, duration: 0.6 });
        });
      }
    }

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', resize);
      reducedMotion.removeEventListener?.('change', motionChange);
      resizeObserver?.disconnect();
      eventCleanups.forEach((cleanup) => cleanup());
      clearIdle();
      introTimeline?.kill();
      gsap.killTweensOf([page, ...page.querySelectorAll('*'), state, ...Object.values(nodes), ...orbs, ...pulses]);
    };
  }, []);

  return <div className="page" ref={pageRef}>
    <canvas id="net" ref={canvasRef} aria-hidden="true" />
    <div className="vignette" />
    <div className="stage">
      <header className="glass nav">
        <a className="logo" href="#accueil" aria-label="One network, accueil">One network.</a>
        <ul className="links">
          <li><a href="/" aria-current="page">Accueil</a></li>
          <li><a href="/a-propos">À propos</a></li>
          <li><a href="/expertises">Expertises</a></li>
          <li><a href="/secteurs">Secteurs</a></li>
          <li><a href="/partenaires">Partenaires</a></li>
          <li><a href="/contact">Contact</a></li>
        </ul>
        <a className="cta" href="/contact">Nous contacter <span className="dot"><Icon /></span></a>
      </header>

      <section className="hero" id="accueil">
        <p className="eyebrow">Infrastructures &amp; solutions TIC</p>
        <h1><span className="ln"><span>Des infrastructures</span></span><span className="ln"><span>pour demain.</span></span></h1>
        <p className="lede">Concevoir, déployer et accompagner des infrastructures performantes, sécurisées et évolutives.</p>
        <div className="actions">
          <a className="btn-round" href="/expertises" aria-label="Découvrir nos expertises"><Icon /></a>
          <a className="label" href="/expertises">Découvrir nos expertises</a>
          <span className="rule" />
          <a className="video" href="#accueil">Voir la vidéo</a>
          <a className="play" href="#accueil" aria-label="Voir la vidéo"><Icon name="play" /></a>
        </div>
        <div className="scroll" aria-hidden="true">
          <svg viewBox="0 0 10 60"><path d="M5 2v11M2 10l3 3 3-3"/><path d="M5 30v28"/><path d="M5 41v4" /></svg>
          <span>Scroll</span>
        </div>
      </section>

      <aside className="glass card">
        <div className="thumb" />
        <div className="plus"><Icon name="plus" /></div>
        <h2>Des environnements fiables et sécurisés</h2>
        <p className="sub">Du bâtiment au cloud</p>
        <span className="bar" />
      </aside>

      <nav className="glass services" id="expertises" aria-label="Expertises">
        <a className="svc s1" href="/expertises/reseaux"><span className="n">01</span><span className="t">Réseaux &amp;<br />infrastructures</span><span className="go"><Icon /></span></a>
        <i className="sep a" />
        <a className="svc s2" href="/expertises/datacenter"><span className="n">02</span><span className="t">Datacenter &amp;<br />virtualisation</span><span className="go"><Icon /></span></a>
        <i className="sep b" />
        <a className="svc s3 one-line" href="/expertises/cybersecurite"><span className="n">03</span><span className="t">Cybersécurité</span><span className="go"><Icon /></span></a>
        <i className="sep c" />
        <a className="svc s4" href="/expertises/batiments"><span className="n">04</span><span className="t">Sécurité électronique<br />&amp; bâtiments</span><span className="go"><Icon /></span></a>
        <i className="sep d" />
        <a className="all" href="/secteurs" id="secteurs"><span className="plus2"><Icon name="plus" /></span><span className="txt">Tous nos<br />secteurs</span></a>
      </nav>

      <footer className="foot">
        <div className="vline" aria-hidden="true"><svg viewBox="0 0 10 60"><path d="M5 2v22M2 21l3 3 3-3"/><path d="M5 36v22M2 40l3-4 3 4"/></svg></div>
        <i className="spark" />
        <i className="hr l" />
        <a className="trust" href="/partenaires" id="partenaires">
          <span className="avatars" aria-hidden="true">
            <svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#7b8696"/><path d="M3 36c1-8 8-11 15-11s14 3 15 11z" fill="#1c2431"/><path d="M14 25l4 5 4-5z" fill="#f2f2f2"/><ellipse cx="18" cy="16" rx="6.3" ry="7.6" fill="#e3b799"/><path d="M11.3 14.5c-.4-6 4-8.6 7-8.6s7.2 2.2 6.6 8.6c-1.2-3.2-3.6-4.2-6.6-4.2s-5.6 1-7 4.2z" fill="#4a3426"/></svg>
            <svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#a49a90"/><path d="M3 36c1-8 8-11 15-11s14 3 15 11z" fill="#2a2f3a"/><path d="M14 25l4 5 4-5z" fill="#eee"/><ellipse cx="18" cy="16" rx="6.2" ry="7.5" fill="#d9a785"/><path d="M11.4 15c-.8-6.2 3.8-9 6.8-9s7 2.6 6.4 9c-1-3.4-3.4-4.6-6.4-4.6S12.8 11.6 11.4 15z" fill="#2b211b"/></svg>
            <svg viewBox="0 0 36 36"><rect width="36" height="36" fill="#6e7d90"/><path d="M3 36c1-8 8-11 15-11s14 3 15 11z" fill="#161c28"/><path d="M14 25l4 5 4-5z" fill="#f0f0f0"/><ellipse cx="18" cy="16" rx="6.4" ry="7.7" fill="#cf9877"/><path d="M11.2 14c.2-5.6 4.2-8 7-8s6.8 2.4 7 8c-1.4-2.8-3.8-3.8-7-3.8s-5.6 1-7 3.8z" fill="#5a3b28"/><path d="M12.5 19.5c1.5 4.5 9.5 4.5 11 0-1 3.4-3.6 4.6-5.5 4.6s-4.5-1.2-5.5-4.6z" fill="#5a3b28" opacity=".55"/></svg>
          </span>
          <span className="txt">Ils nous font confiance</span>
          <span className="chev"><Icon name="chev" /></span>
        </a>
        <i className="hr r" />
        <p className="brand"><b>ONE NETWORK</b><span>Building networks.<br />Bridging solutions.</span></p>
      </footer>
    </div>
  </div>;
}


const pageContent = {
  "/a-propos": {
    eyebrow: "One Network · Notre approche",
    title: "La technologie doit rapprocher.",
    intro: "Nous concevons et intégrons des infrastructures qui relient les personnes, les systèmes et les usages.",
    sections: [
      ["Une vision d’ensemble", "Réseaux, cloud, cybersécurité et systèmes connectés sont pensés comme les composantes d’un même environnement."],
      ["Une approche concrète", "Du cadrage à l’intégration, chaque projet s’appuie sur les contraintes du terrain, les objectifs métiers et la continuité d’activité."],
      ["Dans la durée", "Des solutions conçues pour rester fiables, maintenables et capables d’évoluer avec vos besoins."]
    ]
  },
  "/expertises": {
    eyebrow: "Nos expertises",
    title: "Les bonnes fondations. Au bon endroit.",
    intro: "Quatre domaines complémentaires pour construire, protéger et faire évoluer vos infrastructures technologiques.",
    cards: [
      ["01", "Réseaux & infrastructures", "Connecter les sites, les équipes et les applications.", "/expertises/reseaux"],
      ["02", "Datacenter & virtualisation", "Des environnements d’hébergement performants et résilients.", "/expertises/datacenter"],
      ["03", "Cybersécurité", "Intégrer la sécurité et renforcer la maîtrise des risques.", "/expertises/cybersecurite"],
      ["04", "Sécurité électronique & bâtiments", "Faire dialoguer les systèmes numériques et physiques.", "/expertises/batiments"]
    ]
  },
  "/expertises/reseaux": {
    eyebrow: "Expertise · 01",
    title: "Réseaux & infrastructures",
    intro: "Des infrastructures réseau pensées pour relier vos sites, vos équipes et vos applications avec fiabilité.",
    sections: [
      ["Connectivité", "Architecture LAN, WAN et Wi-Fi adaptée à vos usages et à vos contraintes."],
      ["Conception & intégration", "Des fondations documentées, cohérentes et évolutives."],
      ["Continuité", "Une attention portée à la disponibilité, à la supervision et à la performance."]
    ]
  },
  "/expertises/datacenter": {
    eyebrow: "Expertise · 02",
    title: "Datacenter & virtualisation",
    intro: "Des environnements d’hébergement conçus pour concilier performance, disponibilité et évolutivité.",
    sections: [
      ["Infrastructure", "Des plateformes dimensionnées selon les charges, les usages et les objectifs de service."],
      ["Virtualisation & cloud", "Des environnements rationalisés et plus simples à faire évoluer."],
      ["Résilience", "Une conception attentive à la sauvegarde, à la reprise et à la continuité d’activité."]
    ]
  },
  "/expertises/cybersecurite": {
    eyebrow: "Expertise · 03",
    title: "Cybersécurité",
    intro: "La sécurité intégrée à l’infrastructure pour réduire les risques et renforcer la résilience.",
    sections: [
      ["Prévenir", "Identifier les risques et renforcer les fondations de sécurité."],
      ["Protéger", "Mettre en place des mesures adaptées aux systèmes, aux accès et aux usages."],
      ["Faire évoluer", "Inscrire la sécurité dans une démarche continue, pragmatique et mesurable."]
    ]
  },
  "/expertises/batiments": {
    eyebrow: "Expertise · 04",
    title: "Sécurité électronique & bâtiments",
    intro: "Des systèmes connectés qui contribuent à des espaces plus sûrs, plus intelligents et mieux intégrés.",
    sections: [
      ["Sécurité des espaces", "Des dispositifs de sécurité électronique adaptés aux lieux et à leurs usages."],
      ["Systèmes connectés", "Une intégration cohérente entre équipements, réseaux et systèmes de supervision."],
      ["Convergence", "Le numérique et le bâtiment pensés ensemble, dès la conception."]
    ]
  },
  "/secteurs": {
    eyebrow: "Nos secteurs",
    title: "Des réponses adaptées à chaque environnement.",
    intro: "Les infrastructures doivent répondre aux réalités du terrain, aux usages et aux exigences de chaque organisation.",
    sections: [
      ["Entreprises & sièges", "Des systèmes fiables pour les équipes, les outils et les sites."],
      ["Sites industriels & logistiques", "Une attention particulière à la disponibilité, à la connectivité et à la sécurité."],
      ["Bâtiments & environnements tertiaires", "Des technologies intégrées au service des occupants et des exploitants."],
      ["Organisations multisites", "Une architecture cohérente pour relier les implantations et simplifier les opérations."]
    ]
  },
  "/partenaires": {
    eyebrow: "Écosystème",
    title: "Construire les bonnes connexions.",
    intro: "Des projets solides reposent sur une collaboration claire entre les équipes, les clients et les partenaires technologiques.",
    sections: [
      ["Une approche collaborative", "Les expertises sont mobilisées selon les besoins réels du projet."],
      ["Des solutions cohérentes", "Le choix des technologies s’inscrit dans l’architecture globale et les objectifs à atteindre."],
      ["Un objectif commun", "Créer des environnements fiables, intégrés et conçus pour durer."]
    ]
  },
  "/contact": {
    eyebrow: "Parlons de votre projet",
    title: "Connectons vos prochaines idées.",
    intro: "Vous préparez une évolution d’infrastructure, un projet de connectivité ou un besoin de sécurisation ? Présentez-nous votre contexte.",
    sections: [
      ["Un premier échange", "Partagez vos enjeux, votre environnement et les résultats que vous souhaitez atteindre."],
      ["Une réponse adaptée", "Chaque projet commence par la compréhension de vos besoins et de vos contraintes."]
    ]
  }
};

function SubPage({ path }) {
  const data = pageContent[path] || pageContent["/expertises"];
  const isOverview = Boolean(data.cards);
  return <main className="subpage">
    <header className="sub-nav">
      <a className="sub-logo" href="/">One network.</a>
      <nav aria-label="Navigation principale">
        <a href="/">Accueil</a>
        <a href="/a-propos">À propos</a>
        <a href="/expertises">Expertises</a>
        <a href="/secteurs">Secteurs</a>
        <a href="/partenaires">Partenaires</a>
        <a className="sub-contact" href="/contact">Parlons de votre projet <span>↗</span></a>
      </nav>
    </header>
    <section className="sub-hero">
      <p className="sub-eyebrow">{data.eyebrow}</p>
      <h1>{data.title}</h1>
      <p className="sub-intro">{data.intro}</p>
    </section>
    {isOverview ? <section className="sub-cards" aria-label="Nos expertises">
      {data.cards.map(([number, title, body, href]) => <a className="sub-card" href={href} key={number}>
        <span className="sub-number">{number}</span><h2>{title}</h2><p>{body}</p><span className="sub-arrow">↗</span>
      </a>)}
    </section> : <section className="sub-sections">
      {data.sections.map(([title, body], index) => <article className="sub-section" key={title}>
        <span className="sub-number">{String(index + 1).padStart(2, "0")}</span>
        <div><h2>{title}</h2><p>{body}</p></div><span className="sub-arrow">↗</span>
      </article>)}
    </section>}
    <footer className="sub-footer">
      <span>ONE NETWORK</span><p>Building networks. Bridging solutions.</p><a href="/contact">Échanger sur un projet <span>↗</span></a>
    </footer>
  </main>;
}


function AboutPage() {
  const principles = [
    { n: "01", title: "Comprendre avant d’agir", text: "Chaque environnement a ses usages, ses contraintes et ses priorités. La bonne solution commence par une lecture claire du besoin." },
    { n: "02", title: "Penser l’ensemble", text: "Réseaux, infrastructures, cloud et sécurité ne fonctionnent pas en silos. Leur cohérence fait la différence." },
    { n: "03", title: "Construire pour durer", text: "Une infrastructure doit rester lisible, fiable et capable d’évoluer avec l’organisation qu’elle accompagne." }
  ];
  const steps = [
    { n: "01", title: "Écouter", text: "Comprendre le contexte, les usages et les objectifs." },
    { n: "02", title: "Concevoir", text: "Définir une architecture adaptée, cohérente et évolutive." },
    { n: "03", title: "Intégrer", text: "Mettre en œuvre avec méthode et attention aux détails." },
    { n: "04", title: "Accompagner", text: "Faire vivre la solution et préparer ses prochaines évolutions." }
  ];
  return <main className="subpage about-page">
    <header className="sub-nav">
      <a className="sub-logo" href="/">One network.</a>
      <nav aria-label="Navigation principale">
        <a href="/">Accueil</a>
        <a href="/a-propos" aria-current="page">À propos</a>
        <a href="/expertises">Expertises</a>
        <a href="/secteurs">Secteurs</a>
        <a href="/partenaires">Partenaires</a>
        <a className="sub-contact" href="/contact">Parlons de votre projet <span>↗</span></a>
      </nav>
    </header>

    <section className="about-hero">
      <div className="about-hero-copy">
        <p className="sub-eyebrow"><span className="about-status-dot" /> One Network · Notre vision</p>
        <h1>La technologie<br /><em>doit rapprocher.</em></h1>
        <p className="sub-intro">Nous imaginons des infrastructures où les réseaux, les systèmes et les usages avancent dans la même direction.</p>
        <a className="about-text-link" href="#notre-approche">Découvrir notre approche <span>↓</span></a>
      </div>
      <div className="about-orbit" aria-hidden="true">
        <div className="about-orbit-ring ring-one" />
        <div className="about-orbit-ring ring-two" />
        <div className="about-orbit-ring ring-three" />
        <span className="about-orbit-node node-a" />
        <span className="about-orbit-node node-b" />
        <span className="about-orbit-node node-c" />
        <span className="about-orbit-node node-d" />
        <div className="about-orbit-core"><span>ONE</span><b>NETWORK</b><i /></div>
        <span className="about-orbit-label label-a">INFRASTRUCTURE</span>
        <span className="about-orbit-label label-b">CONNECTIVITÉ</span>
        <span className="about-orbit-label label-c">SÉCURITÉ</span>
      </div>
      <div className="about-hero-index"><span>01 — 04</span><span>Une vision connectée</span></div>
    </section>

    <section className="about-statement" id="notre-approche">
      <div className="about-section-kicker"><span>01</span><span>Notre approche</span></div>
      <div className="about-statement-main">
        <h2>Relier les expertises.<br /><span>Donner du sens à la technologie.</span></h2>
        <p>Une infrastructure performante ne se résume pas à une somme d’équipements. Elle repose sur des choix cohérents, une compréhension fine des besoins et une vision d’ensemble.</p>
        <p>One Network rassemble les enjeux de connectivité, d’infrastructure et de sécurité autour d’un objectif commun : créer des environnements technologiques fiables, lisibles et prêts à évoluer.</p>
      </div>
    </section>

    <section className="about-principles">
      <div className="about-section-heading">
        <div><p className="sub-eyebrow">Ce qui nous guide</p><h2>Trois principes.<br /><em>Une même exigence.</em></h2></div>
        <p>De la première réflexion à l’évolution des solutions, notre approche reste centrée sur la cohérence, l’usage et la durée.</p>
      </div>
      <div className="about-principle-grid">
        {principles.map((item) => <article className="about-principle" key={item.n}>
          <span className="sub-number">{item.n}</span>
          <span className="about-principle-mark" aria-hidden="true"><i /><i /><i /></span>
          <h3>{item.title}</h3><p>{item.text}</p>
          <span className="about-principle-line" />
        </article>)}
      </div>
    </section>

    <section className="about-method">
      <div className="about-section-kicker"><span>02</span><span>Notre méthode</span></div>
      <div className="about-method-heading"><h2>De la vision<br />à la réalité.</h2><p>Une démarche structurée, pensée pour garder chaque décision connectée à l’objectif du projet.</p></div>
      <div className="about-method-steps">
        {steps.map((step) => <article className="about-method-step" key={step.n}>
          <span>{step.n}</span><div><h3>{step.title}</h3><p>{step.text}</p></div><i aria-hidden="true">↗</i>
        </article>)}
      </div>
    </section>

    <section className="about-end">
      <div className="about-end-glow" aria-hidden="true" />
      <p className="sub-eyebrow">One Network · Ensemble</p>
      <h2>Et si vos technologies<br /><em>travaillaient vraiment ensemble ?</em></h2>
      <p>Parlons de vos enjeux et imaginons une infrastructure à la hauteur de vos usages.</p>
      <a className="about-end-link" href="/contact">Échanger sur votre projet <span>↗</span></a>
    </section>

    <footer className="sub-footer">
      <span>ONE NETWORK</span><p>Building networks. Bridging solutions.</p><a href="/contact">Échanger sur un projet <span>↗</span></a>
    </footer>
  </main>;
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  return path === "/" || path === "/index.html" ? <NetworkCanvas /> : path === "/a-propos" ? <AboutPage /> : <SubPage path={path} />;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
