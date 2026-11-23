import { db } from '../../../../lib/db';
import { getUser } from '../../../../lib/auth';
import { CGV_VERSION } from '../../../../content/legal';
import { getCatalog } from '../../../../lib/catalog';
import { addPackage, applyCoupon, applyCreatorCode, getBasket, removePackage, tebexEnabled } from '../../../../lib/tebex';
import { notify } from '../../../../lib/alerts';
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
  // Acceptation des CGV et renonciation au droit de rétractation (contenu numérique) : obligatoire et conservée comme preuve
  if (body.accept !== CGV_VERSION) return json({ error: 'Accepte les conditions générales de vente pour continuer (recharge la page si besoin).' }, 400);
  const user = getUser();

  const { products } = await getCatalog();
  const chosen = items.map((k) => products.find((p) => p.key === k)).filter((p) => p && p.tebexId);
  if (chosen.length !== items.length) return json({ error: 'Panier invalide, rechargez la page.' }, 400);

  const warnings = [];
  try {
    let basket = await getBasket(ident);
    if (basket.complete) return json({ error: 'Ce panier est déjà payé. Reconnecte ton compte FiveM pour un nouvel achat.', relogin: true }, 409);
    const wanted = new Set(chosen.map((p) => p.tebexId));
    const already = new Set((basket.packages || []).map((p) => p.id));
    for (const p of basket.packages || []) {
      if (!wanted.has(p.id)) await removePackage(ident, p.id).catch(() => {});
    }
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
    const creator = typeof body.creator === 'string' ? body.creator.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40) : '';
    if (creator) {
      try { await applyCreatorCode(ident, creator); } catch (e) { warnings.push(`Code créateur ${creator} refusé : ${e.message}`); }
    }
    basket = await getBasket(ident);
    db().prepare('INSERT INTO checkout_consents (basket, discord_id, cgv_version, items, waiver) VALUES (?, ?, ?, ?, ?)')
      .run(ident, user?.discord_id || null, CGV_VERSION, chosen.map((p) => p.name).join(', '), chosen.some((p) => !p.subscription) ? 1 : 0);
    return json({ checkoutUrl: basket.links?.checkout || null, total: basket.total_price, warnings });
  } catch (e) {
    console.error('[checkout/finish]', e.status, e.message);
    notify('checkout-finish', 'Erreur pendant un paiement', `Étape « ouverture du paiement » : Tebex a répondu ${e.status || '?'} : ${e.message}`);
    if (e.status === 404) return json({ error: 'Session FiveM expirée, reconnecte-toi.', relogin: true }, 409);
    return json({ error: `Tebex : ${e.message}` }, 502);
  }
}
