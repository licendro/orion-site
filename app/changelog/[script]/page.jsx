import { notFound } from 'next/navigation';
import { changelogOf } from '../../../lib/licences';
import { db } from '../../../lib/db';
import { getCatalog } from '../../../lib/catalog';
import { VersionEntry } from '../../../components/Changelog';

export const dynamic = 'force-dynamic';

async function load(script) {
  try { return await changelogOf(script); } catch (e) {
    if (e.status === 404) return null;
    // Repli local si l'API ne répond pas
    const rows = db().prepare('SELECT c.*, p.name FROM changelogs c LEFT JOIN products p ON p.key = c.product_key WHERE c.product_key = ? ORDER BY c.id DESC').all(script);
    if (!rows.length) return null;
    return { script: { name: script, title: rows[0].name || script, product_key: script, latest: rows[0].version },
      versions: rows.map((r) => ({ version: r.version, date: Date.parse(r.created_at.replace(' ', 'T') + 'Z'), kinds: [], notes: r.notes })) };
  }
}

export async function generateMetadata({ params }) {
  const d = await load(params.script);
  return d ? { title: `Changelog ${d.script.title}`, description: `Toutes les versions de ${d.script.title} : ajouts, améliorations, correctifs.` } : {};
}

export default async function ChangelogScript({ params }) {
  const d = await load(params.script);
  if (!d) notFound();
  const { products } = await getCatalog();
  const product = products.find((p) => p.key === d.script.product_key);
  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap" style={{ maxWidth: 980 }}>
        <a className="muted" href="/changelog" style={{ fontSize: 14, textDecoration: 'none' }}>← Tous les changelogs</a>
        <div className="head" style={{ margin: '12px 0 28px' }}>
          <div><span className="label"><i></i>Changelog</span><h2>{d.script.title}</h2></div>
          <p className="sub">Version actuelle : <b className="mono">{d.script.latest ? `v${d.script.latest}` : '—'}</b>. Les mises à jour sont gratuites : téléchargez la dernière version dans votre Keymaster Cfx.re.
            {product ? <> <a href={`/scripts/${product.slug}`}>Voir la fiche du script →</a></> : null}</p>
        </div>
        <div className="vers">
          {d.versions.length ? d.versions.map((v) => <VersionEntry key={v.version} v={v} />) : <div className="empty">Aucune version publiée.</div>}
        </div>
      </div>
    </main>
  );
}
