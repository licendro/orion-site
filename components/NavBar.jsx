'use client';

// Barre de navigation détachée, toujours visible : en haut sur ordinateur, en bas sur téléphone.
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { LogoMark } from './Logo';
import { useShop } from './Shop';

const I = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  scripts: <><rect x="3" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" /></>,
  services: <><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3.5 17.5l3 3 5.8-5.8a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.5-.5-.5-2.5z" /></>,
  cart: <><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20.5 8H6.2" /><circle cx="9.5" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  ideas: <><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3z" /></>,
  docs: <><path d="M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z" /><path d="M14 4v5h5M8 13h8M8 17h6" /></>,
  test: <><path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3" /></>,
  bug: <><rect x="7" y="8" width="10" height="12" rx="5" /><path d="M12 8V5M9 5l1.5 2M15 5l-1.5 2M3 13h4M17 13h4M4 19l3-2M20 19l-3-2M4 8l3 2M20 8l-3 2" /></>,
  faq: <><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17.5v.01" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  discord: <><path d="M8 7.5a12 12 0 0 1 8 0M7 16.5a12 12 0 0 0 10 0M6.5 6.5 5 5.8C3.7 8.3 3 11.2 3.2 14.5c1.3 1.5 3 2.5 4.8 3l1-1.8M17.5 6.5l1.5-.7c1.3 2.5 2 5.4 1.8 8.7-1.3 1.5-3 2.5-4.8 3l-1-1.8" /><circle cx="9.5" cy="12.5" r="1.2" /><circle cx="14.5" cy="12.5" r="1.2" /></>,
  admin: <><path d="M12 3 4 6v6c0 4.4 3.4 8.3 8 9 4.6-.7 8-4.6 8-9V6z" /></>,
};
const Icon = ({ n }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>;

const MAIN = [
  ['/', 'Accueil', 'home'],
  ['/scripts', 'Scripts', 'scripts'],
  ['/services', 'Services', 'services'],
  ['/idees', 'Idées', 'ideas'],
  ['/docs', 'Docs', 'docs'],
];
const MORE = [
  ['/idees', 'Idées', 'ideas'],
  ['/docs', 'Documentation', 'docs'],
  ['/essai', 'Serveur de test', 'test'],
  ['/bugs', 'Problèmes connus', 'bug'],
  ['/faq', 'FAQ', 'faq'],
];

const active = (path, href) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'));

export default function NavBar({ user, admin, canLogin, discord }) {
  const path = usePathname() || '/';
  const { lines, setOpen, open: cartOpen } = useShop();
  const [sheet, setSheet] = useState(false);
  const [more, setMore] = useState(false);
  const n = lines.length;

  useEffect(() => { setSheet(false); setMore(false); }, [path]);
  useEffect(() => {
    if (!sheet && !more) return undefined;
    const k = (e) => { if (e.key === 'Escape') { setSheet(false); setMore(false); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [sheet, more]);

  const account = user
    ? <a className="dk-user" href="/compte" aria-label="Mon compte"><img src={user.avatar} alt="" width="26" height="26" /><span>{user.name}</span></a>
    : canLogin ? <a className="dk-btn" href={`/api/auth/discord?next=${encodeURIComponent(path)}`}>Connexion</a> : null;

  return (
    <>
      {/* Ordinateur : barre flottante en haut */}
      <header className="dock top" aria-label="Navigation">
        <a className="dk-brand" href="/" aria-label="Orion, accueil"><LogoMark /><span>ORION</span></a>
        <nav className="dk-links">
          {MAIN.map(([h, l]) => <a key={h} href={h} className={active(path, h) ? 'on' : ''} aria-current={active(path, h) ? 'page' : undefined}>{l}</a>)}
          <div className="dk-more">
            <button className={MORE.slice(2).some(([h]) => active(path, h)) ? 'on' : ''} aria-expanded={more} onClick={() => setMore((v) => !v)}>Plus ▾</button>
            {more ? (
              <>
                <div className="dk-catch" onClick={() => setMore(false)} />
                <div className="dk-pop" role="menu">
                  {MORE.slice(2).map(([h, l, ic]) => <a key={h} href={h} role="menuitem"><Icon n={ic} />{l}</a>)}
                  <a href={discord} target="_blank" rel="noopener" role="menuitem"><Icon n="discord" />Discord</a>
                </div>
              </>
            ) : null}
          </div>
        </nav>
        <div className="dk-right">
          {admin ? <a className="dk-btn ghost" href="/admin">Admin</a> : null}
          {account}
          <button className="dk-cart" onClick={() => setOpen(true)} aria-label={`Panier${n ? `, ${n} article${n > 1 ? 's' : ''}` : ''}`}>
            <Icon n="cart" /><span>Panier</span>{n ? <b>{n}</b> : null}
          </button>
        </div>
      </header>

      {/* Téléphone : logo en haut (défile), barre d'onglets flottante en bas */}
      <div className="mtop">
        <a className="dk-brand" href="/" aria-label="Orion, accueil"><LogoMark /><span>ORION</span></a>
        {user ? <a className="dk-user" href="/compte" aria-label="Mon compte"><img src={user.avatar} alt="" width="28" height="28" /></a> : null}
      </div>
      <nav className="dock bottom" aria-label="Navigation">
        {MAIN.slice(0, 3).map(([h, l, ic]) => (
          <a key={h} href={h} className={active(path, h) && !sheet && !cartOpen ? 'on' : ''} aria-current={active(path, h) ? 'page' : undefined}><Icon n={ic} /><span>{l}</span></a>
        ))}
        <button className={cartOpen ? 'on' : ''} onClick={() => { setSheet(false); setOpen(true); }} aria-label={`Panier${n ? `, ${n} article${n > 1 ? 's' : ''}` : ''}`}>
          <Icon n="cart" /><span>Panier</span>{n ? <b>{n}</b> : null}
        </button>
        <button className={sheet ? 'on' : ''} onClick={() => setSheet((v) => !v)} aria-expanded={sheet} aria-label="Menu"><Icon n="menu" /><span>Menu</span></button>
      </nav>

      <div className={'sheet-veil' + (sheet ? ' on' : '')} onClick={() => setSheet(false)} />
      <div className={'sheet' + (sheet ? ' on' : '')} role="dialog" aria-label="Menu" aria-hidden={!sheet}>
        <div className="sh-grip" />
        <div className="sh-grid">
          {MORE.map(([h, l, ic]) => <a key={h} href={h} className={active(path, h) ? 'on' : ''}><Icon n={ic} /><span>{l}</span></a>)}
          <a href={discord} target="_blank" rel="noopener"><Icon n="discord" /><span>Discord</span></a>
        </div>
        <div className="sh-row">
          {user ? <a href="/compte"><Icon n="user" />Mon compte · {user.name}</a> : canLogin ? <a href={`/api/auth/discord?next=${encodeURIComponent(path)}`}><Icon n="user" />Se connecter avec Discord</a> : null}
          {admin ? <a href="/admin"><Icon n="admin" />Administration</a> : null}
        </div>
        <div className="sh-legal">
          <a href="/mentions-legales">Mentions légales</a><a href="/cgv">CGV</a><a href="/confidentialite">Confidentialité</a>
          <button onClick={() => window.dispatchEvent(new Event('orion:cookies'))}>Cookies</button>
        </div>
      </div>
    </>
  );
}
