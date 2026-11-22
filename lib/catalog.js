import { cache } from 'react';
import { CONTENT, DEMO_CATEGORIES } from '../content/products';
import { activePromotions, getDisplayPrice } from './pricing';
import { getCategories, tebexEnabled } from './tebex';
import { keyOf, slugOf, stripHtml } from './format';
import { addJob, db, getSetting, setSetting } from './db';
import { siteUrl } from './http';

// orn_lib : package gratuit obligatoire, base de tous les scripts.
export const LIB_KEY = 'ornlib';

const contentByKey = new Map(CONTENT.map((c) => [keyOf(c.name), c]));

// Promo visible uniquement en démonstration, pour montrer le bandeau.
const DEMO_PROMOS = [{ name: 'Lancement', type: 'percent', value: 20, scope: ['orn_hud'], banner: 'Offre de lancement' }];

// « Nouveau » : script apparu après la première synchro, il y a moins de 3 semaines.
function isRecent(created) {
  if (!created) return false;
  const t = Date.parse(created.replace(' ', 'T') + 'Z');
  const first = getSetting('synced_at', 0);
  return first > 0 && t > first + 60e3 && Date.now() - t < 21 * 864e5;
}

const lines = (s) => String(s || '').split('\n').map((l) => l.trim()).filter(Boolean);
export const absUrl = (u) => (u && u.startsWith('/') ? siteUrl() + u : u);

function build(raw, row) {
  const key = keyOf(raw.name);
  const c = contentByKey.get(key) || {};
  const r = row || {};
  const tebexText = stripHtml(raw.description || '');
  const longDesc = r.description || tebexText || c.desc || '';
  return {
    key,
    slug: slugOf(raw.slug || raw.name),
    name: raw.name,
    cat: raw.cat,
    catName: raw.catName,
    basePrice: Number(raw.price) || 0,
    tebexDiscount: Number(raw.discount) || 0,
    tebexId: raw.id ?? null,
    ident: raw.ident ?? null,
    ver: r.version || c.ver || null,
    pop: r.sort ? 1000 - r.sort : c.pop ?? 50,
    isNew: !!c.isNew || isRecent(r.created_at),
    featured: r.featured != null && row && r.featured ? true : !!c.featured,
    required: !!c.required || key === LIB_KEY,
    img: r.image || c.img || raw.image || '/img/menu.jpg',
    pos: c.pos || '50% 50%',
    desc: r.short || c.desc || tebexText.split('\n')[0].slice(0, 160),
    longDesc,
    feat: r.features ? lines(r.features) : c.feat || [],
    bundle: (r.bundle ? r.bundle.split(',') : c.bundle || []).map(keyOf).filter(Boolean),
    video: r.video || null,
    hidden: !!r.hidden,
    published: row ? !!r.published : true,
    announcedAt: r.announced_at || null,
    created: raw.created || r.created_at || null,
  };
}

// Enregistre les packages en base. Renvoie les clés des scripts apparus depuis la dernière synchro.
function sync(raws, { detect }) {
  const d = db();
  const firstSync = !getSetting('synced_once', false);
  const autoAnnounce = getSetting('auto_announce', true);
  const fresh = [];
  const insert = d.prepare('INSERT OR IGNORE INTO products (key, tebex_id, name, published) VALUES (?, ?, ?, ?)');
  const update = d.prepare('UPDATE products SET tebex_id = ?, name = ? WHERE key = ? AND (IFNULL(tebex_id, -1) <> IFNULL(?, -1) OR name <> ?)');
  d.transaction(() => {
    for (const raw of raws) {
      const key = keyOf(raw.name);
      const published = firstSync || !detect || autoAnnounce ? 1 : 0;
      const res = insert.run(key, raw.id ?? null, raw.name, published);
      if (res.changes && detect && !firstSync) fresh.push(key);
      else update.run(raw.id ?? null, raw.name, key, raw.id ?? null, raw.name);
    }
  })();
  if (firstSync) {
    d.prepare("UPDATE products SET announced_at = CURRENT_TIMESTAMP WHERE announced_at IS NULL").run();
    setSetting('synced_once', true);
    setSetting('synced_at', Date.now());
  }
  return { fresh, autoAnnounce };
}

export function announcePayload(p) {
  return {
    key: p.key, name: p.name, desc: p.desc, image: absUrl(p.img), price: p.price, was: p.was, pct: p.pct,
    version: p.ver, category: p.catName, url: `${siteUrl()}/scripts/${p.slug}`,
  };
}

async function load() {
  if (tebexEnabled()) {
    try {
      const cats = await getCategories();
      const categories = [];
      const raws = [];
      for (const cat of cats || []) {
        categories.push({ id: cat.id, name: cat.name });
        for (const p of cat.packages || []) {
          raws.push({
            id: p.id, ident: p.ident, name: p.name, slug: p.slug, description: p.description, image: p.image,
            price: p.base_price, discount: p.discount, cat: cat.id, catName: cat.name, created: p.created_at,
          });
        }
      }
      return { mode: 'tebex', categories, raws, sync: sync(raws, { detect: true }) };
    } catch (e) {
      console.error('[catalogue] Tebex indisponible :', e.message);
      return { mode: 'error', categories: [], raws: [], sync: { fresh: [] } };
    }
  }
  const catName = (id) => DEMO_CATEGORIES.find((c) => c.id === id)?.name || '';
  const raws = CONTENT.map((c) => ({ name: c.name, price: c.demoPrice, cat: c.cat, catName: catName(c.cat) }));
  return { mode: 'demo', categories: DEMO_CATEGORIES, raws, sync: sync(raws, { detect: false }) };
}

export function dbPromotions() {
  return db().prepare('SELECT * FROM promotions WHERE active = 1').all().map((p) => ({
    ...p,
    scope: p.scope === 'all' ? 'all' : p.scope.split(','),
    starts: p.starts_at,
    ends: p.ends_at,
  }));
}

// Catalogue complet (y compris brouillons et produits masqués) : pour l'admin.
export const getFullCatalog = cache(async () => {
  const { mode, categories, raws, sync: s } = await load();
  const rows = new Map(db().prepare('SELECT * FROM products').all().map((r) => [r.key, r]));
  const promos = activePromotions([...dbPromotions(), ...(mode === 'demo' ? DEMO_PROMOS : [])]);
  const products = raws.map((raw) => {
    const p = build(raw, rows.get(keyOf(raw.name)));
    return { ...p, ...getDisplayPrice(p, promos) };
  });
  // Annonce automatique des scripts apparus sur Tebex
  if (s.fresh.length && s.autoAnnounce) {
    for (const key of s.fresh) {
      const p = products.find((x) => x.key === key);
      if (!p) continue;
      addJob('product.announce', announcePayload(p));
      db().prepare('UPDATE products SET announced_at = CURRENT_TIMESTAMP WHERE key = ?').run(key);
    }
  }
  return { mode, categories, products };
});

// Catalogue public : sans les produits masqués ni les brouillons.
export const getCatalog = cache(async () => {
  const { mode, categories, products: all } = await getFullCatalog();
  const products = all.filter((p) => p.published && !p.hidden);
  const pack = products.find((p) => p.bundle.length) || null;
  const usedCats = new Set(products.filter((p) => !p.bundle.length).map((p) => p.cat));
  return { mode, products, pack, categories: categories.filter((c) => usedCats.has(c.id)) };
});

export async function getProduct(slug) {
  const { products } = await getCatalog();
  return products.find((p) => p.slug === slug) || null;
}
