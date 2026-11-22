// Petits composants communs de l'admin (rendus côté serveur).
export function Head({ title, sub, children }) {
  return (
    <div className="adm-h">
      <div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>
      {children ? <div className="actions">{children}</div> : null}
    </div>
  );
}

export function Flash({ searchParams }) {
  // id="flash" + #flash dans l'URL : la page défile jusqu'au message, même sur téléphone.
  if (searchParams?.ok) return <div id="flash" className="flash" role="status">✓ {searchParams.ok}</div>;
  if (searchParams?.err) return <div id="flash" className="flash err" role="alert">⚠ {searchParams.err}</div>;
  return null;
}

export const when = (s) => {
  if (!s) return '—';
  const d = new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + 'Z');
  return d.toLocaleString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// Pour pré-remplir un <input type="datetime-local"> à l'heure de Paris.
export const localInput = (iso) => {
  if (!iso) return '';
  const p = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  return p.replace(' ', 'T');
};

export const STATUS = {
  paid: ['Payée', 'ok'], refunded: ['Remboursée', 'warn'], chargeback: ['Litige', 'warn'],
  pending: ['En attente', ''], done: ['Fait', 'ok'], error: ['Erreur', 'warn'], waiting: ['Attend le membre', ''],
};

export function Status({ s }) {
  const [label, cls] = STATUS[s] || [s, ''];
  return <span className={`pill2 ${cls}`}>{label}</span>;
}
