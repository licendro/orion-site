import { guard } from '../guard';
import { getDocs } from '../../../lib/docs';
import { Flash, Head, when } from '../ui';

export default async function AdminDocs({ searchParams }) {
  guard('docs');
  const { docs, categories } = await getDocs({ includeDrafts: true });
  return (
    <>
      <Head title="Documentation" sub="Les pages « auto » sont générées depuis la fiche du script tant qu’aucune page dédiée n’existe.">
        <a className="btn sm" href="/docs" target="_blank">Voir la doc</a>
        <a className="btn sm pri" href="/admin/docs/nouveau">Nouvelle page</a>
      </Head>
      <Flash searchParams={searchParams} />
      {categories.map((c) => (
        <div className="panel" key={c}>
          <h2>{c}</h2>
          <div className="tscroll"><table className="tbl"><tbody>
            {docs.filter((d) => d.category === c).map((d) => (
              <tr key={d.slug}>
                <td><b>{d.title}</b><div className="muted" style={{ fontSize: 12.5 }}>/docs/{d.slug}</div></td>
                <td>{d.auto ? <span className="pill2 off">Auto</span> : d.published ? <span className="pill2 ok">Publiée</span> : <span className="pill2 warn">Brouillon</span>}</td>
                <td className="muted" style={{ fontSize: 13 }}>{d.auto ? '—' : when(d.updated_at)}</td>
                <td><a className="btn sm" href={d.auto ? `/admin/docs/nouveau?product=${d.product_key}` : `/admin/docs/${d.slug}`}>{d.auto ? 'Créer la page' : 'Modifier'}</a></td>
              </tr>
            ))}
          </tbody></table></div>
        </div>
      ))}
    </>
  );
}
