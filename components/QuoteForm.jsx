'use client';

import { useEffect, useState } from 'react';

export function QuoteButton({ type, className, children }) {
  const click = () => {
    window.dispatchEvent(new CustomEvent('orion:quote', { detail: type }));
    document.getElementById('devis')?.scrollIntoView({ behavior: 'smooth' });
  };
  return <button className={className} onClick={click}>{children}</button>;
}

export default function QuoteForm() {
  const [f, setF] = useState({ discord: '', type: 'sur-mesure', framework: 'ESX', budget: 'Moins de 50 €', message: '', website: '' });
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const on = (e) => {
      setF((x) => ({ ...x, type: e.detail }));
      setTimeout(() => document.getElementById('qDiscord')?.focus({ preventScroll: true }), 500);
    };
    window.addEventListener('orion:quote', on);
    return () => window.removeEventListener('orion:quote', on);
  }, []);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!f.discord.trim()) return setStatus({ error: true, text: 'Indiquez votre pseudo Discord.' });
    if (f.message.trim().length < 20) return setStatus({ error: true, text: 'Décrivez votre besoin en quelques phrases (20 caractères minimum).' });
    setSending(true);
    try {
      const r = await fetch('/api/quote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Envoi impossible pour le moment.');
      setStatus({ text: `Demande envoyée. On vous écrit sur Discord sous 24 h (${f.discord.trim()}).` });
      setF((x) => ({ ...x, message: '' }));
    } catch (err) {
      setStatus({ error: true, text: err.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <form className="qform" onSubmit={submit} noValidate>
      <label>Pseudo Discord<input className="field" id="qDiscord" required maxLength={40} placeholder="ex. marcus.vale" value={f.discord} onChange={set('discord')} /></label>
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
        <textarea required maxLength={2000} placeholder="Ce que le script doit faire, pour quel job, avec quels scripts existants…" value={f.message} onChange={set('message')} />
      </label>
      {/* Champ piège anti-robots, invisible pour les humains */}
      <input type="text" name="website" value={f.website} onChange={set('website')} tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} />
      <div className="full" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn pri" type="submit" disabled={sending}>{sending ? 'Envoi…' : 'Envoyer la demande'}</button>
      </div>
      <div className={'qok' + (status ? ' on' : '')} role="status" style={status?.error ? { borderColor: 'rgba(255,122,47,.5)' } : null}>{status?.text}</div>
    </form>
  );
}
