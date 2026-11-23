import { guard } from '../guard';
import { db } from '../../../lib/db';
import { IDEA_KIND, IDEA_STATUS } from '../../../db/ideas.mjs';
import { Flash, Head, when } from '../ui';

export default function Ideas({ searchParams }) {
  guard('ideas');
  const f = searchParams?.f || 'ouvertes';
  const where = f === 'ouvertes' ? "WHERE i.status IN ('nouvelle','etude','prevue','dev')" : f === 'closes' ? "WHERE i.status IN ('sortie','refusee')" : '';
  const ideas = db().prepare(`SELECT i.*, COALESCE(SUM(v.value > 0), 0) up, COALESCE(SUM(v.value < 0), 0) down FROM ideas i
    LEFT JOIN idea_votes v ON v.idea_id = i.id ${where} GROUP BY i.id ORDER BY (COALESCE(SUM(v.value), 0)) DESC, i.id DESC LIMIT 300`).all();
  const tab = (k, l) => <a className={`btn sm${f === k ? ' pri' : ''}`} href={`/admin/idees?f=${k}`}>{l}</a>;
  return (
    <>
      <Head title="Idées" sub="Proposées sur le site (/idees), avec /idee ou en postant dans #suggestions. Classées par votes. Un changement de statut prévient l’auteur et ceux qui ont voté 👍." />
      <Flash searchParams={searchParams} />
      <div className="actions" style={{ marginBottom: 14 }}>{tab('ouvertes', 'Ouvertes')}{tab('closes', 'Réalisées / refusées')}{tab('toutes', 'Toutes')}</div>
      <div className="panel"><div className="tscroll"><table className="tbl">
        <thead><tr><th>Votes</th><th>Idée</th><th>Type</th><th>Statut</th><th>Par</th><th>Date</th></tr></thead>
        <tbody>{ideas.length ? ideas.map((x) => (
          <tr key={x.id}>
            <td className="mono"><b>{x.up - x.down >= 0 ? '+' : ''}{x.up - x.down}</b> <span className="muted">({x.up}/{x.down})</span></td>
            <td><a href={`/admin/idees/${x.id}`}><b>#{x.id} {x.title}</b></a></td>
            <td>{IDEA_KIND[x.kind]?.emoji} {IDEA_KIND[x.kind]?.label}</td>
            <td>{IDEA_STATUS[x.status]?.emoji} {IDEA_STATUS[x.status]?.label}</td>
            <td>{x.author_name || '—'}</td>
            <td className="muted">{when(x.created_at)}</td>
          </tr>
        )) : <tr><td colSpan="6" className="muted">Aucune idée.</td></tr>}</tbody>
      </table></div></div>
    </>
  );
}
