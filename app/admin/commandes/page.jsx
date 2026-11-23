import { guard } from '../guard';
import { db } from '../../../lib/db';
import { eur } from '../../../lib/format';
import { Head, Status, when } from '../ui';

export default function Orders({ searchParams }) {
  guard('orders');
  const q = String(searchParams?.q || '').trim();
  const orders = q
    ? db().prepare('SELECT * FROM orders WHERE tebex_tx LIKE ? OR customer LIKE ? OR discord_id LIKE ? OR email LIKE ? ORDER BY created_at DESC LIMIT 200').all(...Array(4).fill(`%${q}%`))
    : db().prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all();
  const items = db().prepare(`SELECT order_id, GROUP_CONCAT(name, ', ') names FROM order_items GROUP BY order_id`).all();
  const names = new Map(items.map((i) => [i.order_id, i.names]));
  return (
    <>
      <Head title="Commandes" sub="Reçues par les webhooks Tebex.">
        <form className="actions"><input className="field" name="q" defaultValue={q} placeholder="Transaction, client, Discord…" /><button className="btn sm">Rechercher</button></form>
      </Head>
      <div className="panel"><div className="tscroll"><table className="tbl">
        <thead><tr><th>Date</th><th>Transaction</th><th>Client</th><th>Scripts</th><th>Total</th><th>Statut</th></tr></thead>
        <tbody>{orders.length ? orders.map((o) => (
          <tr key={o.id}>
            <td className="muted">{when(o.created_at)}</td>
            <td className="mono" style={{ fontSize: 12.5 }}>{o.tebex_tx}</td>
            <td>{o.customer || '—'}<div className="muted" style={{ fontSize: 12.5 }}>{o.discord_id ? `Discord ${o.discord_id}` : 'sans Discord'}{o.email ? ` · ${o.email}` : ''}</div></td>
            <td style={{ maxWidth: 260 }}>{names.get(o.id) || '—'}</td>
            <td>{eur(o.total || 0)}</td>
            <td><Status s={o.status} /></td>
          </tr>
        )) : <tr><td colSpan="6" className="muted">Aucune commande.</td></tr>}</tbody>
      </table></div></div>
    </>
  );
}
