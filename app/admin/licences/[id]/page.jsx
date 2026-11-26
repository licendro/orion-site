import { notFound } from 'next/navigation';
import { guard } from '../../guard';
import { licenceLogs, listLicences } from '../../../../lib/licences';
import { adminLicenceIp, adminLicenceStatus } from '../../actions';
import { Flash, Head } from '../../ui';

const d = (ms) => (ms ? new Date(ms).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'medium' }) : '—');
const RESULT = { valid: '🟢 valide', ip_mismatch: '🟠 autre IP', revoked: '🔴 révoquée', suspended: '🟠 suspendue', wrong_script: '⚪ mauvais script', rate_limited: '⚪ trop de requêtes' };

export default async function Licence({ params, searchParams }) {
  guard('licences');
  const id = Number(params.id);
  const all = await listLicences({ limit: 500 }).catch(() => []);
  const l = all.find((x) => x.id === id);
  if (!l) notFound();
  const logs = await licenceLogs(id).catch(() => []);
  const ips = [...new Set(logs.map((g) => g.ip))];
  return (
    <>
      <Head title={`Licence #${l.id}`} sub={`${l.title || l.script} · ${l.customer || 'client inconnu'} · créée le ${d(l.created_at)} (${l.source === 'manuel' ? 'manuelle' : `Tebex ${l.tebex_tx || ''}`})`}>
        <a className="btn sm" href="/admin/licences">← Licences</a>
      </Head>
      <Flash searchParams={searchParams} />
      <div className="panel"><div className="pb">
        <p style={{ margin: 0 }}><b>Clé :</b> <span className="mono">{l.key}</span></p>
        <p style={{ margin: '8px 0 0' }}><b>Statut :</b> {l.status}{l.reason ? ` (${l.reason})` : ''} · <b>IP liée :</b> <span className="mono">{l.ip || 'pas encore liée'}</span> · <b>Dernière vérif :</b> {d(l.last_check_at)}{l.last_version ? ` (v${l.last_version})` : ''}</p>
        {l.discord_id ? <p style={{ margin: '8px 0 0' }}><b>Discord :</b> <span className="mono">{l.discord_id}</span></p> : null}
        {l.note ? <p style={{ margin: '8px 0 0' }}><b>Note :</b> {l.note}</p> : null}
        {ips.length > 2 ? <p style={{ margin: '8px 0 0', color: 'var(--acc)' }}>⚠ {ips.length} IP différentes dans les journaux (30 jours) : partage ou fuite possible.</p> : null}
      </div></div>
      <div className="panel"><form action={adminLicenceStatus} className="pb frm">
        <input type="hidden" name="id" value={l.id} />
        <label>Statut<select className="field" name="status" defaultValue={l.status}><option value="active">🟢 Active</option><option value="suspended">🟠 Suspendue</option><option value="revoked">🔴 Révoquée</option></select></label>
        <label>Raison <span className="hint">Visible dans les journaux</span><input className="field" name="reason" maxLength={200} defaultValue={l.reason || ''} /></label>
        <div className="full"><button className="btn pri">Changer le statut</button></div>
      </form></div>
      <div className="panel"><form action={adminLicenceIp} className="pb frm">
        <input type="hidden" name="id" value={l.id} />
        <label className="full">IP liée <span className="hint">Vide = déliée, elle se liera au prochain démarrage du serveur. Pas de délai de 7 jours pour l’équipe.</span><input className="field mono" name="ip" defaultValue={l.ip || ''} /></label>
        <div className="full"><button className="btn">Modifier l’IP</button></div>
      </form></div>
      <div className="panel"><h2>Vérifications (30 derniers jours)</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>Date</th><th>Résultat</th><th>IP</th><th>Version</th></tr></thead>
        <tbody>{logs.length ? logs.map((g, k) => <tr key={k}><td className="muted">{d(g.created_at)}</td><td>{RESULT[g.result] || g.result}</td><td className="mono">{g.ip}</td><td className="mono">{g.version || '—'}</td></tr>) : <tr><td colSpan="4" className="muted">Aucune vérification.</td></tr>}</tbody>
      </table></div></div>
    </>
  );
}
