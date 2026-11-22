import { getBasket, tebexEnabled } from '../../../../lib/tebex';
import { json } from '../../../../lib/http';

export const dynamic = 'force-dynamic';

// État du panier Tebex : connecté à FiveM ? déjà payé ?
export async function GET(req) {
  if (!tebexEnabled()) return json({ error: 'off' }, 503);
  const ident = new URL(req.url).searchParams.get('ident') || '';
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(ident)) return json({ error: 'ident' }, 400);
  try {
    const b = await getBasket(ident);
    return json({ complete: !!b.complete, username: b.username || null });
  } catch (e) {
    return json({ error: e.message, expired: e.status === 404 }, e.status === 404 ? 404 : 502);
  }
}
