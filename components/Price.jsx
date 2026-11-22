import { eur } from '../lib/format';

const endDate = (iso) => {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' });
  } catch {
    return null;
  }
};

export function Price({ p, style }) {
  return (
    <span className="price" style={style}>
      {eur(p.price)}
      {p.was ? <s>{eur(p.was)}</s> : null}
    </span>
  );
}

// Bandeau sous le produit : ancien prix barré, nouveau prix, réduction, texte de la promo.
export function PromoBand({ p }) {
  if (!p.was) return null;
  const end = p.ends ? endDate(p.ends) : null;
  return (
    <div className="promo">
      <span className="pct">−{p.pct} %</span>
      <span>{p.banner || 'Promotion'}</span>
      {end ? <span className="end">jusqu'au {end}</span> : null}
    </div>
  );
}
