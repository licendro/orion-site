import { guard } from '../guard';
import { getFullCatalog } from '../../../lib/catalog';
import { eur } from '../../../lib/format';
import { syncNow } from '../actions';
import { Flash, Head, when } from '../ui';

export default async function Products({ searchParams }) {
  guard('products');
  const { mode, products } = await getFullCatalog();
  const sorted = [...products].sort((a, b) => (a.published - b.published) || b.pop - a.pop);
  return (
    <>
      <Head title="Produits" sub={mode === 'tebex' ? 'Synchronisés depuis Tebex toutes les 5 minutes. Les prix se changent sur Tebex.' : 'Catalogue de démonstration (pas de clé Tebex).'}>
        <form action={syncNow}><button className="btn sm">Relire Tebex maintenant</button></form>
      </Head>
      <Flash searchParams={searchParams} />
      <div className="panel"><div className="tscroll"><table className="tbl">
        <thead><tr><th></th><th>Script</th><th>Prix</th><th>Version</th><th>État</th><th>Annonce</th><th></th></tr></thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.key}>
              <td><img className="thumb" src={p.img} alt="" style={{ objectPosition: p.pos }} /></td>
              <td><b>{p.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{p.catName}{p.bundle.length ? ' · pack' : ''}</div></td>
              <td>{eur(p.price)}{p.was ? <s className="muted" style={{ marginLeft: 6 }}>{eur(p.was)}</s> : null}</td>
              <td className="mono">{p.ver || '—'}</td>
              <td>{!p.published ? <span className="pill2 warn">Brouillon</span> : p.hidden ? <span className="pill2 off">Masqué</span> : <span className="pill2 ok">En ligne</span>}</td>
              <td className="muted" style={{ fontSize: 13 }}>{p.announcedAt ? when(p.announcedAt) : '—'}</td>
              <td><a className="btn sm" href={`/admin/produits/${p.key}`}>Modifier</a></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </>
  );
}
