import { notFound } from 'next/navigation';
import { getDoc, getDocs, renderDoc } from '../../../lib/docs';
import { can, getRole, getUser } from '../../../lib/auth';

export async function generateMetadata({ params }) {
  const d = await getDoc(params.slug);
  return d ? { title: `${d.title} · Documentation`, description: d.summary } : { title: 'Documentation' };
}

export default async function DocPage({ params }) {
  const { docs, categories } = await getDocs();
  const d = docs.find((x) => x.slug === params.slug);
  if (!d) notFound();
  const { html, toc } = renderDoc(d.body);
  const ordered = categories.flatMap((c) => docs.filter((x) => x.category === c));
  const i = ordered.findIndex((x) => x.slug === d.slug);
  const prev = ordered[i - 1], next = ordered[i + 1];
  const editable = can(getRole(getUser()), 'docs');

  return (
    <main className="band" style={{ paddingTop: 'clamp(32px,5vw,56px)' }}>
      <div className="wrap docs">
        <aside className="dside" aria-label="Sommaire de la documentation">
          <a href="/docs" className="dback">← Documentation</a>
          {categories.map((c) => (
            <div key={c}>
              <span>{c}</span>
              {docs.filter((x) => x.category === c).map((x) => <a key={x.slug} href={`/docs/${x.slug}`} className={x.slug === d.slug ? 'on' : ''}>{x.title}</a>)}
            </div>
          ))}
        </aside>
        <article className="dbody">
          <div className="crumbs" style={{ marginBottom: 12 }}>{d.category}</div>
          <h1>{d.title}</h1>
          {d.summary ? <p className="sub" style={{ marginTop: 10 }}>{d.summary}</p> : null}
          {editable ? <a className="btn sm" href={d.auto ? `/admin/docs/nouveau?product=${d.product_key}` : `/admin/docs/${d.slug}`} style={{ marginTop: 14 }}>{d.auto ? 'Créer une page dédiée' : 'Modifier cette page'}</a> : null}
          <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
          <nav className="dnav">
            {prev ? <a href={`/docs/${prev.slug}`}><span>Précédent</span>{prev.title}</a> : <span />}
            {next ? <a href={`/docs/${next.slug}`} style={{ textAlign: 'right' }}><span>Suivant</span>{next.title}</a> : null}
          </nav>
        </article>
        {toc.length > 1 ? (
          <aside className="dtoc" aria-label="Sur cette page">
            <span>Sur cette page</span>
            {toc.map((t) => <a key={t.id} href={`#${t.id}`}>{t.text}</a>)}
          </aside>
        ) : <div />}
      </div>
    </main>
  );
}
