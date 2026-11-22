import { cache } from 'react';
import { CONTENT, DEMO_CATEGORIES } from '../content/products';
import { PROMOTIONS } from '../content/promotions';
import { activePromotions, getDisplayPrice } from './pricing';
import { getCategories, tebexEnabled } from './tebex';
import { keyOf, slugOf, stripHtml } from './format';

// orn_lib est la dépendance de tous les scripts, jamais un produit : même s'il existe sur Tebex, il reste caché.
const HIDDEN = new Set(['ornlib']);

const contentByKey = new Map(CONTENT.map((c) => [keyOf(c.name), c]));

// Promo visible uniquement en démonstration, pour montrer le bandeau.
const DEMO_PROMOS = [{ name: 'Lancement', type: 'percent', value: 20, scope: ['orn_hud'], banner: 'Offre de lancement' }];

function build(raw, extra) {
  const key = keyOf(raw.name);
  const c = contentByKey.get(key) || {};
  const longDesc = stripHtml(raw.description || '');
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
    ver: c.ver || null,
    pop: c.pop ?? 50,
    isNew: !!c.isNew,
    featured: !!c.featured,
    img: c.img || raw.image || '/img/menu.jpg',
    pos: c.pos || '50% 50%',
    desc: c.desc || longDesc.split('\n')[0].slice(0, 160),
    longDesc: longDesc || c.desc || '',
    feat: c.feat || [],
    bundle: (c.bundle || []).map(keyOf),
    created: raw.created || null,
    ...extra,
  };
}

async function load() {
  if (tebexEnabled()) {
    try {
      const cats = await getCategories();
      const categories = [];
      const products = [];
      for (const cat of cats || []) {
        categories.push({ id: cat.id, name: cat.name });
        for (const p of cat.packages || []) {
          if (HIDDEN.has(keyOf(p.name))) continue;
          products.push(build({
            id: p.id, ident: p.ident, name: p.name, slug: p.slug, description: p.description, image: p.image,
            price: p.base_price, discount: p.discount, cat: cat.id, catName: cat.name, created: p.created_at,
          }));
        }
      }
      return { mode: 'tebex', categories, products, promos: activePromotions(PROMOTIONS) };
    } catch (e) {
      console.error('[catalogue] Tebex indisponible :', e.message);
      return { mode: 'error', categories: [], products: [], promos: [] };
    }
  }
  const catName = (id) => DEMO_CATEGORIES.find((c) => c.id === id)?.name || '';
  const products = CONTENT.map((c) => build({ name: c.name, price: c.demoPrice, cat: c.cat, catName: catName(c.cat) }));
  return { mode: 'demo', categories: DEMO_CATEGORIES, products, promos: activePromotions([...PROMOTIONS, ...DEMO_PROMOS]) };
}

export const getCatalog = cache(async () => {
  const { mode, categories, products, promos } = await load();
  const priced = products.map((p) => ({ ...p, ...getDisplayPrice(p, promos) }));
  const pack = priced.find((p) => p.bundle.length) || null;
  const usedCats = new Set(priced.filter((p) => !p.bundle.length).map((p) => p.cat));
  return {
    mode,
    products: priced,
    pack,
    categories: categories.filter((c) => usedCats.has(c.id)),
  };
});

export async function getProduct(slug) {
  const { products } = await getCatalog();
  return products.find((p) => p.slug === slug) || null;
}
