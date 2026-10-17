import React, { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import './immersive.css';

const expertise = [
  { id: 'network', n: '01', verb: 'CONNECTER', title: <>Réseaux &<br />infrastructures</>, body: 'Des fondations robustes pour relier les équipes, les sites et les applications.' },
  { id: 'cloud', n: '02', verb: 'HÉBERGER', title: <>Datacenter<br />& cloud</>, body: 'Des environnements performants, disponibles et dimensionnés pour évoluer.' },
  { id: 'cyber', n: '03', verb: 'PROTÉGER', title: <>Cybersécurité</>, body: 'La sécurité intégrée dès la conception, pour réduire les risques et renforcer la résilience.' },
  { id: 'buildings', n: '04', verb: 'INTÉGRER', title: <>Systèmes &<br />bâtiments connectés</>, body: 'La convergence des systèmes physiques et numériques au service des lieux.' },
];

function Arrow({ diagonal = false }) {
  return <svg className="onx-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d={diagonal ? 'M6 18 18 6M7 6h11v11' : 'M4 12h15m-6-6 6 6-6 6'} /></svg>;
}

function NetworkField() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return undefined;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const nodes = Array.from({ length: 48 }, (_, i) => ({
      x: (i % 8) / 7, y: Math.floor(i / 8) / 5,
      dx: (Math.random() - .5) * .012, dy: (Math.random() - .5) * .012,
      r: i % 7 === 0 ? 2.5 : 1.1, phase: Math.random() * 6.28
    }));
    let width = 0, height = 0, dpr = 1, raf = 0, t = 0, pointer = { x: .72, y: .48 }, disposed = false;
    const resize = () => {
      const box = canvas.getBoundingClientRect();
      width = box.width; height = box.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    };
    const move = (event) => { pointer = { x: event.clientX / Math.max(1, window.innerWidth), y: event.clientY / Math.max(1, window.innerHeight) }; };
    const draw = () => {
      if (disposed || !width || !height) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, width, height); t += .006;
      const pts = nodes.map((node, i) => {
        const drift = reduced.matches ? 0 : Math.sin(t + node.phase) * 8;
        return { x: node.x * width + drift + (pointer.x - .5) * width * .035, y: node.y * height + Math.cos(t + node.phase) * (reduced.matches ? 0 : 8) + (pointer.y - .5) * height * .025, r: node.r, phase: node.phase, i };
      });
      pts.forEach((a, i) => {
        pts.slice(i + 1).forEach((b) => {
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < Math.min(width * .19, 220)) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = 'rgba(179,198,235,' + ((1 - d / Math.min(width * .19, 220)) * .16) + ')'; ctx.lineWidth = .7; ctx.stroke();
          }
        });
      });
      pts.forEach((p) => {
        const pulse = reduced.matches ? 1 : .7 + .3 * Math.sin(t * 1.8 + p.phase);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * pulse, 0, Math.PI * 2);
        ctx.fillStyle = p.i % 7 === 0 ? 'rgba(255,202,151,.9)' : 'rgba(218,228,248,.5)'; ctx.fill();
        if (p.i % 7 === 0) {
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 26);
          glow.addColorStop(0, 'rgba(255,190,120,.18)'); glow.addColorStop(1, 'rgba(255,190,120,0)');
          ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill();
        }
      });
      if (!reduced.matches) raf = requestAnimationFrame(draw);
    };
    resize(); draw();
    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    return () => { disposed = true; cancelAnimationFrame(raf); window.removeEventListener('resize', resize); window.removeEventListener('pointermove', move); };
  }, []);
  return <canvas className="onx-network" ref={ref} aria-hidden="true" />;
}

