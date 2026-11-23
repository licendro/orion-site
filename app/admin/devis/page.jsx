import { guard } from '../guard';
import { db } from '../../../lib/db';
import { setQuoteStatus } from '../actions';
import { Flash, Head, when } from '../ui';

const TYPES = { 'sur-mesure': 'Sur mesure', partenariat: 'Partenariat', bot: 'Bot Discord', carte: 'À la carte', other: 'Autre' };
const STATES = ['nouveau', 'en cours', 'accepté', 'refusé', 'terminé'];

export default function Quotes({ searchParams }) {
  guard('quotes');
  const quotes = db().prepare('SELECT * FROM quotes ORDER BY created_at DESC LIMIT 200').all();
  return (
    <>
      <Head title="Devis" sub="Demandes envoyées depuis le formulaire Services (aussi postées dans #devis sur Discord)." />
      <Flash searchParams={searchParams} />
      <div className="panel"><div className="tscroll"><table className="tbl">
        <thead><tr><th>Date</th><th>Discord</th><th>Service</th><th>Demande</th><th>Statut</th></tr></thead>
        <tbody>{quotes.length ? quotes.map((q) => (
          <tr key={q.id}>
            <td className="muted">{when(q.created_at)}</td>
            <td><b>{q.discord}</b></td>
            <td>{TYPES[q.type] || q.type}<div className="muted" style={{ fontSize: 12.5 }}>{q.framework} · {q.budget}</div></td>
            <td style={{ whiteSpace: 'pre-line', maxWidth: 440, fontSize: 13.5 }}>{q.message}</td>
            <td>
              <form action={setQuoteStatus} className="actions">
                <input type="hidden" name="id" value={q.id} />
                <select className="field" name="status" defaultValue={q.status} style={{ minHeight: 36 }}>{STATES.map((s) => <option key={s}>{s}</option>)}</select>
                <button className="btn sm">OK</button>
              </form>
            </td>
          </tr>
        )) : <tr><td colSpan="5" className="muted">Aucune demande.</td></tr>}</tbody>
      </table></div></div>
    </>
  );
}
