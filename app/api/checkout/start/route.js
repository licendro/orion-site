import { createBasket, getAuthLinks, tebexEnabled } from '../../../../lib/tebex';
import { notify } from '../../../../lib/alerts';
import { clientIp, json, rateLimited, siteUrl } from '../../../../lib/http';
import { discordConfigured, getUser } from '../../../../lib/auth';
import { getSetting } from '../../../../lib/db';

export const dynamic = 'force-dynamic';

// Connexion FiveM : crée le panier Tebex du client et renvoie le lien de connexion Cfx.re (avant le paiement).
export async function POST(req) {
  if (!tebexEnabled()) return json({ error: 'Les paiements ne sont pas encore ouverts.' }, 503);
  if (getSetting('maintenance', false)) return json({ error: 'La boutique est en maintenance, réessayez plus tard.' }, 503);
  const user = getUser();
  if (discordConfigured() && !user) return json({ error: 'Connecte-toi avec Discord pour payer.', login: true }, 401);
  const ip = clientIp(req);
  if (rateLimited(`start:${ip}`, 10, 60e3)) return json({ error: 'Trop de tentatives, patientez une minute.' }, 429);


  try {
    const site = siteUrl();
    const basket = await createBasket({
      completeUrl: `${site}/merci`,
      cancelUrl: `${site}/scripts`,
      ip,
      custom: { source: 'orion-site', discord_id: user?.discord_id || null, user_id: user?.id || null },
    });
    const links = await getAuthLinks(basket.ident, `${site}/?fivem=${encodeURIComponent(basket.ident)}`).catch(() => []);
    const list = Array.isArray(links) ? links : [];
    const link = list.find((l) => /fivem|cfx/i.test(l.name || '')) || list[0];
    return json({ ident: basket.ident, authUrl: link?.url || null });
  } catch (e) {
    console.error('[checkout/start]', e.status, e.message);
    notify('checkout-start', 'Erreur pendant un paiement', `Étape « connexion FiveM » : Tebex a répondu ${e.status || '?'} : ${e.message}`);
    return json({ error: `Tebex : ${e.message}` }, 502);
  }
}
