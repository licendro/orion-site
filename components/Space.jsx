'use client';

import { useEffect, useRef } from 'react';

// Fusée aux couleurs Orion (nez orange, hublot avec le logo), pointe vers la droite.
function Rocket() {
  return (
    <svg viewBox="0 0 200 80" width="200" height="80" aria-hidden="true">
      <defs>
        <linearGradient id="orn-flame" x1="1" x2="0" y1="0" y2="0">
          <stop offset="0" stopColor="#fff3d6" />
          <stop offset=".25" stopColor="#FF9A5C" />
          <stop offset=".7" stopColor="#FF7A2F" stopOpacity=".55" />
          <stop offset="1" stopColor="#FF7A2F" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="orn-hull" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset=".55" stopColor="#dfe3ea" />
          <stop offset="1" stopColor="#9aa0ad" />
        </linearGradient>
      </defs>
      <g className="flame"><path d="M58 40 L2 30 Q14 40 2 50 Z" fill="url(#orn-flame)" /><path d="M58 40 L22 35 Q30 40 22 45 Z" fill="#fff3d6" opacity=".9" /></g>
      <path d="M70 28 L52 12 L84 24 Z" fill="#FF7A2F" />
      <path d="M70 52 L52 68 L84 56 Z" fill="#FF7A2F" />
      <path d="M60 30 Q60 24 70 24 L140 24 Q178 26 192 40 Q178 54 140 56 L70 56 Q60 56 60 50 Z" fill="url(#orn-hull)" />
      <path d="M160 26.5 Q182 30 192 40 Q182 50 160 53.5 Q166 40 160 26.5 Z" fill="#FF7A2F" />
      <rect x="60" y="34" width="62" height="2" fill="#020306" opacity=".25" />
      <circle cx="132" cy="40" r="11" fill="#020306" stroke="#FF7A2F" strokeWidth="2" />
      <ellipse cx="132" cy="40" rx="9" ry="3.6" transform="rotate(-24 132 40)" fill="none" stroke="#EDEFF3" strokeWidth="1.2" />
      <circle cx="129" cy="41.5" r="1.4" fill="#EDEFF3" /><circle cx="132" cy="40" r="1.6" fill="#EDEFF3" /><circle cx="135" cy="38.5" r="1.4" fill="#EDEFF3" />
      <circle cx="135.5" cy="34.5" r="1.3" fill="#FF7A2F" />
      <text x="86" y="45" fontFamily="Michroma, sans-serif" fontSize="9" letterSpacing="2" fill="#020306">ORION</text>
    </svg>
  );
}

