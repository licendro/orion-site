'use client';

import { useEffect, useState } from 'react';

export function QuoteButton({ type, tier, className, children }) {
  const click = () => {
    window.dispatchEvent(new CustomEvent('orion:quote', { detail: { type, tier } }));
    document.getElementById('devis')?.scrollIntoView({ behavior: 'smooth' });
  };
  return <button className={className} onClick={click}>{children}</button>;
}

export default function QuoteForm({ user }) {
  const [f, setF] = useState({ type: 'sur-mesure', framework: 'ESX', budget: 'Moins de 50 €', message: '', website: '' });
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const on = (e) => {
      const { type, tier } = typeof e.detail === 'string' ? { type: e.detail } : e.detail || {};
      setF((x) => ({ ...x, type: type || x.type, budget: type === 'partenariat' ? 'Partenariat mensuel' : x.budget,
        message: tier && !x.message.includes(tier) ? `Formule choisie : ${tier}\n${x.message}` : x.message }));
      setTimeout(() => document.getElementById('qMessage')?.focus({ preventScroll: true }), 500);
    };
    window.addEventListener('orion:quote', on);
    return () => window.removeEventListener('orion:quote', on);
  }, []);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (f.message.trim().length < 20) return setStatus({ error: true, text: 'Décrivez votre besoin en quelques phrases (20 caractères minimum).' });
    setSending(true);
    try {
      const r = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Envoi impossible pour le moment.');
      setStatus({ text: 'Demande envoyée ! Un ticket privé s’ouvre sur notre Discord, l’équipe vous y répond sous 24 h.' });
      setF((x) => ({ ...x, message: '' }));
    } catch (err) {
      setStatus({ error: true, text: err.message });
    } finally {
      setSending(false);
    }
  };

  if (!user) {
    return (
      <div className="qform">
        <p className="full" style={{ margin: 0 }}>Pour vous recontacter facilement, chaque demande ouvre un <b>ticket privé sur notre Discord</b>. Connectez-vous avec Discord pour continuer.</p>
        <div className="full"><a className="btn pri" href="/api/auth/discord?next=/services%23devis">Se connecter avec Discord</a></div>
      </div>
    );
  }

  return (
    <form className="qform" onSubmit={submit} noValidate>
      <label>Compte Discord<input className="field" value={user.username} disabled readOnly /></label>
      <label>Service
        <select className="field" value={f.type} onChange={set('type')}>
          <option value="sur-mesure">Script sur mesure</option>
          <option value="partenariat">Partenariat serveur</option>
          <option value="bot">Bot Discord</option>
          <option value="carte">Service à la carte</option>
        </select>
      </label>
      <label>Framework
        <select className="field" value={f.framework} onChange={set('framework')}>
          <option>ESX</option><option>QBCore</option><option>QBox</option><option>Pas encore choisi</option>
        </select>
      </label>
      <label>Budget
        <select className="field" value={f.budget} onChange={set('budget')}>
          <option>Moins de 50 €</option><option>50 à 100 €</option><option>100 à 200 €</option><option>Partenariat mensuel</option>
        </select>
      </label>
      <label className="full">Votre besoin
        <textarea id="qMessage" required maxLength={2000} placeholder="Ce que le script doit faire, pour quel job, avec quels scripts existants…" value={f.message} onChange={set('message')} />
      </label>
      {/* Champ piège anti-robots, invisible pour les humains */}
      <input type="text" name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
      <div className="full" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn pri" type="submit" disabled={sending}>{sending ? 'Envoi…' : 'Envoyer la demande'}</button>
        <span className="muted" style={{ fontSize: 12.5 }}>Ta demande sert uniquement à te répondre, et est gardée 3 ans au plus. <a href="/confidentialite">Confidentialité</a></span>
      </div>
      <div className={'qok' + (status ? ' on' : '')} role="status" style={status?.error ? { borderColor: 'rgba(255,122,47,.5)' } : null}>{status?.text}</div>
    </form>
  );
}
