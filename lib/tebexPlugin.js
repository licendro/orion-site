// API Plugin Tebex (clé secrète) : gestion des coupons depuis l'admin. Côté serveur uniquement.
const BASE = 'https://plugin.tebex.io';

export const pluginEnabled = () => !!(process.env.TEBEX_SECRET_KEY || '').trim();

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'X-Tebex-Secret': process.env.TEBEX_SECRET_KEY, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* vide */ }
  if (!res.ok) throw new Error((json && (json.error_message || json.message)) || `Tebex ${res.status}`);
  return json;
}

export async function listCoupons() {
  const j = await call('/coupons');
  return (j && (j.data || j)) || [];
}

// type : 'percent' | 'fixed' ; packages : [ids Tebex] ou [] pour tout le panier
export function createCoupon({ code, type, value, packages = [], expires, startDate, maxUses, note }) {
  return call('/coupons', {
    method: 'POST',
    body: {
      code,
      effective_on: packages.length ? 'package' : 'cart',
      packages,
      discount_type: type === 'fixed' ? 'value' : 'percentage',
      discount_amount: type === 'fixed' ? value : 0,
      discount_percentage: type === 'percent' ? value : 0,
      redeem_unlimited: !maxUses,
      expire_never: !expires && !maxUses,
      expire_limit: maxUses || 0,
      expire_date: expires || undefined,
      start_date: startDate || new Date().toISOString().slice(0, 10),
      basket_type: 'both',
      minimum: 0,
      discount_application_method: 1,
      note: note || 'Créé depuis l’admin Orion',
    },
  }).then((j) => (j && (j.data || j)) || {});
}

export const deleteCoupon = (id) => call(`/coupons/${encodeURIComponent(id)}`, { method: 'DELETE' });
