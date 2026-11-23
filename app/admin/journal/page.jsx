import { guard } from '../guard';
import { db } from '../../../lib/db';
import { retryJob } from '../actions';
import { Head, Status, when } from '../ui';

const LABELS = {
  'purchase.completed': 'Achat → rôle + salon', 'purchase.revoked': 'Remboursement', 'product.announce': 'Annonce script',
  'promo.announce': 'Annonce promo', 'script.updated': 'Patch note', 'announce.custom': 'Annonce', 'customer.resync': 'Resync client',
  'maintenance.changed': 'Maintenance',
};

export default function Journal() {
  guard('journal');
  const jobs = db().prepare('SELECT * FROM jobs ORDER BY id DESC LIMIT 60').all();
  const logs = db().prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').all();
  return (
    <>
      <Head title="Journal" sub="Tâches envoyées au bot Discord et actions effectuées sur le site." />
      <div className="panel"><h2>Tâches du bot</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>#</th><th>Date</th><th>Tâche</th><th>Statut</th><th>Détail</th><th></th></tr></thead>
        <tbody>{jobs.length ? jobs.map((j) => (
          <tr key={j.id}>
            <td className="muted">{j.id}</td>
            <td className="muted">{when(j.created_at)}</td>
            <td>{LABELS[j.type] || j.type}</td>
            <td><Status s={j.status} /></td>
            <td className="muted" style={{ fontSize: 12.5, maxWidth: 380 }}>{j.error || ''}</td>
            <td>{j.status === 'error' || j.status === 'waiting' ? <form action={retryJob}><input type="hidden" name="id" value={j.id} /><button className="btn sm">Relancer</button></form> : null}</td>
          </tr>
        )) : <tr><td colSpan="6" className="muted">Aucune tâche.</td></tr>}</tbody>
      </table></div></div>
      <div className="panel"><h2>Actions</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>Date</th><th>Par</th><th>Action</th><th>Cible</th></tr></thead>
        <tbody>{logs.length ? logs.map((l) => (
          <tr key={l.id}><td className="muted">{when(l.created_at)}</td><td>{l.admin}</td><td className="mono" style={{ fontSize: 12.5 }}>{l.action}</td><td className="muted" style={{ fontSize: 13 }}>{l.target || ''}</td></tr>
        )) : <tr><td colSpan="4" className="muted">Rien pour le moment.</td></tr>}</tbody>
      </table></div></div>
    </>
  );
}
