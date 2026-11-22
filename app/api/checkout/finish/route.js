import { getCatalog } from '../../../../lib/catalog';
import { addPackage, applyCoupon, getBasket, tebexEnabled } from '../../../../lib/tebex';
import { clientIp, json, rateLimited } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

// Étape 2 : après la connexion Cfx.re, ajoute les scripts et les codes promo, puis renvoie le panier prêt à payer.
export async function POST(req) {
  if (!tebexEnabled()) return json({ error: 'Les paiements ne sont pas encore ouverts.' }, 503);
  const ip = clientIp(req);
  if (rateLimited(`finish:${ip}`, 10, 60e3)) return json({ error: 'Trop de tentatives, patientez une minute.' }, 429);

  const body = await req.json().catch(() => ({}));
  const ident = typeof body.ident === 'string' && /^[A-Za-z0-9_-]{6,80}$/.test(body.ident) ? body.ident : null;
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  const userCoupon = typeof body.coupon === 'string' ? body.coupon.trim().toUpperCase().slice(0, 40) : '';
  if (!ident || !items.length) return json({ error: 'Panier invalide.' }, 400);

  const { products } = await getCatalog();
  const chosen = items.map((k) => products.find((p) => p.key === k)).filter((p) => p && p.tebexId);
  if (chosen.length !== items.length) return json({ error: 'Panier invalide, rechargez la page.' }, 400);

  const warnings = [];
  try {
    let basket = await getBasket(ident);
    if (basket.complete) return json({ error: 'Ce panier est déjà payé.' }, 409);
    const already = new Set((basket.packages || []).map((p) => p.id));
    for (const p of chosen) {
      if (!already.has(p.tebexId)) await addPackage(ident, p.ident || p.tebexId, 1);
    }
    // Coupons des promotions affichées (le bandeau doit correspondre au prix payé), puis le code du client.
    const codes = [...new Set(chosen.map((p) => p.coupon).filter(Boolean))];
    if (userCoupon) codes.push(userCoupon);
    for (const code of codes) {
      try { await applyCoupon(ident, code); } catch (e) {
        if (code === userCoupon) warnings.push(`Code ${code} refusé : ${e.message}`);
        else console.error('[checkout/finish] coupon promo', code, e.message);
      }
    }
    basket = await getBasket(ident);
    return json({ checkoutUrl: basket.links?.checkout || null, total: basket.total_price, warnings });
  } catch (e) {
    console.error('[checkout/finish]', e.message);
    return json({ error: `Tebex : ${e.message}` }, 502);
  }
}
