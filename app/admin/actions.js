'use server';

import { redirect } from 'next/navigation';
import { revalidateTag } from 'next/cache';
import { can, getRole, getUser } from '../../lib/auth';
import { addJob, audit, db, getSetting, setSetting } from '../../lib/db';
import { absUrl, announcePayload, getFullCatalog } from '../../lib/catalog';
import { createCoupon, deleteCoupon, pluginEnabled } from '../../lib/tebexPlugin';
import { saveUpload } from '../../lib/uploads';
import { siteUrl } from '../../lib/http';

function admin(perm) {
  const u = getUser();
  const role = getRole(u);
  if (!role) redirect('/');
  if (perm && !can(role, perm)) redirect(`/admin?err=${encodeURIComponent('Ton rôle ne permet pas cette action.')}#flash`);
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
  const who = admin('products');
  const key = str(fd, 'key', 80);
  let image = str(fd, 'image_url', 500) || null;
  try {
    const up = await saveUpload(fd.get('image_file'));
    if (up) image = up;
  } catch (e) { go(`/admin/produits/${key}`, e.message, true); }
  if (bool(fd, 'image_reset')) image = null;
  // Galerie : URLs saisies (une par ligne) + images envoyées
  const gallery = str(fd, 'gallery', 4000).split('\n').map((l) => l.trim()).filter(Boolean);
  try {
    for (const f of fd.getAll('gallery_files')) {
      const up = await saveUpload(f);
      if (up) gallery.push(up);
    }
  } catch (e) { go(`/admin/produits/${key}`, e.message, true); }
  db().prepare(`UPDATE products SET short = ?, description = ?, version = ?, features = ?, video = ?, bundle = ?, image = ?, gallery = ?,
    featured = ?, hidden = ?, sort = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?`).run(
    str(fd, 'short', 200) || null, str(fd, 'description', 5000) || null, str(fd, 'version', 20) || null, str(fd, 'features', 3000) || null,
    str(fd, 'video', 300) || null, str(fd, 'bundle', 500) || null, image, gallery.slice(0, 12).join('\n') || null, bool(fd, 'featured') ? 1 : 0, bool(fd, 'hidden') ? 1 : 0,
    Number(str(fd, 'sort', 5)) || 0, key);
  audit(who, 'produit.modifié', key, null);
  go(`/admin/produits/${key}`, 'Fiche enregistrée.');
}

export async function publishProduct(fd) {
  const who = admin('products');
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
  const who = admin('products');
  const key = str(fd, 'key', 80);
  db().prepare('UPDATE products SET published = 0 WHERE key = ?').run(key);
  audit(who, 'produit.dépublié', key, null);
  go(`/admin/produits/${key}`, 'Retiré du site.');
}

export async function syncNow() {
  const who = admin('products');
  revalidateTag('tebex');
  audit(who, 'tebex.synchro', null, null);
  go('/admin/produits', 'Catalogue Tebex relu.');
}

// ---------- Promotions (bandeau + coupon Tebex) ----------
export async function createPromotion(fd) {
  const who = admin('promotions');
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
  const who = admin('promotions');
  const id = Number(fd.get('id'));
  db().prepare('UPDATE promotions SET active = 1 - active WHERE id = ?').run(id);
  audit(who, 'promo.basculée', String(id), null);
  go('/admin/promotions', 'Promo mise à jour.');
}

export async function deletePromotion(fd) {
  const who = admin('promotions');
  const id = Number(fd.get('id'));
  const p = db().prepare('SELECT * FROM promotions WHERE id = ?').get(id);
  if (p?.tebex_coupon_id && pluginEnabled()) await deleteCoupon(p.tebex_coupon_id).catch(() => {});
  db().prepare('DELETE FROM promotions WHERE id = ?').run(id);
  audit(who, 'promo.supprimée', p?.name, null);
  go('/admin/promotions', 'Promo supprimée.');
}

// ---------- Codes promo Tebex ----------
export async function createCode(fd) {
  const who = admin('codes');
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
  const who = admin('codes');
  const id = str(fd, 'id', 40);
  try { await deleteCoupon(id); } catch (e) { go('/admin/codes', e.message, true); }
  audit(who, 'code.supprimé', id, null);
  go('/admin/codes', 'Code supprimé.');
}