export default function SpaceLayer({ off }) {
  const canvas = useRef(null);
  const rocket = useRef(null);
  const cursor = useRef(null);

  useEffect(() => {
    if (off) return;
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(pointer: fine)').matches;
    const c = canvas.current;
    const g = c.getContext('2d');
    let W = 0, H = 0, D = 1, stars = [], shooting = [], trail = [], raf = 0, alive = true;
    let mx = -100, my = -100;

    const resize = () => {
      D = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      c.width = W * D; c.height = H * D;
      c.style.width = W + 'px'; c.style.height = H + 'px';
      const n = Math.min(260, Math.round((W * H) / 6500));
      stars = Array.from({ length: n }, () => {
        const m = Math.pow(Math.random(), 4);
        return { x: Math.random() * W, y: Math.random() * H, r: 0.3 + m * 1.3, a: 0.15 + m * 0.7, t: Math.random() * 6.28, s: 0.4 + Math.random() * 1.6, z: 0.15 + m * 0.6 };
      });
    };
    resize();
    addEventListener('resize', resize);

    // Étoile filante de temps en temps
    let nextShoot = performance.now() + 2500;
    const spawnShoot = () => {
      const fromTop = Math.random() < 0.7;
      const x = fromTop ? Math.random() * W * 0.9 + W * 0.1 : W + 20;
      const y = fromTop ? -20 : Math.random() * H * 0.5;
      const ang = Math.PI * (0.72 + Math.random() * 0.12); // vers le bas à gauche
      const v = 9 + Math.random() * 7;
      shooting.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life: 0, max: 60 + Math.random() * 40, len: 90 + Math.random() * 110 });
    };

    let scrollY0 = scrollY;
    const frame = (now) => {
      if (!alive) return;
      g.setTransform(D, 0, 0, D, 0, 0);
      g.clearRect(0, 0, W, H);
      const dy = (scrollY - scrollY0);
      for (const s of stars) {
        const tw = RM ? 1 : 0.65 + 0.35 * Math.sin(now / 1000 * s.s + s.t);
        let y = (s.y - dy * s.z * 0.15) % H; if (y < 0) y += H;
        g.globalAlpha = s.a * tw;
        g.fillStyle = s.r > 1.1 ? '#ffe9d9' : '#ffffff';
        g.beginPath(); g.arc(s.x, y, s.r, 0, 6.283); g.fill();
      }
      if (!RM) {
        if (now > nextShoot) { spawnShoot(); nextShoot = now + 4000 + Math.random() * 7000; }
        for (const sh of shooting) {
          sh.x += sh.vx; sh.y += sh.vy; sh.life++;
          const k = 1 - sh.life / sh.max;
          const n = Math.hypot(sh.vx, sh.vy);
          const tx = sh.x - (sh.vx / n) * sh.len, ty = sh.y - (sh.vy / n) * sh.len;
          const grad = g.createLinearGradient(sh.x, sh.y, tx, ty);
          grad.addColorStop(0, `rgba(255,255,255,${0.95 * k})`);
          grad.addColorStop(0.3, `rgba(255,190,150,${0.5 * k})`);
          grad.addColorStop(1, 'rgba(255,122,47,0)');
          g.globalAlpha = 1; g.strokeStyle = grad; g.lineWidth = 1.6; g.lineCap = 'round';
          g.beginPath(); g.moveTo(sh.x, sh.y); g.lineTo(tx, ty); g.stroke();
          g.fillStyle = `rgba(255,255,255,${k})`; g.beginPath(); g.arc(sh.x, sh.y, 1.6, 0, 6.283); g.fill();
        }
        shooting = shooting.filter((s) => s.life < s.max);
        // Poussière d'étoiles derrière le curseur
        if (fine) {
          for (const p of trail) {
            p.life++; p.y += p.vy; p.x += p.vx;
            g.globalAlpha = Math.max(0, 1 - p.life / 40) * 0.8;
            g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r, 0, 6.283); g.fill();
          }
          trail = trail.filter((p) => p.life < 40);
        }
      }
      if (!RM) sim(now);
      g.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };

    // ----- Fusée Orion : elle flâne dans les marges, à l'écart du texte, et esquive les astéroïdes -----
    const CONTENT = 1260;                     // largeur occupée par le contenu du site
    const gutter = () => Math.max(0, (W - CONTENT) / 2);
    const MIN_GUTTER = 150;                   // en dessous (téléphone, portable) : couloir étroit au bord de l'écran
    const wide = () => gutter() >= MIN_GUTTER;
    // Couloir de vol d'un côté : les marges sur grand écran, une bande de 26 px au bord sinon.
    const lane = (side) => {
      const gw = gutter();
      const [a, b2] = wide() ? [30, gw - 30] : [8, 30];
      return side < 0 ? [a, b2] : [W - b2, W - a];
    };
    let rocks = [];
    const makeRock = (side, y) => {
      const r = wide() ? 7 + Math.random() * 16 : 3 + Math.random() * 4;
      const n = 7 + (Math.random() * 4 | 0);
      const pts = Array.from({ length: n }, (_, k) => { const a = (k / n) * 6.283; const d = r * (0.72 + Math.random() * 0.38); return [Math.cos(a) * d, Math.sin(a) * d]; });
      const [lo, hi] = lane(side);
      return { side, x: lo + Math.random() * (hi - lo), y: y ?? Math.random() * H,
        vx: (Math.random() - 0.5) * 0.15, vy: 0.08 + Math.random() * 0.25, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.01, r, pts };
    };
    const seedRocks = () => {
      rocks = [];
      const per = wide() ? Math.max(3, Math.round(H / 230)) : 2;
      for (const side of [-1, 1]) for (let k = 0; k < per; k++) rocks.push(makeRock(side));
    };
    seedRocks();
    addEventListener('resize', seedRocks);

    const ship = { on: false, x: 0, y: 0, vx: 0, vy: 0, heading: 0, wander: 0, side: -1, scale: 0.42, next: performance.now() + 4000 };
    const el = rocket.current;

    const launch = () => {
      if (document.hidden) { ship.next = performance.now() + 8000; return; }
      ship.side = Math.random() < 0.5 ? -1 : 1;
      const up = Math.random() < 0.6;
      const [l0, l1] = lane(ship.side);
      ship.x = (l0 + l1) / 2;
      ship.y = up ? H + 60 : -60;
      ship.heading = up ? -Math.PI / 2 : Math.PI / 2;
      ship.vx = 0; ship.vy = up ? -1.6 : 1.6;
      ship.wander = 0;
      ship.scale = wide() ? Math.min(0.5, (gutter() - 40) / 200) : 0.24;
      ship.on = true;
      if (el) el.style.display = 'block';
    };

    function sim(now) {
      // Astéroïdes
      {
        for (const r of rocks) {
          r.x += r.vx; r.y += r.vy; r.rot += r.vr;
          const [lo, hi] = lane(r.side);
          if (r.x < lo || r.x > hi) r.vx *= -1;
          if (r.y - r.r > H) Object.assign(r, makeRock(r.side, -r.r - 10));
          g.save(); g.translate(r.x, r.y); g.rotate(r.rot);
          g.beginPath(); r.pts.forEach(([px, py], k) => (k ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath();
          const sh = g.createRadialGradient(-r.r * 0.4, -r.r * 0.4, 1, 0, 0, r.r * 1.2);
          sh.addColorStop(0, '#4a4f5c'); sh.addColorStop(1, '#16181f');
          g.globalAlpha = 0.85; g.fillStyle = sh; g.fill();
          g.globalAlpha = 0.35; g.strokeStyle = '#7e8492'; g.lineWidth = 0.8; g.stroke();
          g.globalAlpha = 0.5; g.fillStyle = '#0b0c11';
          g.beginPath(); g.arc(r.r * 0.2, r.r * 0.1, r.r * 0.18, 0, 6.283); g.fill();
          g.restore();
        }
      }
      // Fusée
      if (!ship.on) {
        if (now > ship.next) launch();
        return;
      }
      // Errance : le cap tourne doucement au hasard
      ship.wander += (Math.random() - 0.5) * 0.35;
      ship.wander *= 0.96;
      let ax = Math.cos(ship.heading + ship.wander) * 0.06, ay = Math.sin(ship.heading + ship.wander) * 0.06;
      // Rester dans son couloir (sur petit écran, le cap reste presque vertical)
      const [lo, hi] = lane(ship.side);
      const pad = Math.min(25, (hi - lo) / 3);
      if (ship.x < lo + pad) ax += 0.12; if (ship.x > hi - pad) ax -= 0.12;
      if (!wide()) { ship.wander *= 0.8; ax *= 0.3; }
      // Esquive des astéroïdes
      for (const r of rocks) {
        const dx = ship.x - r.x, dy = ship.y - r.y, d = Math.hypot(dx, dy), safe = r.r + (wide() ? 70 : 30);
        if (d < safe && d > 0.1) { const f = ((safe - d) / safe) * 0.5; ax += (dx / d) * f; ay += (dy / d) * f; }
      }
      ship.vx = (ship.vx + ax) * 0.985; ship.vy = (ship.vy + ay) * 0.985;
      const sp = Math.hypot(ship.vx, ship.vy), max = 2.4, min = 0.9;
      if (sp > max) { ship.vx *= max / sp; ship.vy *= max / sp; }
      if (sp < min && sp > 0) { ship.vx *= min / sp; ship.vy *= min / sp; }
      ship.x = Math.min(hi, Math.max(lo, ship.x + ship.vx));
      ship.y += ship.vy;
      const ang = Math.atan2(ship.vy, ship.vx) * 180 / Math.PI;
      if (el) el.style.transform = `translate(${ship.x}px, ${ship.y}px) rotate(${ang}deg) scale(${ship.scale})`;
      if (ship.y < -140 || ship.y > H + 140) {
        ship.on = false; if (el) el.style.display = 'none';
        ship.next = now + 12000 + Math.random() * 18000;
      }
    }
    raf = requestAnimationFrame(frame);

    // Curseur spatial (souris uniquement)
    const cur = cursor.current;
    let cx = -100, cy = -100;
    const onMove = (e) => {
      mx = e.clientX; my = e.clientY;
      if (cur) cur.style.opacity = '1';
      if (!RM && Math.random() < 0.5) trail.push({ x: mx, y: my, vx: (Math.random() - 0.5) * 0.4, vy: 0.2 + Math.random() * 0.5, r: 0.5 + Math.random() * 1.1, life: 0, c: Math.random() < 0.3 ? '#FF9A5C' : '#ffffff' });
    };
    const onOver = (e) => {
      const hot = e.target.closest?.('a,button,[role=button],summary,select,label,input[type=checkbox],input[type=radio]');
      cur?.classList.toggle('hot', !!hot);
    };
    const onLeave = () => { if (cur) cur.style.opacity = '0'; };
    const onDown = () => cur?.classList.add('down');
    const onUp = () => cur?.classList.remove('down');
    let craf = 0;
    const follow = () => {
      cx += (mx - cx) * 0.22; cy += (my - cy) * 0.22;
      if (cur) cur.style.transform = `translate(${cx}px, ${cy}px)`;
      craf = requestAnimationFrame(follow);
    };
    if (fine) {
      document.documentElement.classList.add('orn-cursor');
      addEventListener('mousemove', onMove, { passive: true });
      addEventListener('mouseover', onOver, { passive: true });
      document.addEventListener('mouseleave', onLeave);
      addEventListener('mousedown', onDown); addEventListener('mouseup', onUp);
      craf = requestAnimationFrame(follow);
    }

    return () => {
      alive = false; cancelAnimationFrame(raf); cancelAnimationFrame(craf); removeEventListener('resize', seedRocks);
      removeEventListener('resize', resize); removeEventListener('mousemove', onMove); removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseleave', onLeave); removeEventListener('mousedown', onDown); removeEventListener('mouseup', onUp);
      document.documentElement.classList.remove('orn-cursor');
    };
  }, [off]);

  if (off) return null;
  return (
    <>
      <canvas ref={canvas} className="space-bg" aria-hidden="true" />
      <div className="space-nebula" aria-hidden="true" />
      <div ref={rocket} className="space-rocket" aria-hidden="true"><Rocket /></div>
      <div ref={cursor} className="space-cursor" aria-hidden="true"><i /><b /></div>
    </>
  );
}
