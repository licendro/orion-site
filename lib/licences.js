// Client de l'API de licences (service séparé sur le même VPS, port 3020).
// Le site parle à l'API en local avec un jeton secret ; l'API publique passe par api.jdev-hub.fr.
const BASE = () => (process.env.LICENCE_API_URL || 'http://127.0.0.1:3020').replace(/\/+$/, '');
export const licencesEnabled = () => !!process.env.LICENCE_ADMIN_TOKEN;

async function call(path, { method = 'GET', body, admin = true, revalidate } = {}) {
  const res = await fetch(`${BASE()}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(admin ? { Authorization: `Bearer ${process.env.LICENCE_ADMIN_TOKEN || ''}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
    ...(revalidate ? { next: { revalidate } } : { cache: 'no-store' }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(j.error || `API de licences : erreur ${res.status}`); e.status = res.status; e.data = j; throw e; }
  return j;
}
const q = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString();

export const myLicences = (discordId) => call(`/v1/admin/licences?${q({ discord: discordId })}`).then((r) => r.licences);
export const listLicences = (filters = {}) => call(`/v1/admin/licences?${q(filters)}`).then((r) => r.licences);
export const createLicence = (data) => call('/v1/admin/licences', { method: 'POST', body: data }).then((r) => r.licence);
export const setLicenceStatus = (id, status, reason, by) => call(`/v1/admin/licences/${id}/status`, { method: 'POST', body: { status, reason, by } });
export const setLicenceIp = (id, data) => call(`/v1/admin/licences/${id}/ip`, { method: 'POST', body: data });
export const licenceLogs = (id) => call(`/v1/admin/licences/${id}/logs`).then((r) => r.logs);
export const listScripts = () => call('/v1/admin/scripts').then((r) => r.scripts);
export const saveScript = (data) => call('/v1/admin/scripts', { method: 'POST', body: data });
export const publishVersion = (data) => call('/v1/admin/versions', { method: 'POST', body: data });
export const licenceStats = () => call('/v1/admin/stats');
export const forgetMember = (discordId) => call(`/v1/admin/forget/${discordId}`, { method: 'POST', body: {} });

// Changelog public (mis en cache 60 s par Next)
export const changelogAll = () => call('/v1/changelog', { admin: false, revalidate: 60 });
export const changelogOf = (script) => call(`/v1/changelog/${encodeURIComponent(script)}`, { admin: false, revalidate: 60 });

// Transfère tel quel un webhook Tebex à l'API (elle vérifie elle-même la signature)
export async function forwardTebexWebhook(raw, signature) {
  if (!licencesEnabled()) return;
  try {
    await fetch(`${BASE()}/v1/webhooks/tebex`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Signature': signature || '' }, body: raw, signal: AbortSignal.timeout(8000),
    });
  } catch { /* l'API rejouera rien d'elle-même : l'alerte « tâches en échec » du site prend le relais si besoin */ }
}

// Badges d'une version, devinés depuis les lignes des notes si besoin (+ ajout, ~ amélioration, - / fix correctif)
export function guessKinds(notes) {
  const k = new Set();
  for (const l of String(notes || '').split('\n').map((x) => x.trim())) {
    if (/^\+/.test(l) || /^ajout/i.test(l)) k.add('ajout');
    else if (/^~/.test(l) || /^am[ée]lior/i.test(l)) k.add('amelioration');
    else if (/^-/.test(l) || /^(fix|correct)/i.test(l)) k.add('correctif');
  }
  return [...k];
}
export const KIND_LABEL = { ajout: 'Ajout', correctif: 'Correctif', amelioration: 'Amélioration' };
