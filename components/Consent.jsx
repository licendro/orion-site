'use client';

import { useEffect, useState } from 'react';
import { getConsent, setConsent } from '../lib/consent';

// Bandeau cookies conforme CNIL : refuser aussi simple qu'accepter, choix par finalité, modifiable à tout moment.
export default function Consent() {
  const [show, setShow] = useState(false);
  const [custom, setCustom] = useState(false);
  const [c, setC] = useState({ youtube: false, ref: false });

  useEffect(() => {
    const cur = getConsent();
    if (!cur) setShow(true); else setC(cur);
    const open = () => { const x = getConsent(); if (x) setC(x); setCustom(true); setShow(true); };
    window.addEventListener('orion:cookies', open);
    return () => window.removeEventListener('orion:cookies', open);
  }, []);

  const save = (v) => { setConsent(v); setC(v); setShow(false); setCustom(false); };
  if (!show) return null;

  return (
    <div className="consent" role="dialog" aria-label="Cookies et contenus tiers" aria-live="polite">
      <b>🍪 Vos choix</b>
      <p>Le site n’utilise que les cookies nécessaires (connexion, panier, paiement). Avec votre accord, on peut aussi afficher les <b>vidéos YouTube</b> et retenir un <b>code créateur</b> pendant 30 jours. <a href="/confidentialite#cookies">En savoir plus</a></p>
      {custom ? (
        <div className="cs-opts">
          <label className="cs-row"><input type="checkbox" checked disabled /> <span><b>Nécessaires</b><small>Connexion Discord, panier, compte FiveM relié, paiement Tebex, mémorisation de ce choix. Toujours actifs.</small></span></label>
          <label className="cs-row"><input type="checkbox" checked={c.youtube} onChange={(e) => setC({ ...c, youtube: e.target.checked })} /> <span><b>Vidéos YouTube</b><small>Lecture des vidéos de présentation : YouTube (Google) peut alors déposer des traceurs.</small></span></label>
          <label className="cs-row"><input type="checkbox" checked={c.ref} onChange={(e) => setC({ ...c, ref: e.target.checked })} /> <span><b>Code créateur</b><small>Retient pendant 30 jours le code du créateur qui vous a envoyé (lien ?ref=). Sans accord, il ne vaut que pour cette visite.</small></span></label>
        </div>
      ) : null}
      <div className="cs-btns">
        <button className="btn sm" onClick={() => save({ youtube: false, ref: false })}>Tout refuser</button>
        {custom
          ? <button className="btn sm" onClick={() => save(c)}>Enregistrer mes choix</button>
          : <button className="btn sm" onClick={() => setCustom(true)}>Personnaliser</button>}
        <button className="btn sm" onClick={() => save({ youtube: true, ref: true })}>Tout accepter</button>
      </div>
    </div>
  );
}
