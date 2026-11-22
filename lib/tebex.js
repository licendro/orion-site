// Client de la Headless API Tebex, utilisé uniquement côté serveur.
const BASE = 'https://headless.tebex.io/api';

export const tebexToken = () => (process.env.TEBEX_PUBLIC_TOKEN || '').trim();
export const tebexEnabled = () => tebexToken().length > 0;

async function call(path, { method = 'GET', body, revalidate } = {}) {
  const url = `${BASE}/accounts/${encodeURIComponent(tebexToken())}${path}`;
  const res = await fetch(url, {
    method,
    headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    ...(revalidate ? { next: { revalidate } } : { cache: 'no-store' }),
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* réponse non JSON */ }
  if (!res.ok) {
    const msg = (json && (json.detail || json.message || json.title)) || `Tebex ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return json;
}

const data = (j) => (j && 'data' in j ? j.data : j);

export const getCategories = () => call('/categories?includePackages=1', { revalidate: 300 }).then(data);

export const createBasket = ({ completeUrl, cancelUrl, ip, custom }) =>
  call('/baskets', {
    method: 'POST',
    body: { complete_url: completeUrl, cancel_url: cancelUrl, complete_auto_redirect: true, custom, ...(ip ? { ip_address: ip } : {}) },
  }).then(data);

export const getBasket = (ident) => call(`/baskets/${encodeURIComponent(ident)}`).then(data);

export const getAuthLinks = (ident, returnUrl) =>
  call(`/baskets/${encodeURIComponent(ident)}/auth?returnUrl=${encodeURIComponent(returnUrl)}`).then(data);

export async function addPackage(ident, packageId, quantity = 1) {
  const body = { package_id: packageId, quantity };
  try {
    return data(await call(`/baskets/${encodeURIComponent(ident)}/packages`, { method: 'POST', body }));
  } catch (e) {
    if (e.status !== 404) throw e;
    // Certaines versions de l'API exposent cette route hors du compte.
    const res = await fetch(`${BASE}/baskets/${encodeURIComponent(ident)}/packages`, {
      method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
    });
    const j = await res.json().catch(() => null);
    if (!res.ok) throw Object.assign(new Error((j && (j.detail || j.message)) || `Tebex ${res.status}`), { status: res.status });
    return data(j);
  }
}

export const applyCoupon = (ident, code) =>
  call(`/baskets/${encodeURIComponent(ident)}/coupons`, { method: 'POST', body: { coupon_code: code } });
