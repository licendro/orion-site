import { getCatalog } from '../../../../lib/catalog';
import { createBasket, getAuthLinks, tebexEnabled } from '../../../../lib/tebex';
import { clientIp, json, rateLimited, siteUrl } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

// Étape 1 du paiement : crée le panier Tebex et renvoie le lien de connexion Cfx.re.
export async function POST(req) {
  if (!tebexEnabled()) return json({ error: 'Les paiements ne sont pas encore ouverts.' }, 503);
  const ip = clientIp(req);
  if (rateLimited(`start:${ip}`, 10, 60e3)) return json({ error: 'Trop de tentatives, patientez une minute.' }, 429);

  const body = await req.json().catch(() => ({}));
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  const { products } = await getCatalog();
  if (!items.length || !items.every((k) => products.some((p) => p.key === k && p.tebexId))) {
    return json({ error: 'Panier invalide, rechargez la page.' }, 400);
  }

  try {
    const site = siteUrl();
    const basket = await createBasket({
      completeUrl: `${site}/merci`,
      cancelUrl: `${site}/#scripts`,
      ip,
      custom: { source: 'orion-site' },
    });
    const links = await getAuthLinks(basket.ident, `${site}/?checkout=${encodeURIComponent(basket.ident)}`).catch(() => []);
    const list = Array.isArray(links) ? links : [];
    const link = list.find((l) => /fivem|cfx/i.test(l.name || '')) || list[0];
    return json({ ident: basket.ident, authUrl: link?.url || null });
  } catch (e) {
    console.error('[checkout/start]', e.message);
    return json({ error: 'Tebex ne répond pas, réessayez dans un instant.' }, 502);
  }
}
