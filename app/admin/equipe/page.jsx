import { guard } from '../guard';
import { db } from '../../../lib/db';
import { adminIds } from '../../../lib/auth';
import { addTeamMember, removeTeamMember } from '../actions';
import { Flash, Head, when } from '../ui';

const DESC = {
  admin: 'Tout sauf les réglages et l’équipe : produits, promos, codes, annonces, mises à jour, docs, maintenance, clients, devis.',
  support: 'Commandes, clients, devis, serveur de test et journal. Ne peut rien modifier dans la boutique.',
};

export default function Team({ searchParams }) {
  guard('team');
  const rows = db().prepare(`SELECT a.*, u.username FROM admins a LEFT JOIN users u ON u.discord_id = a.discord_id ORDER BY a.created_at`).all();
  const owners = adminIds().map((id) => ({ id, name: db().prepare('SELECT username FROM users WHERE discord_id = ?').get(id)?.username }));
  return (
    <>
      <Head title="Équipe" sub="Qui a accès à l’admin, et avec quels droits. Chacun se connecte avec son propre Discord." />
      <Flash searchParams={searchParams} />
      <div className="panel">
        <h2>Ajouter un membre</h2>
        <form action={addTeamMember} className="pb frm" noValidate>
          <label>Identifiant Discord<input className="field mono" name="discord_id" required inputMode="numeric" placeholder="815216042363715604" /></label>
          <label>Rôle<select className="field" name="role"><option value="support">Support</option><option value="admin">Admin</option></select></label>
          <div className="full hint">Support : {DESC.support}<br />Admin : {DESC.admin}</div>
          <div className="full"><button className="btn pri">Ajouter</button></div>
        </form>
      </div>
      <div className="panel"><h2>Membres</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>Membre</th><th>Rôle</th><th>Ajouté</th><th></th></tr></thead>
        <tbody>
          {owners.map((o) => <tr key={o.id}><td><b>{o.name || '—'}</b><div className="muted mono" style={{ fontSize: 12 }}>{o.id}</div></td><td><span className="pill2 ok">Fondateur</span></td><td className="muted">.env</td><td className="muted" style={{ fontSize: 12.5 }}>Modifiable dans ADMIN_DISCORD_IDS</td></tr>)}
          {rows.map((r) => (
            <tr key={r.discord_id}>
              <td><b>{r.username || 'pas encore connecté'}</b><div className="muted mono" style={{ fontSize: 12 }}>{r.discord_id}</div></td>
              <td><span className="pill2">{r.role === 'admin' ? 'Admin' : 'Support'}</span></td>
              <td className="muted">{when(r.created_at)} · {r.added_by}</td>
              <td><form action={removeTeamMember}><input type="hidden" name="discord_id" value={r.discord_id} /><button className="btn sm danger">Retirer</button></form></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
    </>
  );
}