function App() {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const reveals = [...document.querySelectorAll('.onx-reveal')];
    if (reduced || !('IntersectionObserver' in window)) reveals.forEach((el) => el.classList.add('onx-visible'));
    const observer = !reduced && 'IntersectionObserver' in window ? new IntersectionObserver((entries) => entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('onx-visible'); observer.unobserve(entry.target); }
    }), { threshold: .14, rootMargin: '0px 0px -35px 0px' }) : null;
    reveals.forEach((el) => observer?.observe(el));
    const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
    if (!reduced) intro.fromTo('.onx-nav, .onx-eyebrow, .onx-title-line, .onx-lede, .onx-actions, .onx-hero-meta', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 1, stagger: .12, clearProps: 'all' });
    const cards = [...document.querySelectorAll('.onx-expertise')];
    cards.forEach((card) => {
      const enter = () => gsap.to(card, { y: -5, borderColor: 'rgba(255,198,140,.46)', duration: .28, overwrite: true });
      const leave = () => gsap.to(card, { y: 0, borderColor: 'rgba(255,255,255,.12)', duration: .38, overwrite: true });
      card.addEventListener('pointerenter', enter); card.addEventListener('pointerleave', leave);
      card._onxCleanup = () => { card.removeEventListener('pointerenter', enter); card.removeEventListener('pointerleave', leave); };
    });
    return () => { observer?.disconnect(); intro.kill(); cards.forEach((card) => card._onxCleanup?.()); gsap.killTweensOf(cards); };
  }, []);

  return <div className="onx-shell" id="top">
    <div className="onx-atmosphere" aria-hidden="true" /><NetworkField />
    <header className="onx-nav">
      <a className="onx-logo" href="#top">One network<span>.</span></a>
      <nav aria-label="Navigation principale"><a href="#approche">Approche</a><a href="#expertises">Expertises</a><a href="#methode">Méthode</a><a href="#secteurs">Secteurs</a></nav>
      <a className="onx-nav-cta" href="#contact">Parlons projet <span><Arrow /></span></a>
    </header>

    <main>
      <section className="onx-hero">
        <div className="onx-hero-copy">
          <p className="onx-eyebrow"><i /> Infrastructures & solutions TIC</p>
          <h1 className="onx-title"><span className="onx-title-line">Relier le présent.</span><span className="onx-title-line onx-title-accent">Préparer demain.</span></h1>
          <p className="onx-lede">Des infrastructures technologiques pensées comme un tout : connectées, résilientes et prêtes à évoluer avec vos ambitions.</p>
          <div className="onx-actions"><a className="onx-round-cta" href="#expertises" aria-label="Explorer nos expertises"><Arrow /></a><a href="#expertises">Explorer nos expertises</a><span className="onx-action-rule" /><span className="onx-action-note">Un partenaire. Une vision.</span></div>
          <div className="onx-hero-meta"><span><i /> CONCEPTION · INTÉGRATION · CONTINUITÉ</span><a href="#approche">Défiler <span>↓</span></a></div>
        </div>
        <div className="onx-hero-art" aria-label="Réseau de systèmes interconnectés">
          <div className="onx-art-ring ring-1" /><div className="onx-art-ring ring-2" /><div className="onx-art-ring ring-3" />
          <div className="onx-art-core"><span>ON</span><small>ONE NETWORK</small></div>
          <span className="onx-art-chip chip-1">RÉSEAUX <i /></span><span className="onx-art-chip chip-2">CLOUD <i /></span><span className="onx-art-chip chip-3">CYBER <i /></span><span className="onx-art-chip chip-4">IOT <i /></span>
          <div className="onx-art-caption"><span>01 — 04</span><span>UNE INFRASTRUCTURE COHÉRENTE</span></div>
        </div>
        <div className="onx-hero-bottom"><span>01 / 05</span><span className="onx-bottom-line" /><span>CONNECTER LES POINTS, DONNER DU SENS.</span></div>
      </section>

      <div className="onx-marquee" aria-hidden="true"><div>CONNECTER <b>✳</b> SÉCURISER <b>✳</b> INTÉGRER <b>✳</b> FAIRE ÉVOLUER <b>✳</b> CONNECTER <b>✳</b> SÉCURISER <b>✳</b> INTÉGRER <b>✳</b> FAIRE ÉVOLUER <b>✳</b></div></div>

      <section className="onx-approach onx-wrap" id="approche">
        <div className="onx-section-label onx-reveal"><span>01</span><i /> NOTRE APPROCHE</div>
        <div className="onx-approach-grid">
          <h2 className="onx-reveal">Tout est lié.<br /><em>Nous aussi.</em></h2>
          <div className="onx-approach-copy onx-reveal"><p className="onx-overline">La technologie ne devrait jamais être un ensemble de silos.</p><p>Réseaux, cloud, cybersécurité et environnements connectés : nous faisons dialoguer les briques essentielles de votre système d’information pour créer une infrastructure plus lisible, plus fiable et prête pour la suite.</p><a className="onx-text-link" href="#expertises">Voir comment nous connectons les expertises <Arrow /></a></div>
        </div>
        <div className="onx-principles onx-reveal"><div><span>01</span><strong>Une vision globale</strong><p>Comprendre les dépendances, pas seulement les composants.</p></div><div><span>02</span><strong>Une intégration maîtrisée</strong><p>Faire travailler les systèmes ensemble, avec méthode.</p></div><div><span>03</span><strong>Une évolution durable</strong><p>Construire aujourd’hui sans fermer les options de demain.</p></div></div>
      </section>

      <section className="onx-expertises onx-wrap" id="expertises">
        <div className="onx-section-head onx-reveal"><div><div className="onx-section-label"><span>02</span><i /> NOS EXPERTISES</div><h2>Les bonnes briques.<br /><em>Ensemble.</em></h2></div><p>Des compétences complémentaires, orchestrées autour de vos usages, de vos contraintes et de vos objectifs.</p></div>
        <div className="onx-expertise-grid">{expertise.map((item) => <article className="onx-expertise onx-reveal" key={item.id}><div className="onx-expertise-top"><span>{item.n} / {item.verb}</span><span className={'onx-glyph glyph-' + item.id}>{item.id === 'network' ? <><i/><i/><i/><i/><i/></> : item.id === 'cloud' ? <svg viewBox="0 0 72 60"><path d="M17 44h38a12 12 0 0 0 0-24 19 19 0 0 0-36-4 14 14 0 0 0-2 28Z"/><path d="M36 27v22m-8-8 8 8 8-8"/></svg> : item.id === 'cyber' ? <svg viewBox="0 0 72 60"><path d="M36 7 56 15v13c0 13-8 21-20 27C24 49 16 41 16 28V15Z"/><path d="m27 30 6 6 13-14"/></svg> : <svg viewBox="0 0 72 60"><path d="M13 52V17l23-9v44M36 52V26l23-9v35M7 52h58"/><path d="M21 24h6m-6 9h6m-6 9h6m17-10h6m-6 9h6"/></svg>}</span></div><h3>{item.title}</h3><p>{item.body}</p><a href="#contact" aria-label={'Discuter de ' + item.verb.toLowerCase()}><Arrow diagonal /></a><span className="onx-card-corner" /></article>)}</div>
      </section>

      <section className="onx-method" id="methode"><div className="onx-wrap"><div className="onx-section-label onx-reveal"><span>03</span><i /> NOTRE MÉTHODE</div><div className="onx-method-grid"><h2 className="onx-reveal">Du besoin<br />à la <em>maîtrise.</em></h2><div className="onx-steps">{[['01','Comprendre','Cartographier l’existant, écouter les équipes et clarifier les priorités.'],['02','Concevoir','Définir une architecture cohérente, réaliste et évolutive.'],['03','Déployer','Intégrer avec méthode, en gardant la continuité d’activité au centre.'],['04','Faire évoluer','Accompagner les usages et adapter l’infrastructure dans le temps.']].map(([n,title,body]) => <article className="onx-step onx-reveal" key={n}><span>{n}</span><div><h3>{title}</h3><p>{body}</p></div><b>↗</b></article>)}</div></div></div></section>

      <section className="onx-sectors onx-wrap" id="secteurs"><div className="onx-section-head onx-reveal"><div><div className="onx-section-label"><span>04</span><i /> NOS ENVIRONNEMENTS</div><h2>Des contextes<br /><em>qui comptent.</em></h2></div><p>Une approche adaptée aux organisations où la disponibilité, la sécurité et la continuité ne sont pas négociables.</p></div><div className="onx-sector-grid"><article className="onx-sector onx-reveal"><span>01 / ENVIRONNEMENTS CRITIQUES</span><div className="onx-sector-art art-industry"><i/><i/><i/><b/></div><h3>Industrie & opérations <Arrow diagonal /></h3></article><article className="onx-sector onx-reveal"><span>02 / ESPACES DE TRAVAIL</span><div className="onx-sector-art art-office"><i/><i/><i/><b/></div><h3>Entreprises & tertiaire <Arrow diagonal /></h3></article><article className="onx-sector onx-reveal"><span>03 / SYSTÈMES CONNECTÉS</span><div className="onx-sector-art art-systems"><i/><i/><i/><b/></div><h3>Infrastructures distribuées <Arrow diagonal /></h3></article></div></section>

      <section className="onx-contact" id="contact"><div className="onx-contact-orbit" aria-hidden="true" /><div className="onx-wrap onx-contact-inner onx-reveal"><div className="onx-section-label"><span>05</span><i /> ET MAINTENANT ?</div><p className="onx-overline">Chaque infrastructure commence par une conversation.</p><h2>Construisons<br /><em>la suite.</em></h2><p className="onx-contact-copy">Un projet à structurer, un environnement à sécuriser ou une infrastructure à faire évoluer ? Parlons de vos enjeux.</p><a className="onx-contact-cta" href="#contact-info">Définir votre besoin <span><Arrow /></span></a><div className="onx-contact-info" id="contact-info"><span><i /> DISPONIBLE POUR ÉCHANGER</span><span>One Network · Infrastructures & solutions TIC</span><a href="#top">Retour en haut ↑</a></div></div></section>
    </main>
    <footer className="onx-footer"><a className="onx-logo" href="#top">One network<span>.</span></a><span>Connecter. Sécuriser. Faire évoluer.</span><span>© {new Date().getFullYear()} One Network</span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
