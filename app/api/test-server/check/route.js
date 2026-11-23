import { json } from '../../../../lib/http';
import { apiKey, processQueue, sessionOf, testConfig } from '../../../../lib/testserver';

export const dynamic = 'force-dynamic';

// Appelé par la ressource FiveM orn_testgate quand un joueur se connecte.
// GET /api/test-server/check?discord=ID  avec l'en-tête  X-Orion-Key: <clé>
export async function GET(req) {
  if (req.headers.get('x-orion-key') !== apiKey()) return json({ error: 'clé' }, 401);
  processQueue();
  const id = (new URL(req.url).searchParams.get('discord') || '').replace(/\D/g, '');
  if (!testConfig().enabled) return json({ allowed: false, reason: 'Le serveur de test est fermé.' });
  if (!id) return json({ allowed: false, reason: 'Relie ton compte Discord à FiveM (Paramètres FiveM → Comptes) puis réessaie.' });
  const s = sessionOf(id);
  if (s?.status === 'active') return json({ allowed: true, endsAt: s.ends_at });
  if (s?.status === 'waiting') return json({ allowed: false, reason: 'Ce n’est pas encore ton tour : regarde ta place sur la page Essayer nos scripts.' });
  return json({ allowed: false, reason: 'Réserve d’abord un créneau sur la page Essayer nos scripts du site Orion.' });
}