// ---------- Maintenance ----------
export async function saveMaintenance(fd) {
  const who = admin('maintenance');
  const on = bool(fd, 'on');
  const was = getSetting('maintenance', false);
  setSetting('maintenance', on);
  if (on && !was) setSetting('maintenance_since', Date.now());
  setSetting('maintenance_message', str(fd, 'message', 300));
  setSetting('maintenance_until', str(fd, 'until', 60));
  if (bool(fd, 'announce') && on !== was) addJob('maintenance.changed', { on, message: str(fd, 'message', 300), until: str(fd, 'until', 60) });
  audit(who, on ? 'maintenance.activée' : 'maintenance.désactivée', null, null);
  go('/admin/maintenance', on ? 'Maintenance activée.' : 'Site en ligne.');
}

// ---------- Mises à jour de scripts ----------
export async function publishUpdate(fd) {
  const who = admin('updates');
  const key = str(fd, 'key', 80);
  const version = str(fd, 'version', 20);
  const notes = str(fd, 'notes', 3500);
  if (!key || !version || !notes) go('/admin/mises-a-jour', 'Script, version et notes obligatoires.', true);
  const { products } = await getFullCatalog();
  const p = products.find((x) => x.key === key);
  if (!p) go('/admin/mises-a-jour', 'Script introuvable.', true);
  db().prepare('INSERT INTO changelogs (product_key, version, notes, author) VALUES (?, ?, ?, ?)').run(key, version, notes, who);
  db().prepare('UPDATE products SET version = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?').run(version, key);
  // Les bugs « corrigé, prochaine mise à jour » de ce script sont publiés dans cette version, et les clients prévenus
  const fixed = db().prepare("SELECT id, title FROM bugs WHERE product_key = ? AND status = 'corrige'").all(key);
  for (const b of fixed) {
    db().prepare("UPDATE bugs SET status = 'publie', fixed_version = ?, note = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(version, b.id);
    addJob('bug.changed', { id: b.id, old: 'corrige' });
  }
  if (bool(fd, 'announce')) {
    addJob('script.updated', { key, name: p.name, version, notes, fixed, url: `${siteUrl()}/scripts/${p.slug}`, image: absUrl(p.img), notifyClients: bool(fd, 'clients') });
  }
  audit(who, 'maj.publiée', key, { version });
  go('/admin/mises-a-jour', `${p.name} ${version} publiée.`);
}

// ---------- Annonces Discord ----------
export async function sendAnnouncement(fd) {
  const who = admin('announcements');
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
  const who = admin('clients');
  const id = str(fd, 'discord_id', 30);
  addJob('customer.resync', { discord_id: id });
  audit(who, 'client.resync', id, null);
  go('/admin/clients', 'Rôle et salon resynchronisés par le bot.');
}

// ---------- Idées ----------
const IDEA_STATES = ['nouvelle', 'etude', 'prevue', 'dev', 'sortie', 'refusee'];
export async function saveIdea(fd) {
  const who = admin('ideas');
  const id = Number(fd.get('id'));
  const x = db().prepare('SELECT * FROM ideas WHERE id = ?').get(id);
  if (!x) go('/admin/idees', 'Idée introuvable.', true);
  const status = IDEA_STATES.includes(str(fd, 'status')) ? str(fd, 'status') : x.status;
  const released = str(fd, 'released', 80) || null;
  if (status === 'sortie' && !released) go(`/admin/idees/${id}`, 'Choisis le script sorti pour cette idée.', true);
  db().prepare(`UPDATE ideas SET title = ?, description = ?, kind = ?, status = ?, note = ?, released_key = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(str(fd, 'title', 100) || x.title, str(fd, 'description', 1500) || null, ['script', 'amelioration', 'autre'].includes(str(fd, 'kind')) ? str(fd, 'kind') : x.kind,
      status, str(fd, 'note', 500) || (x.status === status ? x.note : null), status === 'sortie' ? released : x.released_key, id);
  addJob('idea.changed', { id, old: x.status });
  audit(who, 'idée.modifiée', `#${id}`, x.status === status ? 'détails' : `${x.status} → ${status}`);
  go(`/admin/idees/${id}`, x.status === status ? 'Idée mise à jour.' : 'Statut changé : l’auteur et ceux qui ont voté pour sont prévenus.');
}

export async function deleteIdea(fd) {
  const who = admin('ideas');
  const id = Number(fd.get('id'));
  db().prepare('DELETE FROM ideas WHERE id = ?').run(id);
  audit(who, 'idée.supprimée', `#${id}`, null);
  go('/admin/idees', `Idée #${id} supprimée (supprime le post Discord à la main si besoin).`);
}

// ---------- Bugs ----------
const BUG_STATES = ['nouveau', 'confirme', 'en_cours', 'corrige', 'publie', 'refuse', 'doublon'];
export async function saveBug(fd) {
  const who = admin('bugs');
  const id = Number(fd.get('id')) || null;
  const status = BUG_STATES.includes(str(fd, 'status')) ? str(fd, 'status') : 'confirme';
  const severity = ['critique', 'genant', 'mineur'].includes(str(fd, 'severity')) ? str(fd, 'severity') : 'genant';
  const back = id ? `/admin/bugs/${id}` : '/admin/bugs';
  if (!id) {
    const title = str(fd, 'title', 120);
    if (!title) go('/admin/bugs', 'Donne un titre au bug.', true);
    const reporter = str(fd, 'reporter', 30).replace(/\D/g, '') || null;
    const { lastInsertRowid } = db().prepare(`INSERT INTO bugs (product_key, title, description, severity, status, reporter_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(str(fd, 'product', 80) || null, title, str(fd, 'description', 1500) || null, severity, status, reporter, who);
    addJob('bug.changed', { id: Number(lastInsertRowid), old: 'nouveau' });
    audit(who, 'bug.créé', `#${lastInsertRowid}`, title);
    go(`/admin/bugs/${lastInsertRowid}`, `Bug #${lastInsertRowid} créé.`);
  }
  const b = db().prepare('SELECT * FROM bugs WHERE id = ?').get(id);
  if (!b) go('/admin/bugs', 'Bug introuvable.', true);
  const dup = status === 'doublon' ? Number(fd.get('duplicate_of')) || null : null;
  if (status === 'doublon') {
    if (!dup || dup === id || !db().prepare('SELECT 1 FROM bugs WHERE id = ?').get(dup)) go(back, 'Indique le numéro du bug d’origine.', true);
    for (const w of [b.reporter_id, ...db().prepare('SELECT discord_id FROM bug_followers WHERE bug_id = ?').all(id).map((r) => r.discord_id)].filter(Boolean)) {
      db().prepare('INSERT OR IGNORE INTO bug_followers (bug_id, discord_id) VALUES (?, ?)').run(dup, w);
    }
  }
  db().prepare(`UPDATE bugs SET title = ?, description = ?, product_key = ?, severity = ?, status = ?, note = ?, fixed_version = ?, duplicate_of = ?,
    updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(str(fd, 'title', 120) || b.title, str(fd, 'description', 1500) || null, str(fd, 'product', 80) || b.product_key,
    severity, status, str(fd, 'note', 500) || (b.status === status ? b.note : null), str(fd, 'version', 20) || null, dup, id);
  addJob('bug.changed', { id, old: b.status });
  audit(who, 'bug.modifié', `#${id}`, b.status === status ? 'détails' : `${b.status} → ${status}`);
  go(back, b.status === status ? 'Bug mis à jour.' : 'Statut changé, les personnes concernées sont prévenues.');
}

export async function deleteBug(fd) {
  const who = admin('bugs');
  const id = Number(fd.get('id'));
  db().prepare('DELETE FROM bugs WHERE id = ?').run(id);
  audit(who, 'bug.supprimé', `#${id}`, null);
  go('/admin/bugs', `Bug #${id} supprimé (la fiche Discord reste, supprime-la à la main si besoin).`);
}

export async function setQuoteStatus(fd) {
  const who = admin('quotes');
  db().prepare('UPDATE quotes SET status = ? WHERE id = ?').run(str(fd, 'status', 20), Number(fd.get('id')));
  audit(who, 'devis.statut', String(fd.get('id')), str(fd, 'status', 20));
  go('/admin/devis', 'Statut mis à jour.');
}

export async function retryJob(fd) {
  const who = admin('journal');
  db().prepare("UPDATE jobs SET status = 'pending', attempts = 0, error = NULL, run_after = 0 WHERE id = ?").run(Number(fd.get('id')));
  audit(who, 'job.relancé', String(fd.get('id')), null);
  go('/admin/journal', 'Tâche relancée.');
}

export async function saveSettings(fd) {
  const who = admin('settings');
  setSetting('auto_announce', bool(fd, 'auto_announce'));
  setSetting('top_banner', str(fd, 'top_banner', 200));
  audit(who, 'réglages.modifiés', null, null);
  go('/admin/reglages', 'Réglages enregistrés.');
}

// ---------- Équipe (fondateur uniquement) ----------
export async function addTeamMember(fd) {
  const who = admin('team');
  const id = str(fd, 'discord_id', 30).replace(/\D/g, '');
  const role = fd.get('role') === 'admin' ? 'admin' : 'support';
  if (id.length < 15) go('/admin/equipe', 'Identifiant Discord invalide (17 à 20 chiffres).', true);
  db().prepare('INSERT INTO admins (discord_id, role, added_by) VALUES (?, ?, ?) ON CONFLICT(discord_id) DO UPDATE SET role = excluded.role').run(id, role, who);
  audit(who, 'équipe.ajout', id, role);
  go('/admin/equipe', 'Membre ajouté. Il se connecte à /admin avec son Discord.');
}

export async function removeTeamMember(fd) {
  const who = admin('team');
  const id = str(fd, 'discord_id', 30);
  db().prepare('DELETE FROM admins WHERE discord_id = ?').run(id);
  audit(who, 'équipe.retrait', id, null);
  go('/admin/equipe', 'Accès retiré.');
}

// ---------- Documentation ----------
export async function saveDoc(fd) {
  const who = admin('docs');
  const old = str(fd, 'old_slug', 80);
  const title = str(fd, 'title', 120);
  const slug = (str(fd, 'slug', 80) || title).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!title || !slug) go(old ? `/admin/docs/${old}` : '/admin/docs/nouveau', 'Titre obligatoire.', true);
  const vals = [title, str(fd, 'category', 40) || 'Guides', str(fd, 'product_key', 80) || null, str(fd, 'summary', 240) || null,
    String(fd.get('body') ?? '').slice(0, 60000), Number(fd.get('sort')) || 100, bool(fd, 'published') ? 1 : 0];
  if (old && old !== slug && db().prepare('SELECT 1 FROM docs WHERE slug = ?').get(slug)) go(`/admin/docs/${old}`, 'Cette adresse est déjà utilisée par une autre page.', true);
  if (old) db().prepare('UPDATE docs SET slug = ?, title = ?, category = ?, product_key = ?, summary = ?, body = ?, sort = ?, published = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?').run(slug, ...vals, old);
  else {
    if (db().prepare('SELECT 1 FROM docs WHERE slug = ?').get(slug)) go('/admin/docs/nouveau', 'Cette adresse est déjà utilisée.', true);
    db().prepare('INSERT INTO docs (slug, title, category, product_key, summary, body, sort, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(slug, ...vals);
  }
  audit(who, old ? 'doc.modifiée' : 'doc.créée', slug, null);
  go(`/admin/docs/${slug}`, 'Page enregistrée.');
}

export async function deleteDoc(fd) {
  const who = admin('docs');
  const slug = str(fd, 'slug', 80);
  db().prepare('DELETE FROM docs WHERE slug = ?').run(slug);
  audit(who, 'doc.supprimée', slug, null);
  go('/admin/docs', 'Page supprimée.');
}

// ---------- Serveur de test ----------
export async function saveTestSettings(fd) {
  const who = admin('settings');
  setSetting('test_enabled', bool(fd, 'enabled'));
  setSetting('test_connect', str(fd, 'connect', 120));
  setSetting('test_query', str(fd, 'query', 120));
  setSetting('test_slots', Math.max(1, Math.min(64, Number(fd.get('slots')) || 4)));
  setSetting('test_minutes', Math.max(5, Math.min(240, Number(fd.get('minutes')) || 30)));
  setSetting('test_clients_only', bool(fd, 'clients_only'));
  audit(who, 'essai.réglages', null, null);
  go('/admin/essai', 'Réglages du serveur de test enregistrés.');
}

export async function endTestSession(fd) {
  const who = admin('test');
  db().prepare("UPDATE test_sessions SET status = 'cancelled' WHERE id = ?").run(Number(fd.get('id')));
  audit(who, 'essai.créneau_arrêté', String(fd.get('id')), null);
  go('/admin/essai', 'Créneau arrêté.');
}

export async function rotateTestKey() {
  const who = admin('settings');
  const { rotateApiKey } = await import('../../lib/testserver');
  rotateApiKey();
  audit(who, 'essai.nouvelle_clé', null, null);
  go('/admin/essai', 'Nouvelle clé générée : mets-la à jour dans la config de orn_testgate.');
}
