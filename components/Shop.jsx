'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { eur } from '../lib/format';

const ShopCtx = createContext(null);
export const useShop = () => useContext(ShopCtx);

const STORE = 'orion-cart-v1';
const PENDING = 'orion-checkout-v1';
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') ?? d; } catch { return d; } };
const write = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } };

function loadTebexJs() {
  return new Promise((resolve, reject) => {
    if (window.Tebex) return resolve(window.Tebex);
    const s = document.createElement('script');
    s.src = 'https://js.tebex.io/v/1.js';
    s.async = true;
    s.onload = () => (window.Tebex ? resolve(window.Tebex) : reject(new Error('Tebex.js absent')));
    s.onerror = () => reject(new Error('Tebex.js introuvable'));
    document.head.appendChild(s);
  });
}

export function ShopProvider({ products, mode, children }) {
  const byKey = useMemo(() => new Map(products.map((p) => [p.key, p])), [products]);
  const pack = useMemo(() => products.find((p) => p.bundle.length) || null, [products]);
  const [cart, setCart] = useState([]);
  const [coupon, setCoupon] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toasts, setToasts] = useState([]);
  const ready = useRef(false);

  useEffect(() => {
    const s = read(STORE, {});
    setCart((s.cart || []).filter((k) => byKey.has(k)));
    setCoupon(s.coupon || '');
    ready.current = true;
  }, [byKey]);
  useEffect(() => { if (ready.current) write(STORE, { cart, coupon }); }, [cart, coupon]);

  const toast = useCallback((text, error) => {
    const id = Math.random();
    setToasts((t) => [{ id, text, error }, ...t].slice(0, 4));
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3400);
  }, []);

  const packHas = useCallback((k) => !!pack && cart.includes(pack.key) && pack.bundle.includes(k), [pack, cart]);
  const inCart = useCallback((k) => cart.includes(k) || packHas(k), [cart, packHas]);

  const toggle = useCallback((k) => {
    const p = byKey.get(k);
    if (!p) return;
    if (packHas(k)) return toast(`${p.name} fait partie du ${pack.name}`, true);
    if (cart.includes(k)) {
      setCart((c) => c.filter((x) => x !== k));
      toast(`${p.name} retiré`);
    } else {
      setCart((c) => (p.bundle.length ? [...c.filter((x) => !p.bundle.includes(x)), k] : [...c, k]));
      toast(`${p.name} ajouté`);
    }
  }, [byKey, cart, pack, packHas, toast]);

  const remove = useCallback((k) => setCart((c) => c.filter((x) => x !== k)), []);

  const lines = cart.map((k) => byKey.get(k)).filter(Boolean);
  const total = lines.reduce((s, p) => s + p.price, 0);

  const launch = useCallback(async (ident, checkoutUrl) => {
    try {
      const Tebex = await loadTebexJs();
      Tebex.checkout.init({ ident, theme: 'dark', colors: [{ name: 'primary', color: '#FF7A2F' }] });
      Tebex.checkout.on && Tebex.checkout.on('payment:complete', () => {
        setCart([]); setCoupon(''); write(PENDING, null);
        window.location.href = '/merci';
      });
      Tebex.checkout.launch();
    } catch {
      if (checkoutUrl) window.location.href = checkoutUrl;
      else toast('Impossible d’ouvrir le paiement Tebex.', true);
    }
  }, [toast]);

  const finish = useCallback(async (ident, items, code) => {
    setBusy(true);
    try {
      const r = await fetch('/api/checkout/finish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ident, items, coupon: code }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      (j.warnings || []).forEach((w) => toast(w, true));
      await launch(ident, j.checkoutUrl);
    } catch (e) {
      toast(e.message || 'Le paiement n’a pas pu démarrer.', true);
      write(PENDING, null);
    } finally {
      setBusy(false);
    }
  }, [launch, toast]);

  const checkout = useCallback(async () => {
    if (mode !== 'tebex') return toast('Les paiements ouvrent très bientôt. Rejoignez le Discord pour être prévenu.', true);
    if (!cart.length) return;
    setBusy(true);
    try {
      const r = await fetch('/api/checkout/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: cart }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Erreur');
      write(PENDING, { ident: j.ident, items: cart, coupon, t: Date.now() });
      if (j.authUrl) window.location.href = j.authUrl; // connexion Cfx.re, puis retour sur le site
      else await finish(j.ident, cart, coupon);
    } catch (e) {
      toast(e.message || 'Le paiement n’a pas pu démarrer.', true);
      setBusy(false);
    }
  }, [mode, cart, coupon, finish, toast]);

  // Retour de la connexion Cfx.re : on reprend le paiement là où il s'était arrêté.
  useEffect(() => {
    const url = new URL(window.location.href);
    const ident = url.searchParams.get('checkout');
    if (!ident) return;
    url.searchParams.delete('checkout');
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    const pending = read(PENDING, null);
    if (pending && pending.ident === ident && Date.now() - pending.t < 3600e3) {
      setOpen(true);
      finish(ident, pending.items, pending.coupon);
    }
  }, [finish]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = { products, byKey, pack, mode, cart, inCart, toggle, remove, coupon, setCoupon, open, setOpen, busy, checkout, toast, lines, total };

  return (
    <ShopCtx.Provider value={value}>
      {children}
      <CartDrawer />
      <div className="toast" aria-live="polite">
        {(open ? toasts.filter((t) => t.error) : toasts).map((t) => (
          <div key={t.id} className={'nt' + (t.error ? ' er' : '')}>
            <div><b>{t.error ? 'Attention' : 'Panier'}</b><p>{t.text}</p></div>
          </div>
        ))}
      </div>
    </ShopCtx.Provider>
  );
}

export function CartButton() {
  const { lines, setOpen } = useShop();
  return (
    <button className="btn sm cartbtn" onClick={() => setOpen(true)} aria-label="Ouvrir le panier">
      Panier{lines.length ? <b>{lines.length}</b> : null}
    </button>
  );
}

export function AddButton({ k, variant = 'card', className = '' }) {
  const { inCart, toggle, byKey } = useShop();
  const p = byKey.get(k);
  if (!p) return null;
  const on = inCart(k);
  const click = (e) => { e.preventDefault(); e.stopPropagation(); toggle(k); };
  if (variant === 'card') {
    return <button className={'add' + (on ? ' in' : '')} onClick={click}>{on ? 'Dans le panier' : p.price ? 'Ajouter' : 'Obtenir'}</button>;
  }
  return (
    <button className={`btn ${on ? '' : variant} ${className}`} onClick={click}>
      {on ? 'Dans le panier ✓' : p.price ? 'Ajouter au panier' : 'Obtenir gratuitement'}
    </button>
  );
}

function CartDrawer() {
  const { open, setOpen, lines, remove, total, coupon, setCoupon, checkout, busy, mode, pack } = useShop();
  const [code, setCode] = useState(coupon);
  useEffect(() => setCode(coupon), [coupon]);
  const saveCode = (e) => { e.preventDefault(); setCoupon(code.trim().toUpperCase()); };

  return (
    <>
      <div className={'veil' + (open ? ' on' : '')} onClick={() => setOpen(false)} />
      <aside className={'drawer' + (open ? ' on' : '')} aria-label="Panier" aria-hidden={!open}>
        <div className="dh"><b>Panier</b><button className="x" onClick={() => setOpen(false)} aria-label="Fermer le panier">✕</button></div>
        <div className="lines">
          {lines.length ? lines.map((p) => (
            <div className="ln" key={p.key}>
              <img src={p.img} alt="" style={{ objectPosition: p.pos }} />
              <span>
                <div className="n">{p.name}</div>
                <div className="p">
                  {p.bundle.length ? `${p.bundle.length} scripts · ` : ''}{eur(p.price)}
                  {p.was ? <s style={{ marginLeft: 6 }}>{eur(p.was)}</s> : null}
                </div>
              </span>
              <button onClick={() => remove(p.key)}>Retirer</button>
            </div>
          )) : (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink3)' }}>
              Votre panier est vide.<br />
              <a className="btn sm" href="/#scripts" onClick={() => setOpen(false)} style={{ marginTop: 16 }}>Voir les scripts</a>
            </div>
          )}
        </div>
        {lines.length ? (
          <div className="df">
            <form className="coupon" onSubmit={saveCode}>
              <label htmlFor="cIn" className="sr">Code promo</label>
              <input className="field" id="cIn" placeholder="Code promo" value={code} maxLength={40} onChange={(e) => setCode(e.target.value)} />
              <button className="btn sm" type="submit">Appliquer</button>
            </form>
            {coupon ? <div className="sum"><span>Code {coupon}</span><span style={{ color: 'var(--acc)' }}>appliqué au paiement</span></div> : null}
            <div className="sum big"><span>Total</span><b>{eur(total)}</b></div>
            {mode === 'tebex' ? (
              <button className="btn pri" onClick={checkout} disabled={busy}>{busy ? 'Ouverture du paiement…' : 'Payer avec Tebex'}</button>
            ) : (
              <div className="warn">Les paiements ouvrent très bientôt. Votre panier est gardé sur cet appareil.</div>
            )}
            <span className="muted" style={{ fontSize: 12 }}>
              Connexion avec votre compte FiveM (Cfx.re) puis paiement sécurisé par Tebex. Licences livrées dans votre Keymaster.
              {pack ? '' : ''}
            </span>
          </div>
        ) : null}
      </aside>
    </>
  );
}
