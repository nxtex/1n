import React, { useEffect, useRef, useState } from 'react';
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
  const [synotecOpen, setSynotecOpen] = useState(false);
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
      // Contact CTA stays fixed; motion remains enabled for other interactive elements.
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
          gsap.to(card.querySelector('.bar'), { scaleX: 1.75, transformOrigin: '0 50%', duration: 0.6 });
        });
        listen(card, 'pointerleave', () => {
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

  return <><div className="page" ref={pageRef}>
    <canvas id="net" ref={canvasRef} aria-hidden="true" />
    <div className="vignette" />
    <div className="stage">
      <header className="glass nav">
        <a className="logo" href="#accueil" aria-label="One network, accueil">One network.</a>
        <ul className="links">
          <li><a href="#accueil" aria-current="page">Accueil</a></li>
          <li><a href="#a-propos-section">À propos</a></li>
          <li><a href="#expertise-details">Expertises</a></li>
          <li><a href="#secteurs-detail">Secteurs</a></li>
          <li><a href="#partenaires">Partenaires</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
        <a className="cta" href="#contact">Nous contacter <span className="dot"><Icon /></span></a>
      </header>

      <section className="hero" id="accueil">
        <p className="eyebrow">Infrastructures &amp; solutions TIC</p>
        <h1><span className="ln"><span>Des infrastructures</span></span><span className="ln"><span>pour demain.</span></span></h1>
        <p className="lede">Concevoir, déployer et accompagner des infrastructures performantes, sécurisées et évolutives.</p>
        <div className="actions">
          <a className="btn-round" href="#expertise-details" aria-label="Découvrir nos expertises"><Icon /></a>
          <a className="label" href="#expertise-details">Découvrir nos expertises</a>
          <span className="rule" />
          <a className="video" href="#accueil">Voir la vidéo</a>
          <a className="play" href="#accueil" aria-label="Voir la vidéo"><Icon name="play" /></a>
        </div>
        <div className="scroll" aria-label="Défiler vers le bas">
          <svg viewBox="0 0 28 28" aria-hidden="true"><circle cx="14" cy="14" r="12.5"/><path d="M14 7.5v12M9.5 15l4.5 4.5 4.5-4.5"/></svg>
          <span>SCROLL</span>
        </div>
      </section>

      <button className="glass card synotec-card" type="button" onClick={() => setSynotecOpen(true)} aria-label="En savoir plus sur Synotec" aria-haspopup="dialog">
        <div className="thumb" aria-hidden="true" />
        <span className="plus synotec-mark" aria-hidden="true"><Icon name="plus" /></span>
        <span className="synotec-kicker">L’ÉCOSYSTÈME ONE NETWORK</span>
        <h2>Smart Network<br />Security Solutions</h2>
        <span className="sub">En savoir plus <span aria-hidden="true">↗</span></span>
        <span className="bar" />
      </button>

      <nav className="glass services" id="expertises" aria-label="Expertises">
        <a className="svc s1" href="#reseaux"><span className="n">01</span><span className="t">Réseaux &amp;<br />infrastructures</span><span className="go"><Icon /></span></a>
        <i className="sep a" />
        <a className="svc s2" href="#datacenter"><span className="n">02</span><span className="t">Datacenter &amp;<br />virtualisation</span><span className="go"><Icon /></span></a>
        <i className="sep b" />
        <a className="svc s3 one-line" href="#cyber"><span className="n">03</span><span className="t">Cybersécurité</span><span className="go"><Icon /></span></a>
        <i className="sep c" />
        <a className="svc s4" href="#batiments"><span className="n">04</span><span className="t">Sécurité électronique<br />&amp; bâtiments</span><span className="go"><Icon /></span></a>
        <i className="sep d" />
        <a className="all" href="#secteurs-detail" id="secteurs"><span className="plus2"><Icon name="plus" /></span><span className="txt">Tous nos<br />secteurs</span></a>
      </nav>

      <footer className="foot">
        <div className="vline" aria-hidden="true" />
        <i className="spark" />
        <i className="hr l" />
        <a className="trust" href="#partenaires-detail" id="partenaires">
          <span className="avatars" aria-hidden="true">
            <svg viewBox="0 0 36 36" role="img"><circle cx="18" cy="18" r="18" fill="#171717"/><path d="M8 25V11h4l6 8 6-8h4v14h-4v-8l-6 7-6-7v8z" fill="#fff"/></svg>
            <svg viewBox="0 0 36 36" role="img"><circle cx="18" cy="18" r="18" fill="#555"/><path d="M9 9h18v4H13v4h11v4H13v2h14v4H9z" fill="#fff"/></svg>
            <svg viewBox="0 0 36 36" role="img"><circle cx="18" cy="18" r="18" fill="#888"/><path d="M18 6l11 6v12l-11 6-11-6V12zm0 4.5L11 14v8l7 3.8 7-3.8v-8z" fill="#fff"/><path d="M16 14h4v8h-4z" fill="#fff"/></svg>
          </span>
          <span className="txt">Ils nous font confiance</span>
          <span className="chev"><Icon name="chev" /></span>
        </a>
        <i className="hr r" />
        <p className="brand"><b>ONE NETWORK</b><span>Building networks.<br />Bridging solutions.</span></p>
      </footer>
    </div>
  </div>
  <AboutPage embedded />
  <ExpertisePage embedded includeContact={false} />
  <SectorsPage />
  <ContactPage />
  {synotecOpen && <div className="synotec-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSynotecOpen(false); }}>
    <section className="synotec-modal" role="dialog" aria-modal="true" aria-labelledby="synotec-modal-title">
      <button className="synotec-modal-close" type="button" onClick={() => setSynotecOpen(false)} aria-label="Fermer la fenêtre">×</button>
      <p className="synotec-modal-kicker">L'ÉCOSYSTÈME ONE NETWORK</p>
      <h2 id="synotec-modal-title">Synotec<span>.</span></h2>
      <p>Synotec est la société de distribution liée à l’écosystème One Network. Elle complète l’activité d’intégration en portant le volet distribution des solutions.</p>
      <div className="synotec-modal-divider" />
      <p className="synotec-modal-note">Smart Network and Security Solutions</p>
      <button className="synotec-modal-action" type="button" onClick={() => setSynotecOpen(false)}>J’ai compris <span aria-hidden="true">↗</span></button>
    </section>
  </div>}
</>;
}


function AboutPage({ embedded = false }) {
  return <main id={embedded ? "a-propos-section" : undefined} className={embedded ? "subpage original-page singlepage-section" : "subpage original-page"}>
    <section className="sub-hero">
      <p className="sub-eyebrow">À propos</p>
      <h1>One Network,<br />à vos côtés.</h1>
      <p className="sub-intro">Un partenaire unique pour vos infrastructures technologiques.</p>
      <nav className="original-jump" aria-label="Dans cette page">
        <a href="#qui-nous-sommes">Qui nous sommes <span>↘</span></a>
        <a href="#notre-maniere">Notre manière de travailler <span>↘</span></a>
        <a href="#partenaire-unique">Un partenaire unique <span>↘</span></a>
        <a href="#contact">Parlons de votre projet <span>↘</span></a>
      </nav>
    </section>
    <section className="original-content" id="qui-nous-sommes">
      <p className="sub-eyebrow">One Network</p>
      <h2>Qui nous sommes.</h2>
      <p>One Network est spécialisé dans l’intégration de solutions informatiques et de communication, la cybersécurité, les infrastructures de centres de données et l’automatisation des bâtiments.</p>
      <p>Nous accompagnons les entreprises, les acteurs industriels et les institutions dans la conception, le déploiement et la maintenance de leurs infrastructures. Notre démarche associe analyse des besoins, ingénierie et mise en œuvre technique.</p>
      <a className="about-text-link" href="#expertise-details">Découvrir nos expertises <span>↗</span></a>
      <div className="original-pill-grid">
        <article><span>01</span><h3>Solutions informatiques et de communication</h3></article>
        <article><span>02</span><h3>Cybersécurité</h3></article>
        <article><span>03</span><h3>Infrastructures de centres de données</h3></article>
        <article><span>04</span><h3>Automatisation des bâtiments</h3></article>
      </div>
    </section>
    <section className="original-content" id="notre-maniere">
      <p className="sub-eyebrow">À vos côtés</p>
      <h2>Notre manière de travailler.</h2>
      <div className="original-method-grid">
        <article><span>01</span><h3>Comprendre</h3><p>Comprendre vos priorités avant de proposer une solution.</p></article>
        <article><span>02</span><h3>Adapter</h3><p>Adapter les choix techniques à votre environnement.</p></article>
        <article><span>03</span><h3>Soigner</h3><p>Soigner l’installation et l’intégration.</p></article>
        <article><span>04</span><h3>Poursuivre</h3><p>Poursuivre l’accompagnement après le déploiement.</p></article>
      </div>
    </section>
    <section className="original-content original-highlight" id="partenaire-unique">
      <p className="sub-eyebrow">Un partenaire unique</p>
      <h2>Un partenaire unique pour vos infrastructures technologiques.</h2>
      <p>Nous concevons, déployons et maintenons les solutions qui connectent vos équipes, protègent vos données et accompagnent l’évolution de vos installations.</p>
      <p>Réseaux, cybersécurité, serveurs, centres de données et bâtiments : nous réunissons plusieurs expertises pour vous accompagner tout au long de votre projet.</p>
    </section>
  </main>;
}

function SectorsPage() {
  const sectors = ["Entreprises", "Industrie", "Administrations", "Santé", "Éducation", "Banque et finance", "Commerce et distribution", "Énergie et services aux collectivités", "Hôtellerie", "Infrastructures et construction"];
  return <main id="secteurs-detail" className="subpage original-page singlepage-section">
    <section className="sub-hero">
      <p className="sub-eyebrow">Secteurs</p>
      <h1>Nos secteurs<br />d’activité.</h1>
      <p className="sub-intro">Nous accompagnons les entreprises, les acteurs industriels et les institutions dans la conception, le déploiement et la maintenance de leurs infrastructures.</p>
    </section>
    <section className="original-sector-grid" aria-label="Nos secteurs d’activité">
      {sectors.map((sector, index) => <article className="original-sector" key={sector}><span>{String(index + 1).padStart(2, "0")}</span><h2>{sector}</h2></article>)}
    </section>
    <p className="original-section-link"><a href="#expertise-details">Découvrir nos expertises <span>↗</span></a></p>
  </main>;
}

function ContactPage() {
  const [copied, setCopied] = useState("");
  const [submitted, setSubmitted] = useState(false);
  async function copyValue(value) {
    try { await navigator.clipboard.writeText(value); setCopied(value); window.setTimeout(() => setCopied(""), 1600); } catch { setCopied(""); }
  }
  function submitContact(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const domains = data.getAll("domaines");
    const body = [
      `Nom : ${data.get("nom")}`,
      `Société : ${data.get("societe") || "—"}`,
      `E-mail : ${data.get("email")}`,
      `Projet : ${data.get("projet")}`,
      `Domaines : ${domains.join(", ") || "—"}`,
      "",
      data.get("message"),
    ].join("\n");
    setSubmitted(true);
    window.location.href = `mailto:contact@onenetwork.dz?subject=${encodeURIComponent("Demande de contact — One Network")}&body=${encodeURIComponent(body)}`;
  }
  return <main id="contact" className="subpage original-page singlepage-section">
    <section className="contact-page-intro">
      <p className="sub-eyebrow">Contact</p>
      <h2>Parlons de votre projet.</h2>
      <p>Nouvelle installation, modernisation d’un site ou évolution de vos infrastructures : contactez-nous pour échanger sur vos besoins.</p>
    </section>
    <section className="contact-page-layout" aria-label="Coordonnées et formulaire de contact">
      <aside className="contact-page-side">
        <div className="contact-page-card">
          <span className="contact-page-label">E-mail</span>
          <a href="mailto:contact@onenetwork.dz">contact@onenetwork.dz</a>
          <button type="button" onClick={() => copyValue("contact@onenetwork.dz")}>{copied === "contact@onenetwork.dz" ? "Copié" : "Copier l’e-mail"}</button>
        </div>
        <div className="contact-page-card">
          <span className="contact-page-label">Site web</span>
          <a href="https://www.onenetwork.dz">www.onenetwork.dz</a>
          <button type="button" onClick={() => copyValue("https://www.onenetwork.dz")}>{copied === "https://www.onenetwork.dz" ? "Copié" : "Copier le lien"}</button>
        </div>
        <p className="contact-page-note">Le formulaire prépare un e-mail dans votre application de messagerie. Votre message n’est pas envoyé automatiquement depuis le site.</p>
      </aside>
      <form className="contact-page-form" onSubmit={submitContact}>
        <div className="contact-page-fields">
          <div className="contact-page-row">
            <label>Nom *<input name="nom" type="text" autoComplete="name" placeholder="Votre nom" required /></label>
            <label>Société<input name="societe" type="text" autoComplete="organization" placeholder="Votre organisation" /></label>
          </div>
          <label>E-mail *<input name="email" type="email" autoComplete="email" placeholder="vous@exemple.com" required /></label>
          <fieldset>
            <legend>Votre projet</legend>
            <div className="contact-page-pills">
              {["Nouvelle installation", "Modernisation d’un site", "Évolution de vos infrastructures", "Autre"].map((v, i) => <label key={v}><input type="radio" name="projet" value={v} defaultChecked={i === 0} /><span>{v}</span></label>)}
            </div>
          </fieldset>
          <fieldset>
            <legend>Domaines concernés</legend>
            <div className="contact-page-pills">
              {["Réseaux et communications", "Serveurs, stockage et sauvegarde", "Cybersécurité", "Infrastructures de centres de données", "Sûreté et automatisation des bâtiments"].map(v => <label key={v}><input type="checkbox" name="domaines" value={v} /><span>{v}</span></label>)}
            </div>
          </fieldset>
          <label>Message *<textarea name="message" placeholder="Décrivez votre besoin, votre site, vos contraintes." required /></label>
          <button className="contact-page-submit" type="submit">Préparer le message <Icon /></button>
          {submitted && <p className="contact-page-status" role="status">Votre application de messagerie devrait s’ouvrir. Vérifiez le message avant de l’envoyer.</p>}
        </div>
      </form>
    </section>
  </main>;
}

function ExpertisePage({ embedded = false, includeContact = true }) {
  const domains = [
    { id: "reseaux", number: "01", title: "Réseaux et communications", icon: "⌁", items: ["Réseaux LAN, WAN et Wi-Fi", "Infrastructure de câblage", "Téléphonie IP et communications unifiées", "Salles de réunion et visioconférence"] },
    { id: "serveurs", number: "02", title: "Serveurs, stockage et sauvegarde", icon: "▤", items: ["Infrastructures serveurs et virtualisation", "Stockage SAN et NAS", "Sauvegarde et protection des données"] },
    { id: "cyber", number: "03", title: "Cybersécurité", icon: "◇", items: ["Protection des réseaux par des pare-feu de nouvelle génération et des VPN", "Protection des utilisateurs", "Sécurisation des postes de travail et des terminaux"] },
    { id: "datacenter", number: "04", title: "Infrastructures de centres de données", icon: "▥", items: ["Aménagement des salles informatiques", "Distribution électrique", "Refroidissement et supervision de l’environnement technique"] },
  ];
  const buildingGroups = [
    { title: "Sûreté", items: ["Vidéosurveillance", "Contrôle d’accès", "Détection d’intrusion", "Interphonie"] },
    { title: "Incendie", items: ["Détection incendie", "Systèmes d’alarme vocale pour l’évacuation"] },
    { title: "Bâtiment intelligent", items: ["Gestion technique des bâtiments (GTB et GTC)", "Comptage intelligent", "Gestion de l’éclairage"] },
  ];
  const steps = [
    { number: "01", title: "Comprendre", text: "Nous analysons vos besoins et votre environnement technique. Les audits, les études et les échanges avec vos équipes permettent de définir les bases du projet." },
    { number: "02", title: "Concevoir", text: "Nous réalisons les études d’ingénierie, définissons l’architecture de la solution et préparons la documentation technique." },
    { number: "03", title: "Réaliser", text: "Nous installons, configurons et intégrons les équipements et les solutions retenus." },
    { number: "04", title: "Maintenir et faire évoluer", text: "Nous assurons la maintenance préventive et corrective ainsi que le support technique pour accompagner vos installations dans la durée." },
  ];

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const items = document.querySelectorAll('.expertise-page .expertise-reveal');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('is-visible'));
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -35px 0px' });
    items.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  return <main id={embedded ? "expertise-details" : undefined} className={embedded ? "subpage expertise-page singlepage-section" : "subpage expertise-page"}>
    <div className="expertise-atmosphere" aria-hidden="true" />
    {!embedded && <header className="sub-nav">
      <a className="sub-logo" href="/">One network.</a>
      <nav aria-label="Navigation principale">
        <a href="/">Accueil</a>
        <a href="/a-propos">À propos</a>
        <a href="/expertises" aria-current="page">Expertises</a>
        <a href="/secteurs">Secteurs</a>
        <a href="/partenaires">Partenaires</a>
        <a className="sub-contact" href="/contact">Nous contacter <span><Icon /></span></a>
      </nav>
    </header>}

    <section className="expertise-hero">
      <div className="expertise-hero-copy">
        <p className="expertise-kicker"><span /> Nos expertises</p>
        <h1>Des domaines<br /><em>d’expertise.</em></h1>
        <p className="expertise-intro">Des expertises complémentaires pour concevoir une solution adaptée à votre environnement.</p>
      </div>
      <aside className="expertise-jump">
        <p>Du bâtiment au cloud</p>
        {domains.map((domain) => <a href={'#' + domain.id} key={domain.id}>{domain.title}<span>↘</span></a>)}
        <a href="#batiments">Sûreté et automatisation des bâtiments<span>↘</span></a>
      </aside>
      <div className="expertise-hero-foot"><span>ONE NETWORK / EXPERTISES</span><span>CONNECTER · PROTÉGER · FAIRE ÉVOLUER</span></div>
    </section>

    <section className="expertise-domains" aria-label="Domaines d’expertise">
      {domains.map((domain, index) => <article className={'expertise-domain expertise-reveal' + (index === 3 ? ' domain-four' : '')} id={domain.id} key={domain.id}>
        <div className="expertise-domain-heading">
          <span className="expertise-domain-icon" aria-hidden="true">{domain.icon}</span>
          <div><span className="expertise-domain-number">{domain.number} / 05</span><h2>{domain.title}</h2></div>
        </div>
        <ul>{domain.items.map((item) => <li key={item}>{item}</li>)}</ul>
      </article>)}
      <article className="expertise-domain expertise-domain-wide expertise-reveal" id="batiments">
        <div className="expertise-domain-heading">
          <span className="expertise-domain-icon" aria-hidden="true">⌂</span>
          <div><span className="expertise-domain-number">05 / 05</span><h2>Sûreté et automatisation des bâtiments</h2></div>
        </div>
        <div className="expertise-building-groups">
          {buildingGroups.map((group) => <div key={group.title}><h3>{group.title}</h3><ul>{group.items.map((item) => <li key={item}>{item}</li>)}</ul></div>)}
        </div>
      </article>
    </section>

    <section className="expertise-method">
      <div className="expertise-section-heading expertise-reveal">
        <p className="expertise-kicker"><span /> Notre accompagnement</p>
        <h2>Du besoin à la<br /><em>maintenance.</em></h2>
        <p>Nous vous accompagnons à chaque étape : comprendre votre besoin, concevoir la solution, la mettre en place et la maintenir dans la durée.</p>
      </div>
      <div className="expertise-steps">
        {steps.map((step) => <article className="expertise-step expertise-reveal" key={step.number}>
          <span>{step.number}</span><h3>{step.title}</h3><p>{step.text}</p>
        </article>)}
      </div>
    </section>

    <section className="expertise-choice expertise-reveal">
      <div><p className="expertise-kicker"><span /> Approche multi-constructeurs</p><h2>Un choix technologique<br /><em>adapté au projet.</em></h2></div>
      <p>Notre approche multi-constructeurs nous permet de sélectionner les technologies selon vos besoins et vos contraintes, plutôt que de nous limiter à un fournisseur unique.</p>
    </section>

    {includeContact && <section className="expertise-contact" id="contact">
      <div className="expertise-contact-copy">
        <p className="expertise-kicker"><span /> Contact</p>
        <h2>Parlons de<br /><em>votre projet.</em></h2>
        <p>Nouvelle installation, modernisation d’un site ou évolution de vos infrastructures : contactez-nous pour échanger sur vos besoins.</p>
      </div>
      <div className="expertise-contact-details">
        <div><span>E-mail</span><a href="mailto:contact@onenetwork.dz">contact@onenetwork.dz</a></div>
        <div><span>Site web</span><a href="https://www.onenetwork.dz">www.onenetwork.dz</a></div>
      </div>
    </section>}

    {!embedded && <footer className="sub-footer expertise-footer">
      <span>ONE NETWORK</span><p>Building networks. Bridging solutions.</p><a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>Haut de page <span>↑</span></a>
    </footer>}
  </main>;
}

function App() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const finishLoading = (event) => {
      if (event.origin !== window.location.origin || event.data?.type !== "one-network-loader-finished") return;
      setLoading(false);
    };
    const fallback = window.setTimeout(() => setLoading(false), 8000);
    window.addEventListener("message", finishLoading);
    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("message", finishLoading);
    };
  }, []);

  useEffect(() => {
    const routeTargets = {
      "/a-propos": "a-propos-section",
      "/expertises": "expertise-details",
      "/expertises/reseaux": "reseaux",
      "/expertises/datacenter": "datacenter",
      "/expertises/cybersecurite": "cyber",
      "/expertises/batiments": "batiments",
      "/secteurs": "secteurs-detail",
      "/partenaires": "partenaires",
      "/contact": "contact",
    };
    const targetId = routeTargets[path];
    if (!targetId) return undefined;
    const timer = window.setTimeout(() => document.getElementById(targetId)?.scrollIntoView({ behavior: "auto", block: "start" }), 100);
    return () => window.clearTimeout(timer);
  }, [path]);

  return <>
    <NetworkCanvas />
    {loading && <div className="site-loader" aria-label="Chargement de One Network">
      <iframe src="/loading.html" title="Chargement de One Network" />
    </div>}
  </>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
