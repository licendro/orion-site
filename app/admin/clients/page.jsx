import { guard } from '../guard';
import { db } from '../../../lib/db';
import { eur } from '../../../lib/format';
import { resyncCustomer } from '../actions';
import { Flash, Head, when } from '../ui';

export default function Clients({ searchParams }) {
  guard('clients');
  const rows = db().prepare(`
    SELECT o.discord_id, MAX(u.username) username, COUNT(DISTINCT o.id) orders, SUM(CASE WHEN o.status = 'paid' THEN o.total ELSE 0 END) total,
           MAX(o.created_at) last, MAX(c.channel_id) channel,
           (SELECT GROUP_CONCAT(DISTINCT oi.name) FROM order_items oi JOIN orders o2 ON o2.id = oi.order_id WHERE o2.discord_id = o.discord_id AND o2.status = 'paid') scripts
    FROM orders o
    LEFT JOIN users u ON u.discord_id = o.discord_id
    LEFT JOIN customer_channels c ON c.discord_id = o.discord_id
    WHERE o.discord_id IS NOT NULL
    GROUP BY o.discord_id ORDER BY last DESC LIMIT 300`).all();
  const accounts = db().prepare('SELECT COUNT(*) n FROM users').get().n;
  const subs = db().prepare('SELECT s.*, u.username FROM subscriptions s LEFT JOIN users u ON u.discord_id = s.discord_id ORDER BY s.updated_at DESC LIMIT 100').all();
  const guild = process.env.DISCORD_GUILD_ID;
  return (
    <>
      <Head title="Clients" sub={`${rows.length} client(s) avec Discord · ${accounts} compte(s) connecté(s) au site`} />
      <Flash searchParams={searchParams} />
      {subs.length ? (
        <div className="panel"><h2>Abonnements partenaires</h2><div className="tscroll"><table className="tbl">
          <thead><tr><th>Partenaire</th><th>Formule</th><th>État</th><th>Depuis</th></tr></thead>
          <tbody>{subs.map((x) => (
            <tr key={x.tebex_ref}><td><b>{x.username || x.customer || '—'}</b><div className="muted mono" style={{ fontSize: 12 }}>{x.discord_id || 'sans Discord'}</div></td>
              <td>{x.name}</td><td><span className={`pill2 ${x.status === 'active' ? 'ok' : x.status === 'cancelling' ? 'warn' : 'off'}`}>{{ active: 'Actif', cancelling: 'Résiliation demandée', ended: 'Terminé' }[x.status]}</span></td>
              <td className="muted">{when(x.created_at)}</td></tr>
          ))}</tbody>
        </table></div></div>
      ) : null}
      <div className="panel"><div className="tscroll"><table className="tbl">
        <thead><tr><th>Client</th><th>Scripts</th><th>Commandes</th><th>Total</th><th>Salon</th><th>Dernier achat</th><th></th></tr></thead>
        <tbody>{rows.length ? rows.map((r) => (
          <tr key={r.discord_id}>
            <td><b>{r.username || '—'}</b><div className="muted mono" style={{ fontSize: 12 }}>{r.discord_id}</div></td>
            <td style={{ maxWidth: 260 }}>{r.scripts || '—'}</td>
            <td>{r.orders}</td>
            <td>{eur(r.total || 0)}</td>
            <td>{r.channel && guild ? <a href={`https://discord.com/channels/${guild}/${r.channel}`} target="_blank" rel="noopener">Ouvrir</a> : <span className="muted">—</span>}</td>
            <td className="muted">{when(r.last)}</td>
            <td><form action={resyncCustomer}><input type="hidden" name="discord_id" value={r.discord_id} /><button className="btn sm" title="Redonne le rôle Client, recrée le salon si besoin et met à jour la liste de ses scripts">Resynchroniser</button></form></td>
          </tr>
        )) : <tr><td colSpan="7" className="muted">Aucun client pour le moment.</td></tr>}</tbody>
      </table></div></div>
    </>
  );
}
