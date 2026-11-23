import MarkdownIt from 'markdown-it';
import { db, getSetting, setSetting } from './db';
import { DOC_CATEGORIES, SEED_DOCS } from '../content/docs';
import { getFullCatalog } from './catalog';

const md = new MarkdownIt({ html: false, linkify: true, typographer: false });
// Liens externes dans un nouvel onglet
const defaultLink = md.renderer.rules.link_open || ((t, i, o, e, s) => s.renderToken(t, i, o));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const href = tokens[idx].attrGet('href') || '';
  if (/^https?:\/\//.test(href)) { tokens[idx].attrSet('target', '_blank'); tokens[idx].attrSet('rel', 'noopener'); }
  return defaultLink(tokens, idx, options, env, self);
};

const slugify = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Rendu Markdown sûr (HTML désactivé) + sommaire des titres ##
export function renderDoc(body) {
  const toc = [];
  let html = md.render(body || '');
  html = html.replace(/<h2>(.*?)<\/h2>/g, (_, inner) => {
    const id = slugify(inner.replace(/<[^>]+>/g, ''));
    toc.push({ id, text: inner.replace(/<[^>]+>/g, '') });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html, toc };
}

// Charge les guides fournis une seule fois (les modifications faites dans l'admin ne sont jamais écrasées)
function seed() {
  const version = 1;
  if (getSetting('docs_seed', 0) >= version) return;
  const ins = db().prepare('INSERT OR IGNORE INTO docs (slug, title, category, summary, body, sort) VALUES (?, ?, ?, ?, ?, ?)');
  db().transaction(() => { for (const d of SEED_DOCS) ins.run(d.slug, d.title, d.category, d.summary, d.body, d.sort); })();
  setSetting('docs_seed', version);
}

// Page générée pour un script qui n'a pas encore de documentation dédiée
function autoDoc(p, lib) {
  const install = ['ensure orn_lib', `ensure ${p.name}`];
  return {
    slug: `script-${p.slug}`, title: p.name, category: 'Scripts', product_key: p.key, summary: p.desc, sort: 500, auto: true,
    body: `${p.longDesc || p.desc}

## Fonctionnalités
${p.feat.map((f) => `- ${f}`).join('\n') || '- Voir la fiche du script.'}

## Installation
${p.required ? 'Démarrez orn_lib après votre framework et avant tous nos scripts.' : `Ce script a besoin de **${lib?.name || 'orn_lib'}** (gratuite). Ajoutez au \`server.cfg\` :`}

\`\`\`cfg
${p.required ? 'ensure orn_lib' : install.join('\n')}
\`\`\`

## Configuration
Tous les réglages sont dans le \`config.lua\` du script, commenté ligne par ligne. Voir [Configurer un script](/docs/configuration).

## Version
${p.ver ? `Version actuelle : **${p.ver}**. ` : ''}L’historique complet est sur la [fiche du script](/scripts/${p.slug}).`,
  };
}

export async function getDocs({ includeDrafts = false } = {}) {
  seed();
  const rows = db().prepare(`SELECT * FROM docs ${includeDrafts ? '' : 'WHERE published = 1'} ORDER BY sort, title`).all();
  const { products } = await getFullCatalog();
  const visible = products.filter((p) => p.published && !p.hidden && !p.bundle.length && !p.subscription);
  const lib = visible.find((p) => p.required);
  const covered = new Set(rows.filter((r) => r.product_key).map((r) => r.product_key));
  const auto = visible.filter((p) => !covered.has(p.key)).map((p) => autoDoc(p, lib));
  const all = [...rows, ...auto];
  const cats = [...DOC_CATEGORIES, ...new Set(all.map((d) => d.category).filter((c) => !DOC_CATEGORIES.includes(c)))];
  return { docs: all, categories: cats.filter((c) => all.some((d) => d.category === c)) };
}

export async function getDoc(slug) {
  const { docs } = await getDocs();
  return docs.find((d) => d.slug === slug) || null;
}
