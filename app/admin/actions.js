'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { getUser, isAdmin } from '../../lib/auth';
import { addJob, audit, db, getSetting, setSetting } from '../../lib/db';
import { absUrl, announcePayload, getFullCatalog } from '../../lib/catalog';
import { createCoupon, deleteCoupon, pluginEnabled } from '../../lib/tebexPlugin';
import { saveUpload } from '../../lib/uploads';
import { siteUrl } from '../../lib/http';

function admin() {
  const u = getUser();
  if (!isAdmin(u)) redirect('/');
  return u.username;
}
const str = (fd, k, n = 2000) => String(fd.get(k) ?? '').trim().slice(0, n);
const bool = (fd, k) => fd.get(k) === 'on' || fd.get(k) === '1';
// Les dates saisies dans l'admin sont à l'heure de Paris.
function parisIso(local) {
  if (!local) return null;
  const guess = new Date(local + (local.length <= 16 ? ':00' : '') + 'Z');
  if (Number.isNaN(guess.getTime())) return null;
  const paris = new Date(guess.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const utc = new Date(guess.toLocaleString('en-US', { timeZone: 'UTC' }));
  return new Date(guess.getTime() - (paris - utc)).toISOString();
}
const go = (path, msg, err) => redirect(`${path}?${err ? 'err' : 'ok'}=${encodeURIComponent(msg)}#flash`);

// ---------- Produits ----------
export async function saveProduct(fd) {
  const who = admin();
  const key = str(fd, 'key', 80);
  let image = str(fd, 'image_url', 500) || null;
  try {
    const up = await saveUpload(fd.get('image_file'));
    if (up) image = up;
  } catch (e) { go(`/admin/produits/${key}`, e.message, true); }
  if (bool(fd, 'image_reset')) image = null;
  db().prepare(`UPDATE products SET short = ?, description = ?, version = ?, features = ?, video = ?, bundle = ?, image = ?,
    featured = ?, hidden = ?, sort = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`).run(
    str(fd, 'short', 200) || null, str(fd, 'description', 5000) || null, str(fd, 'version', 20) || null, str(fd, 'features', 3000) || null,
    str(fd, 'video', 300) || null, str(fd, 'bundle', 500) || null, image, bool(fd, 'featured') ? 1 : 0, bool(fd, 'hidden') ? 1 : 0,
    Number(str(fd, 'sort', 5)) || 0, key);
  audit(who, 'produit.modifié', key, null);
  go(`/admin/produits/${key}`, 'Fiche enregistrée.');
}

export async function publishProduct(fd) {
  const who = admin();
  const key = str(fd, 'key', 80);
  const announce = bool(fd, 'announce');
  db().prepare('UPDATE products SET published = 1, hidden = 0 WHERE key = ?').run(key);
  if (announce) {
    const { products } = await getFullCatalog();
    const p = products.find((x) => x.key === key);
    if (p) {
      addJob('product.announce', announcePayload({ ...p, published: true }));
      db().prepare('UPDATE products SET announced_at = CURRENT_TIMESTAMP WHERE key = ?').run(key);
    }
  }
  audit(who, announce ? 'produit.publié+annonce' : 'produit.publié', key, null);
  go(`/admin/produits/${key}`, announce ? 'Publié, annonce envoyée sur Discord.' : 'Publié sur le site.');
}

export async function unpublishProduct(fd) {
  const who = admin();
  const key = str(fd, 'key', 80);
  db().prepare('UPDATE products SET published = 0 WHERE key = ?').run(key);
  audit(who, 'produit.dépublié', key, null);
  go(`/admin/produits/${key}`, 'Retiré du site.');
}

export async function syncNow() {
  const who = admin();
  revalidateTag('tebex');
  audit(who, 'tebex.synchro', null, null);
  go('/admin/produits', 'Catalogue Tebex relu.');
}

// ---------- Promotions (bandeau + coupon Tebex) ----------
export async function createPromotion(fd) {
  const who = admin();
  const name = str(fd, 'name', 60);
  const type = fd.get('type') === 'fixed' ? 'fixed' : 'percent';
  const value = Number(String(fd.get('value')).replace(',', '.'));
  const keys = fd.getAll('keys').map(String);
  const scope = fd.get('scope') === 'selected' ? keys.join(',') : 'all';
  if (!name) go('/admin/promotions', 'Donne un nom à la promotion (ex. Black Friday).', true);
  if (!(value > 0)) go('/admin/promotions', 'La valeur doit être supérieure à 0.', true);
  if (type === 'percent' && value > 100) go('/admin/promotions', 'Un pourcentage ne peut pas dépasser 100 %.', true);
  if (!scope) go('/admin/promotions', 'Coche au moins un produit, ou choisis « Tous les produits ».', true);
  const starts = str(fd, 'starts', 30) || null;
  const ends = str(fd, 'ends', 30) || null;
  let coupon = str(fd, 'coupon', 40).toUpperCase() || null;
  let couponId = null;

  if (bool(fd, 'tebex') && pluginEnabled()) {
    coupon = coupon || `PROMO${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const { products } = await getFullCatalog();
    const ids = scope === 'all' ? [] : products.filter((p) => keys.includes(p.key) && p.tebexId).map((p) => p.tebexId);
    try {
      const c = await createCoupon({ code: coupon, type, value, packages: ids, expires: ends ? ends.slice(0, 10) : null, startDate: starts ? starts.slice(0, 10) : null, note: `Promo ${name}` });
      couponId = c.id ? String(c.id) : null;
    } catch (e) { go('/admin/promotions', `Coupon Tebex refusé : ${e.message}`, true); }
  }

  db().prepare('INSERT INTO promotions (name, type, value, scope, starts_at, ends_at, banner, coupon, tebex_coupon_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(name, type, value, scope, parisIso(starts), parisIso(ends), str(fd, 'banner', 60) || name, coupon, couponId);

  if (bool(fd, 'announce')) {
    addJob('promo.announce', {
      title: name, banner: str(fd, 'banner', 60) || name,
      text: `${type === 'percent' ? `−${value} %` : `−${value} €`} sur ${scope === 'all' ? 'tout le catalogue' : `${keys.length} script(s)`}${ends ? `, jusqu’au ${new Date(parisIso(ends)).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}` : ''}.`,
      url: `${siteUrl()}/#scripts`,
    });
  }
  audit(who, 'promo.créée', name, { type, value, scope, coupon });
  go('/admin/promotions', coupon ? `Promo créée (coupon ${coupon}).` : 'Promo créée.');
}

