import { notFound } from 'next/navigation';
import { getFullCatalog } from '../../../../lib/catalog';
import { db } from '../../../../lib/db';
import { eur } from '../../../../lib/format';
import { publishProduct, saveProduct, unpublishProduct } from '../../actions';
import { Flash, Head, when } from '../../ui';

export default async function EditProduct({ params, searchParams }) {
  const { products } = await getFullCatalog();
  const p = products.find((x) => x.key === params.key);
  if (!p) notFound();
  const row = db().prepare('SELECT * FROM products WHERE key = ?').get(p.key) || {};
  const logs = db().prepare('SELECT * FROM changelogs WHERE product_key = ? ORDER BY created_at DESC LIMIT 10').all(p.key);

  return (
    <>
      <Head title={p.name} sub={`${p.catName} · ${eur(p.price)}${p.tebexId ? ` · package Tebex #${p.tebexId}` : ''}`}>
        <a className="btn sm" href={`/scripts/${p.slug}`} target="_blank">Voir la fiche</a>
        <a className="btn sm" href="/admin/produits">← Produits</a>
      </Head>
      <Flash searchParams={searchParams} />

      <div className="panel">
        <h2>Publication</h2>
        <div className="pb actions">
          <span>{!p.published ? <span className="pill2 warn">Brouillon : invisible sur le site</span> : p.hidden ? <span className="pill2 off">Masqué</span> : <span className="pill2 ok">En ligne</span>}</span>
          <span className="muted" style={{ fontSize: 13 }}>Dernière annonce Discord : {p.announcedAt ? when(p.announcedAt) : 'jamais'}</span>
          <form action={publishProduct} className="actions">
            <input type="hidden" name="key" value={p.key} />
            <input type="hidden" name="announce" value="1" />
            <button className="btn sm hot">{p.published ? 'Annoncer sur Discord' : 'Publier + annoncer'}</button>
          </form>
          {!p.published ? (
            <form action={publishProduct}><input type="hidden" name="key" value={p.key} /><button className="btn sm">Publier sans annonce</button></form>
          ) : (
            <form action={unpublishProduct}><input type="hidden" name="key" value={p.key} /><button className="btn sm danger">Retirer du site</button></form>
          )}
        </div>
      </div>

      <div className="panel">
        <h2>Fiche du site</h2>
        <form action={saveProduct} className="pb frm">
          <input type="hidden" name="key" value={p.key} />
          <label className="full">Description courte (cartes et annonce Discord)
            <input className="field" name="short" maxLength={200} defaultValue={row.short || ''} placeholder={p.desc} />
          </label>
          <label className="full">Description longue (fiche produit) <span className="hint">Vide = description Tebex</span>
            <textarea name="description" maxLength={5000} defaultValue={row.description || ''} placeholder={p.longDesc} />
          </label>
          <label className="full">Points forts <span className="hint">Un par ligne</span>
            <textarea name="features" maxLength={3000} defaultValue={row.features || p.feat.join('\n')} />
          </label>
          <label>Version<input className="field mono" name="version" maxLength={20} defaultValue={row.version || p.ver || ''} placeholder="1.0.0" /></label>
          <label>Ordre d’affichage <span className="hint">1 = en premier, 0 = automatique</span><input className="field" name="sort" type="number" min="0" max="999" defaultValue={row.sort || 0} /></label>
          <label>Image (URL)<input className="field" name="image_url" maxLength={500} defaultValue={row.image || ''} placeholder={p.img} /></label>
          <label>Ou envoyer une image <span className="hint">PNG / JPG / WEBP, 5 Mo max, 16:9 conseillé</span><input className="field" name="image_file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ paddingTop: 10 }} /></label>
          <label>Vidéo (YouTube…)<input className="field" name="video" maxLength={300} defaultValue={row.video || ''} /></label>
          <label>Scripts du pack <span className="hint">Noms séparés par des virgules, seulement pour un pack</span><input className="field" name="bundle" maxLength={500} defaultValue={row.bundle || p.bundle.join(',')} /></label>
          <div className="full chks">
            <label className="chk"><input type="checkbox" name="featured" defaultChecked={p.featured} /> Grande carte dans le catalogue</label>
            <label className="chk"><input type="checkbox" name="hidden" defaultChecked={!!row.hidden} /> Masquer du site</label>
            {row.image ? <label className="chk"><input type="checkbox" name="image_reset" /> Revenir à l’image par défaut</label> : null}
          </div>
          <div className="full actions"><button className="btn pri" type="submit">Enregistrer</button><img src={p.img} alt="" style={{ height: 54, border: '1px solid var(--line)' }} /></div>
        </form>
      </div>

      {logs.length ? (
        <div className="panel"><h2>Historique des versions</h2><table className="tbl"><tbody>
          {logs.map((l) => <tr key={l.id}><td className="mono">{l.version}</td><td style={{ whiteSpace: 'pre-line' }}>{l.notes}</td><td className="muted">{when(l.created_at)}</td></tr>)}
        </tbody></table></div>
      ) : null}
    </>
  );
}
