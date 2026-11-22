import { keyOf } from './format';

const round = (n) => Math.round(n * 100) / 100;

export function activePromotions(promos, now = Date.now()) {
  return promos.filter((p) => {
    if (p.active === false) return false;
    if (p.starts && Date.parse(p.starts) > now) return false;
    if (p.ends && Date.parse(p.ends) < now) return false;
    return p.value > 0;
  });
}

export const promoCovers = (promo, product) =>
  promo.scope === 'all' || (Array.isArray(promo.scope) && promo.scope.some((n) => keyOf(n) === product.key));

// Prix affiché d'un produit : la promo la plus avantageuse, jamais un cumul.
// Utilisé partout (cartes, fiche, panier) pour que tout affiche le même prix.
export function getDisplayPrice(product, promos) {
  const base = product.basePrice;
  let best = null;
  if (product.tebexDiscount > 0) {
    best = { price: round(base - product.tebexDiscount), banner: null, ends: null, coupon: null };
  }
  if (base > 0) {
    for (const p of promos) {
      if (!promoCovers(p, product)) continue;
      const price = Math.max(0, round(p.type === 'fixed' ? base - p.value : base * (1 - p.value / 100)));
      if (!best || price < best.price) best = { price, banner: p.banner || p.name || null, ends: p.ends || null, coupon: p.coupon || null };
    }
  }
  if (!best || best.price >= base) return { price: base, was: null, pct: 0, banner: null, ends: null, coupon: null };
  return { ...best, was: base, pct: Math.round((1 - best.price / base) * 100) };
}