export async function togglePromotion(fd) {
  const who = admin();
  const id = Number(fd.get('id'));
  db().prepare('UPDATE promotions SET active = 1 - active WHERE id = ?').run(id);
  audit(who, 'promo.basculée', String(id), null);
  go('/admin/promotions', 'Promo mise à jour.');
}

export async function deletePromotion(fd) {
  const who = admin();
  const id = Number(fd.get('id'));
  const p = db().prepare('SELECT * FROM promotions WHERE id = ?').get(id);
  if (p?.tebex_coupon_id && pluginEnabled()) await deleteCoupon(p.tebex_coupon_id).catch(() => {});
  db().prepare('DELETE FROM promotions WHERE id = ?').run(id);
  audit(who, 'promo.supprimée', p?.name, null);
  go('/admin/promotions', 'Promo supprimée.');
}

// ---------- Codes promo Tebex ----------
export async function createCode(fd) {
  const who = admin();
  if (!pluginEnabled()) go('/admin/codes', 'Ajoute TEBEX_SECRET_KEY dans le .env.', true);
  const code = str(fd, 'code', 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  const type = fd.get('type') === 'fixed' ? 'fixed' : 'percent';
  const value = Number(String(fd.get('value')).replace(',', '.'));
  if (!code) go('/admin/codes', 'Indique le code (lettres et chiffres).', true);
  if (!(value > 0) || (type === 'percent' && value > 100)) go('/admin/codes', 'Valeur invalide (entre 0 et 100 % pour un pourcentage).', true);
  const keys = fd.getAll('keys').map(String);
  const { products } = await getFullCatalog();
  const ids = fd.get('scope') === 'selected' ? products.filter((p) => keys.includes(p.key) && p.tebexId).map((p) => p.tebexId) : [];
  try {
    await createCoupon({ code, type, value, packages: ids, expires: str(fd, 'expires', 10) || null, maxUses: Number(fd.get('max')) || 0 });
  } catch (e) { go('/admin/codes', `Tebex : ${e.message}`, true); }
  audit(who, 'code.créé', code, { type, value });
  go('/admin/codes', `Code ${code} créé.`);
}

export async function removeCode(fd) {
  const who = admin();
  const id = str(fd, 'id', 40);
  try { await deleteCoupon(id); } catch (e) { go('/admin/codes', e.message, true); }
  audit(who, 'code.supprimé', id, null);
  go('/admin/codes', 'Code supprimé.');
}

// ---------- Maintenance ----------
export async function saveMaintenance(fd) {
  const who = admin();
  const on = bool(fd, 'on');
  const was = getSetting('maintenance', false);
  setSetting('maintenance', on);
  setSetting('maintenance_message', str(fd, 'message', 300));
  setSetting('maintenance_until', str(fd, 'until', 60));
  if (bool(fd, 'announce') && on !== was) addJob('maintenance.changed', { on, message: str(fd, 'message', 300), until: str(fd, 'until', 60) });
  audit(who, on ? 'maintenance.activée' : 'maintenance.désactivée', null, null);
  go('/admin/maintenance', on ? 'Maintenance activée.' : 'Site en ligne.');
}

// ---------- Mises à jour de scripts ----------
export async function publishUpdate(fd) {
  const who = admin();
  const key = str(fd, 'key', 80);
  const version = str(fd, 'version', 20);
  const notes = str(fd, 'notes', 3500);
  if (!key || !version || !notes) go('/admin/mises-a-jour', 'Script, version et notes obligatoires.', true);
  const { products } = await getFullCatalog();
  const p = products.find((x) => x.key === key);
  if (!p) go('/admin/mises-a-jour', 'Script introuvable.', true);
  db().prepare('INSERT INTO changelogs (product_key, version, notes, author) VALUES (?, ?, ?, ?)').run(key, version, notes, who);
  db().prepare('UPDATE products SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(version, key);
  if (bool(fd, 'announce')) {
    addJob('script.updated', { key, name: p.name, version, notes, url: `${siteUrl()}/scripts/${p.slug}`, image: absUrl(p.img), notifyClients: bool(fd, 'clients') });
  }
  audit(who, 'maj.publiée', key, { version });
  go('/admin/mises-a-jour', `${p.name} ${version} publiée.`);
}

// ---------- Annonces Discord ----------
export async function sendAnnouncement(fd) {
  const who = admin();
  const channel = str(fd, 'channel', 30);
  const title = str(fd, 'title', 200);
  const text = str(fd, 'text', 3800);
  if (!title || !text) go('/admin/annonces', 'Titre et texte obligatoires.', true);
  let image = str(fd, 'image_url', 500) || null;
  try {
    const up = await saveUpload(fd.get('image_file'));
    if (up) image = up;
  } catch (e) { go('/admin/annonces', e.message, true); }
  addJob('announce.custom', { channel, title, text, image: absUrl(image), ping: str(fd, 'ping', 30) || null, link: str(fd, 'link', 300) || null });
  audit(who, 'annonce.envoyée', channel, { title });
  go('/admin/annonces', 'Annonce envoyée au bot.');
}

// ---------- Clients, devis, jobs, réglages ----------
export async function resyncCustomer(fd) {
  const who = admin();
  const id = str(fd, 'discord_id', 30);
  addJob('customer.resync', { discord_id: id });
  audit(who, 'client.resync', id, null);
  go('/admin/clients', 'Rôle et salon resynchronisés par le bot.');
}

export async function setQuoteStatus(fd) {
  const who = admin();
  db().prepare('UPDATE quotes SET status = ? WHERE id = ?').run(str(fd, 'status', 20), Number(fd.get('id')));
  audit(who, 'devis.statut', String(fd.get('id')), str(fd, 'status', 20));
  go('/admin/devis', 'Statut mis à jour.');
}

export async function retryJob(fd) {
  const who = admin();
  db().prepare("UPDATE jobs SET status = 'pending', attempts = 0, error = NULL, run_after = 0 WHERE id = ?").run(Number(fd.get('id')));
  audit(who, 'job.relancé', String(fd.get('id')), null);
  go('/admin/journal', 'Tâche relancée.');
}

export async function saveSettings(fd) {
  const who = admin();
  setSetting('auto_announce', bool(fd, 'auto_announce'));
  setSetting('top_banner', str(fd, 'top_banner', 200));
  audit(who, 'réglages.modifiés', null, null);
  go('/admin/reglages', 'Réglages enregistrés.');
}
