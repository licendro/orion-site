import { guard } from '../guard';
import { db } from '../../../lib/db';
import { apiKey, counts, processQueue, serverStatus, testConfig } from '../../../lib/testserver';
import { can, getRole, getUser } from '../../../lib/auth';
import { endTestSession, rotateTestKey, saveTestSettings } from '../actions';
import { Flash, Head, when } from '../ui';

export default async function AdminTest({ searchParams }) {
  const role = guard('test');
  processQueue();
  const cfg = testConfig();
  const { active, waiting } = counts();
  const status = await serverStatus();
  const rows = db().prepare(`SELECT t.*, u.username FROM test_sessions t LEFT JOIN users u ON u.discord_id = t.discord_id
    WHERE t.status IN ('active','waiting') OR t.created_at >= datetime('now', '-1 day') ORDER BY t.id DESC LIMIT 60`).all();
  const owner = can(role, 'settings');
  const site = (process.env.SITE_URL || 'https://jdev-hub.fr').replace(/\/+$/, '');

  return (
    <>
      <Head title="Serveur de test" sub={`${active} en jeu · ${waiting} en attente · ${cfg.slots} places · créneaux de ${cfg.minutes} min`}>
        <a className="btn sm" href="/essai" target="_blank">Voir la page publique</a>
      </Head>
      <Flash searchParams={searchParams} />

      <div className="stats">
        <div className="stat"><span>Page publique</span><b style={{ fontSize: 20 }}>{cfg.enabled ? 'Ouverte' : 'Fermée'}</b></div>
        <div className="stat"><span>Serveur FiveM</span><b style={{ fontSize: 20 }}>{!cfg.query ? 'Non relié' : status?.online ? `${status.players}/${status.max}` : 'Hors ligne'}</b></div>
        <div className="stat"><span>En jeu (test)</span><b>{active}</b></div>
        <div className="stat"><span>File d’attente</span><b>{waiting}</b></div>
      </div>

      <div className="panel"><h2>Créneaux</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>Joueur</th><th>État</th><th>Début</th><th>Fin</th><th></th></tr></thead>
        <tbody>{rows.length ? rows.map((r) => (
          <tr key={r.id}>
            <td><b>{r.username || '—'}</b><div className="muted mono" style={{ fontSize: 12 }}>{r.discord_id}</div></td>
            <td><span className={`pill2 ${r.status === 'active' ? 'ok' : r.status === 'waiting' ? 'warn' : 'off'}`}>{{ active: 'En jeu', waiting: 'En attente', done: 'Terminé', cancelled: 'Annulé' }[r.status]}</span></td>
            <td className="muted">{r.starts_at ? when(new Date(r.starts_at).toISOString()) : '—'}</td>
            <td className="muted">{r.ends_at ? when(new Date(r.ends_at).toISOString()) : '—'}</td>
            <td>{['active', 'waiting'].includes(r.status) ? <form action={endTestSession}><input type="hidden" name="id" value={r.id} /><button className="btn sm danger">Arrêter</button></form> : null}</td>
          </tr>
        )) : <tr><td colSpan="5" className="muted">Aucun créneau.</td></tr>}</tbody>
      </table></div></div>

      {owner ? (
        <>
          <div className="panel">
            <h2>Réglages</h2>
            <form action={saveTestSettings} className="pb frm" noValidate>
              <div className="full chks">
                <label className="chk"><input type="checkbox" name="enabled" defaultChecked={cfg.enabled} /> Ouvrir les réservations</label>
                <label className="chk"><input type="checkbox" name="clients_only" defaultChecked={cfg.clientsOnly} /> Réservé aux clients</label>
              </div>
              <label>Adresse de connexion <span className="hint">cfx.re/join/xxxx ou IP:port</span><input className="field mono" name="connect" defaultValue={cfg.connect} placeholder="cfx.re/join/abc123" /></label>
              <label>Adresse HTTP du serveur <span className="hint">Pour afficher les joueurs connectés</span><input className="field mono" name="query" defaultValue={cfg.query} placeholder="http://123.45.67.89:30120" /></label>
              <label>Places réservées aux tests <span className="hint">En même temps</span><input className="field" name="slots" type="number" min="1" max="64" defaultValue={cfg.slots} /></label>
              <label>Durée d’un créneau (minutes)<input className="field" name="minutes" type="number" min="5" max="240" defaultValue={cfg.minutes} /></label>
              <div className="full"><button className="btn pri">Enregistrer</button></div>
            </form>
          </div>

          <div className="panel">
            <h2>Relier le serveur FiveM</h2>
            <div className="pb" style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14.5 }}>
              <p style={{ margin: 0 }}>Installe la ressource <code>orn_testgate</code> (dossier <code>fivem/orn_testgate</code> du projet) sur ton serveur de test. Elle laisse entrer uniquement les joueurs dont le créneau est actif et déconnecte ceux dont le créneau est fini. Le staff passe toujours (permission <code>orion.testbypass</code>).</p>
              <pre className="code" style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{`Config.SiteUrl = '${site}'
Config.ApiKey  = '${apiKey()}'`}</pre>
              <form action={rotateTestKey}><button className="btn sm danger">Générer une nouvelle clé</button></form>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
