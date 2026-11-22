'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { eur } from '../lib/format';

const ShopCtx = createContext(null);
export const useShop = () => useContext(ShopCtx);

const STORE = 'orion-cart-v1';
const PENDING = 'orion-checkout-v1';
const FIVEM = 'orion-fivem-v1';
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

export function ShopProvider({ products, mode, user, loginRequired = false, children }) {
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

  // Compte FiveM (Cfx.re) relié avant le paiement : panier Tebex authentifié, gardé sur l'appareil.
  const [fivem, setFivem] = useState(null);
  const saveFivem = useCallback((v) => { setFivem(v); write(FIVEM, v); }, []);

  const status = useCallback(async (ident) => {
    const r = await fetch(`/api/checkout/status?ident=${encodeURIComponent(ident)}`, { cache: 'no-store' });
    return r.ok ? r.json() : { expired: true };
  }, []);

  // Paiement terminé : panier vidé, compte FiveM à relier de nouveau pour le prochain achat.
  const done = useCallback(() => {
    setCart([]); setCoupon(''); saveFivem(null);
    write(STORE, { cart: [], coupon: '' });
    window.location.href = '/merci';
  }, [saveFivem]);

  const launch = useCallback(async (ident, checkoutUrl) => {
    try {
      const Tebex = await loadTebexJs();
      Tebex.checkout.init({ ident, theme: 'dark', colors: [{ name: 'primary', color: '#FF7A2F' }] });
      if (Tebex.checkout.on) {
        const ev = Tebex.events || {};
        Tebex.checkout.on(ev.PAYMENT_COMPLETE || 'payment:complete', done);
        // À la fermeture de la fenêtre, on demande directement à Tebex si le panier est payé.
        Tebex.checkout.on(ev.CLOSE || 'close', async () => {
          const st = await status(ident).catch(() => ({}));
          if (st.complete) done();
        });
      }
      Tebex.checkout.launch();
    } catch {
      if (checkoutUrl) window.location.href = checkoutUrl;
      else toast('Impossible d’ouvrir le paiement Tebex.', true);
    }
  }, [toast, done, status]);

  const connectFivem = useCallback(async () => {
    if (mode !== 'tebex') return toast('Les paiements ouvrent très bientôt.', true);
    if (loginRequired) {
      window.location.href = '/api/auth/discord?next=' + encodeURIComponent('/?panier=1');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/checkout/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (r.status === 401 && j.login) { window.location.href = '/api/auth/discord?next=' + encodeURIComponent('/?panier=1'); return; }
      if (!r.ok) throw new Error(j.error || 'Erreur');
      write(PENDING, { ident: j.ident, t: Date.now() });
      if (j.authUrl) window.location.href = j.authUrl; // connexion Cfx.re, retour sur ?fivem=…
      else { saveFivem({ ident: j.ident, name: null, t: Date.now() }); setBusy(false); }
    } catch (e) {
      toast(e.message || 'Connexion FiveM impossible.', true);
      setBusy(false);
    }
  }, [mode, loginRequired, toast, saveFivem]);

  const checkout = useCallback(async () => {
    if (mode !== 'tebex') return toast('Les paiements ouvrent très bientôt. Rejoignez le Discord pour être prévenu.', true);
    if (!cart.length) return;
    if (loginRequired) { window.location.href = '/api/auth/discord?next=' + encodeURIComponent('/?panier=1'); return; }
    if (!fivem) return connectFivem();
    setBusy(true);
    try {
      const r = await fetch('/api/checkout/finish', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ident: fivem.ident, items: cart, coupon }),
      });
      const j = await r.json();
      if (r.status === 409 && j.relogin) { saveFivem(null); throw new Error(j.error); }
      if (!r.ok) throw new Error(j.error || 'Erreur');
      (j.warnings || []).forEach((w) => toast(w, true));
      await launch(fivem.ident, j.checkoutUrl);
    } catch (e) {
      toast(e.message || 'Le paiement n’a pas pu démarrer.', true);
    } finally {
      setBusy(false);
    }
  }, [mode, cart, coupon, fivem, loginRequired, launch, toast, connectFivem, saveFivem]);

  // Au chargement : retour de la connexion Cfx.re, ou vérification du compte FiveM déjà relié.
  useEffect(() => {
    const url = new URL(window.location.href);
    const clean = () => window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    if (url.searchParams.get('panier')) { url.searchParams.delete('panier'); clean(); setOpen(true); }
    const back = url.searchParams.get('fivem');
    const saved = read(FIVEM, null);
    if (back) {
      url.searchParams.delete('fivem'); clean();
      const pending = read(PENDING, null);
      write(PENDING, null);
      if (pending && pending.ident === back) {
        setOpen(true);
        status(back).then((st) => {
          if (st.expired || st.complete) return toast('La connexion FiveM a expiré, réessaie.', true);
          saveFivem({ ident: back, name: st.username || null, t: Date.now() });
          toast('Compte FiveM connecté');
        });
      }
    } else if (saved) {
      setFivem(saved);
      status(saved.ident).then((st) => {
        if (st.expired || st.complete) saveFivem(null);
        else if (st.username && st.username !== saved.name) saveFivem({ ...saved, name: st.username });
      }).catch(() => {});
    }
  }, [status, saveFivem, toast]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const value = { products, byKey, pack, mode, user, loginRequired, cart, inCart, toggle, remove, coupon, setCoupon, open, setOpen, busy, checkout, connectFivem, fivem, saveFivem, toast, lines, total };

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
  const { open, setOpen, lines, remove, total, coupon, setCoupon, checkout, connectFivem, fivem, saveFivem, busy, mode, user, loginRequired } = useShop();
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
              <>
                <div className="steps2">
                  <div className={'st2' + (user ? ' ok' : '')}>
                    <span className="n">1</span>
                    <span className="t">{user ? <>Discord : <b>{user.name}</b></> : 'Compte Discord'}</span>
                    {!user ? <a className="btn sm" href={'/api/auth/discord?next=' + encodeURIComponent('/?panier=1')}>Connecter</a> : <span className="ck">✓</span>}
                  </div>
                  <div className={'st2' + (fivem ? ' ok' : '')}>
                    <span className="n">2</span>
                    <span className="t">{fivem ? <>FiveM : <b>{fivem.name || 'connecté'}</b></> : 'Compte FiveM (Cfx.re)'}</span>
                    {fivem ? <button className="lnk" onClick={() => saveFivem(null)}>Changer</button>
                      : <button className="btn sm" onClick={connectFivem} disabled={busy || !user}>Connecter</button>}
                  </div>
                </div>
                <button className="btn pri" onClick={checkout} disabled={busy || !user || !fivem}>
                  {busy ? 'Un instant…' : !user ? 'Connecte Discord pour continuer' : !fivem ? 'Connecte FiveM pour payer' : `Payer ${eur(total).replace('Gratuit', '0,00 €')}`}
                </button>
              </>
            ) : (
              <div className="warn">Les paiements ouvrent très bientôt. Votre panier est gardé sur cet appareil.</div>
            )}
            <span className="muted" style={{ fontSize: 12 }}>
              Discord : rôle Client et salon privé. FiveM : livraison dans ton Keymaster. Paiement sécurisé par Tebex, sans quitter le site.
            </span>
          </div>
        ) : null}
      </aside>
    </>
  );
}
