'use client';

import { useEffect } from 'react';

const COMPAT = ['ESX Legacy', 'QBCore', 'QBox', 'ox_inventory', 'qs-inventory', 'qb-inventory', 'ox_target', 'qb-target', 'lb-phone', 'qs-smartphone', 'ps-dispatch', 'cd_dispatch', 'illenium-appearance', 'LegacyFuel', 'ox_fuel', 'wasabi_carlock'];
const NOTIFS = [
  ['Véhicule rangé', 'Übermacht Sentinel est au garage.'],
  ['Virement reçu', '+2 500 $ sur votre compte.'],
  ['Fourrière', 'Karin Sultan RS · 450 $ à régler.', 1],
  ['SMS · Lucas', "On t'attend au Bahama Mamas."],
  ['Facture payée', "Benny's Motorworks · 890 $"],
];

export function CompatTrack() {
  return (
    <div className="compat" aria-label="Compatibilités">
      <div className="track">
        {[...COMPAT, ...COMPAT].map((x, i) => <span key={i}>{x}</span>)}
      </div>
    </div>
  );
}

// Animations de la page d'accueil : ciel étoilé, capture qui se redresse, notifications, frameworks.
export default function Effects() {
  useEffect(() => {
    const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanups = [];

    const c = document.getElementById('stars');
    if (c) {
      const g = c.getContext('2d');
      const draw = () => {
        const r = c.getBoundingClientRect(), d = devicePixelRatio || 1;
        c.width = r.width * d; c.height = r.height * d;
        let s = 5; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const n = Math.min(420, (r.width * r.height) / 2600 | 0);
        for (let i = 0; i < n; i++) {
          const m = Math.pow(rnd(), 6);
          g.fillStyle = 'rgba(255,255,255,' + (0.15 + m * 0.75) + ')';
          g.beginPath(); g.arc(rnd() * c.width, rnd() * c.height, (0.4 + m * 1.4) * d, 0, 6.28); g.fill();
        }
      };
      const ro = new ResizeObserver(draw); ro.observe(c); cleanups.push(() => ro.disconnect());
    }

    const sh = document.getElementById('shot');
    if (sh) {
      if (RM) sh.classList.add('in');
      else {
        const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { sh.classList.add('in'); io.disconnect(); } }), { threshold: 0.25 });
        io.observe(sh); cleanups.push(() => io.disconnect());
      }
    }

    const fws = [...document.querySelectorAll('#fw span')];
    if (fws.length === 6 && !RM) {
      let k = 0;
      const t = setInterval(() => { fws.forEach((f) => f.classList.remove('on')); fws[k % 3].classList.add('on'); fws[3 + (k % 3)].classList.add('on'); k++; }, 1800);
      cleanups.push(() => clearInterval(t));
    }

    const st = document.getElementById('stack');
    if (st) {
      let i = 0;
      const push = () => {
        const n = NOTIFS[i++ % NOTIFS.length];
        const d = document.createElement('div');
        d.className = 'nt' + (n[2] ? ' er' : '');
        const w = document.createElement('div'), b = document.createElement('b'), p = document.createElement('p');
        b.textContent = n[0]; p.textContent = n[1]; w.append(b, p); d.append(w);
        st.append(d);
        while (st.children.length > 3) st.firstElementChild.remove();
      };
      st.textContent = ''; push(); push(); push();
      if (!RM) { const t = setInterval(push, 2600); cleanups.push(() => clearInterval(t)); }
    }

    return () => cleanups.forEach((f) => f());
  }, []);
  return null;
}
