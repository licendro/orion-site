'use server';

import { redirect } from 'next/navigation';
import { db } from '../../lib/db';
import { getUser } from '../../lib/auth';
import { processQueue, sessionOf, testConfig } from '../../lib/testserver';

const back = (msg, err) => redirect(`/essai?${err ? 'err' : 'ok'}=${encodeURIComponent(msg)}`);

export async function reserveSlot() {
  const user = getUser();
  if (!user) redirect('/api/auth/discord?next=/essai');
  const cfg = testConfig();
  if (!cfg.enabled) back('Le serveur de test est fermé pour le moment.', true);
  if (cfg.clientsOnly) {
    const owns = db().prepare("SELECT 1 FROM orders WHERE discord_id = ? AND status = 'paid' LIMIT 1").get(user.discord_id);
    if (!owns) back('Le serveur de test est réservé aux clients pour le moment.', true);
  }
  if (sessionOf(user.discord_id)) back('Tu as déjà une réservation en cours.', true);
  const today = db().prepare("SELECT COUNT(*) n FROM test_sessions WHERE discord_id = ? AND created_at >= datetime('now', '-1 day') AND status IN ('done','active')").get(user.discord_id).n;
  if (today >= 2) back('Maximum 2 créneaux par jour, pour laisser la place à tout le monde.', true);
  db().prepare('INSERT INTO test_sessions (user_id, discord_id) VALUES (?, ?)').run(user.id, user.discord_id);
  processQueue();
  back('Réservation enregistrée.');
}

export async function releaseSlot() {
  const user = getUser();
  if (!user) redirect('/essai');
  db().prepare("UPDATE test_sessions SET status = 'cancelled' WHERE discord_id = ? AND status IN ('waiting','active')").run(user.discord_id);
  processQueue();
  back('Place libérée, merci !');
}
