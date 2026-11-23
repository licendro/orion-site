import { guard } from '../guard';
import { db } from '../../../lib/db';
import { getFullCatalog } from '../../../lib/catalog';
import { BUG_SEVERITY, BUG_STATUS, bugLabel } from '../../../db/bugs.mjs';
import { saveBug } from '../actions';
import { Flash, Head, when } from '../ui';

export default async function Bugs({ searchParams }) {
  guard('bugs');
  const { products } = await getFullCatalog();
  const f = searchParams?.f || 'ouverts';
  const prod = searchParams?.script || '';
  const where = [f === 'ouverts' ? "b.status IN ('nouveau','confirme','en_cours','corrige')" : f === 'clos' ? "b.status IN ('publie','refuse','doublon')" : '1=1'];
  const args = [];
  if (prod) { where.push('b.product_key = ?'); args.push(prod); }
  const bugs = db().prepare(`SELECT b.*, p.name product, (SELECT COUNT(*) FROM bug_followers f WHERE f.bug_id = b.id) followers
    FROM bugs b LEFT JOIN products p ON p.key = b.product_key WHERE ${where.join(' AND ')}
    ORDER BY CASE WHEN b.status IN ('publie','refuse','doublon') THEN 1 ELSE 0 END,
      CASE b.severity WHEN 'critique' THEN 0 WHEN 'genant' THEN 1 ELSE 2 END, b.updated_at DESC LIMIT 300`).all(...args);
  const counts = db().prepare('SELECT status, COUNT(*) n FROM bugs GROUP BY status').all().reduce((a, r) => ({ ...a, [r.status]: r.n }), {});
  const tab = (k, label) => <a className={`btn sm${f === k ? ' pri' : ''}`} href={`/admin/bugs?f=${k}${prod ? `&script=${prod}` : ''}`}>{label}</a>;

  return (
    <>
      <Head title="Bugs" sub="Chaque changement de statut prévient le client et ceux qui ont cliqué « J’ai aussi ce bug » (MP Discord). Sur Discord : /bug creer dans un post #bug-report ou un ticket." />
      <Flash searchParams={searchParams} />
      <div className="actions" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
        {tab('ouverts', `Ouverts (${['nouveau', 'confirme', 'en_cours', 'corrige'].reduce((a, k) => a + (counts[k] || 0), 0)})`)}
        {tab('clos', 'Clôturés')}
        {tab('tous', 'Tous')}
        <form className="actions" method="get">
          <input type="hidden" name="f" value={f} />
          <select className="field" name="script" defaultValue={prod} style={{ minHeight: 36 }}><option value="">Tous les scripts</option>{products.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
          <button className="btn sm">Filtrer</button>
        </form>
      </div>

      <div className="panel"><div className="tscroll"><table className="tbl">
        <thead><tr><th>#</th><th>Bug</th><th>Script</th><th>Statut</th><th>Concernés</th><th>Mis à jour</th></tr></thead>
        <tbody>{bugs.length ? bugs.map((b) => (
          <tr key={b.id}>
            <td className="mono">#{b.id}</td>
            <td><a href={`/admin/bugs/${b.id}`}><b>{BUG_SEVERITY[b.severity]?.emoji} {b.title}</b></a></td>
            <td>{b.product || b.product_key || '—'}</td>
            <td>{BUG_STATUS[b.status]?.emoji} {bugLabel(b.status, b.fixed_version)}</td>
            <td>{(b.reporter_id ? 1 : 0) + b.followers}</td>
            <td className="muted">{when(b.updated_at)}</td>
          </tr>
        )) : <tr><td colSpan="6" className="muted">Aucun bug ici. 🎉</td></tr>}</tbody>
      </table></div></div>

      <h2 style={{ fontSize: 20, margin: '28px 0 12px' }}>Ajouter un bug à la main</h2>
      <div className="panel">
        <form action={saveBug} className="pb frm" noValidate>
          <label>Titre<input className="field" name="title" required maxLength={120} placeholder="ex. Le garage ne sauvegarde pas les mods" /></label>
          <label>Script<select className="field" name="product">{products.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
          <label>Gravité<select className="field" name="severity" defaultValue="genant">{Object.entries(BUG_SEVERITY).map(([k, s]) => <option key={k} value={k}>{s.emoji} {s.label}</option>)}</select></label>
          <label>Statut<select className="field" name="status" defaultValue="confirme">{Object.entries(BUG_STATUS).filter(([, s]) => s.open).map(([k, s]) => <option key={k} value={k}>{s.emoji} {s.label}</option>)}</select></label>
          <label className="full">ID Discord du client <span className="hint">Facultatif : il sera prévenu à chaque étape</span><input className="field mono" name="reporter" maxLength={30} /></label>
          <label className="full">Description<textarea name="description" maxLength={1500} /></label>
          <div className="full actions"><button className="btn pri">Créer le bug</button></div>
        </form>
      </div>
    </>
  );
}
