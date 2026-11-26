'use client';
import { useState } from 'react';

// Clé masquée par défaut (évite qu'elle apparaisse sur un partage d'écran), bouton copier
export default function LicenceKey({ value, script }) {
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState('');
  const copy = async (text, what) => { try { await navigator.clipboard.writeText(text); setCopied(what); setTimeout(() => setCopied(''), 1800); } catch { /* rien */ } };
  return (
    <div className="lkey">
      <code className="mono">{show ? value : value.replace(/[A-Z0-9]/g, (c, i) => (i < 4 ? c : '•'))}</code>
      <button type="button" className="btn sm" onClick={() => setShow((v) => !v)}>{show ? 'Masquer' : 'Afficher'}</button>
      <button type="button" className="btn sm" onClick={() => copy(value, 'key')}>{copied === 'key' ? 'Copiée ✓' : 'Copier'}</button>
      <button type="button" className="btn sm" onClick={() => copy(`set orn_licence_${script} "${value}"`, 'cfg')}>{copied === 'cfg' ? 'Copié ✓' : 'Ligne server.cfg'}</button>
    </div>
  );
}
