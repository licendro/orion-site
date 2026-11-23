import { notFound } from 'next/navigation';
import { guard } from '../../guard';
import { db } from '../../../../lib/db';
import { getDocs } from '../../../../lib/docs';
import { getFullCatalog } from '../../../../lib/catalog';
import { DOC_CATEGORIES } from '../../../../content/docs';
import { deleteDoc, saveDoc } from '../../actions';
import { Flash, Head } from '../../ui';

export default async function EditDoc({ params, searchParams }) {
  guard('docs');
  const isNew = params.slug === 'nouveau';
  const { products } = await getFullCatalog();
  let d = isNew ? null : db().prepare('SELECT * FROM docs WHERE slug = ?').get(params.slug);
  if (!isNew && !d) notFound();
  if (isNew && searchParams?.product) {
    // Part de la page générée automatiquement pour ce script
    const { docs } = await getDocs();
    const auto = docs.find((x) => x.auto && x.product_key === searchParams.product);
    if (auto) d = { ...auto, slug: auto.slug, published: 1, sort: 500 };
  }
  d = d || { title: '', slug: '', category: 'Démarrer', summary: '', body: '', sort: 100, published: 1, product_key: '' };

  return (
    <>
      <Head title={isNew ? 'Nouvelle page' : d.title} sub={isNew ? 'Écrite en Markdown.' : `/docs/${d.slug}`}>
        {!isNew ? <a className="btn sm" href={`/docs/${d.slug}`} target="_blank">Voir la page</a> : null}
        <a className="btn sm" href="/admin/docs">← Documentation</a>
      </Head>
      <Flash searchParams={searchParams} />
      <div className="panel">
        <form action={saveDoc} className="pb frm" noValidate>
          <input type="hidden" name="old_slug" value={isNew ? '' : d.slug} />
          <label>Titre<input className="field" name="title" required maxLength={120} defaultValue={d.title} /></label>
          <label>Adresse <span className="hint">Vide = générée depuis le titre</span><input className="field mono" name="slug" maxLength={80} defaultValue={d.slug} /></label>
          <label>Catégorie
            <select className="field" name="category" defaultValue={d.category}>{[...new Set([...DOC_CATEGORIES, d.category])].map((c) => <option key={c}>{c}</option>)}</select>
          </label>
          <label>Script lié <span className="hint">Remplace la page auto de ce script</span>
            <select className="field" name="product_key" defaultValue={d.product_key || ''}><option value="">Aucun</option>{products.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
          </label>
          <label className="full">Résumé<input className="field" name="summary" maxLength={240} defaultValue={d.summary || ''} /></label>
          <label className="full">Contenu <span className="hint">Markdown : ## Titre, **gras**, - liste, [lien](/docs/…), ```cfg … ``` pour du code, | tableaux |</span>
            <textarea name="body" maxLength={60000} defaultValue={d.body} style={{ minHeight: 420, fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }} />
          </label>
          <label>Ordre <span className="hint">Plus petit = plus haut</span><input className="field" name="sort" type="number" defaultValue={d.sort} /></label>
          <div className="chks" style={{ alignSelf: 'end' }}><label className="chk"><input type="checkbox" name="published" defaultChecked={!!d.published} /> Publiée</label></div>
          <div className="full actions"><button className="btn pri">Enregistrer</button></div>
        </form>
      </div>
      {!isNew ? (
        <form action={deleteDoc}><input type="hidden" name="slug" value={d.slug} /><button className="btn sm danger">Supprimer cette page</button></form>
      ) : null}
    </>
  );
}
