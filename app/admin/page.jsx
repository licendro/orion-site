import { getLegal } from '../../lib/legal';
import { db, getSetting } from '../../lib/db';
import { getFullCatalog } from '../../lib/catalog';
import { eur } from '../../lib/format';
import { tebexEnabled } from '../../lib/tebex';
import { pluginEnabled } from '../../lib/tebexPlugin';
import { Head, Status, when } from './ui';

export default async function Dashboard() {
  const legalMissing = getLegal().missing;
  const d = db();
  const sum = (sql, ...a) => d.prepare(sql).get(...a)?.v || 0;
  const rev30 = sum("SELECT SUM(total) v FROM orders WHERE status = 'paid' AND created_at >= datetime('now', '-30 days')");
  const revAll = sum("SELECT SUM(total) v FROM orders WHERE status = 'paid'");
  const today = sum("SELECT COUNT(*) v FROM orders WHERE status = 'paid' AND date(created_at) = date('now')");
  const clients = sum("SELECT COUNT(DISTINCT IFNULL(discord_id, email)) v FROM orders WHERE status = 'paid'");
  const quotes = sum("SELECT COUNT(*) v FROM quotes WHERE status = 'nouveau'");
  const jobErrors = sum("SELECT COUNT(*) v FROM jobs WHERE status = 'error'");
  const heartbeat = getSetting('bot_heartbeat', 0);
  const botOnline = Date.now() - heartbeat < 3 * 60e3;
  const orders = d.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 8').all();
  const top = d.prepare(`SELECT oi.name, COUNT(*) n, SUM(oi.price) total FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE o.status = 'paid' GROUP BY oi.product_key ORDER BY n DESC LIMIT 5`).all();
  const { mode, products } = await getFullCatalog();
  const drafts = products.filter((p) => !p.published).length;

  return (
    <>
      <Head title="Tableau de bord" sub={`Boutique ${mode === 'tebex' ? 'reliée à Tebex' : mode === 'demo' ? 'en mode démo (pas de clé Tebex)' : 'Tebex injoignable'} · ${products.length} produits`} />
      {legalMissing.length ? <div className="flash err">⚖️ Infos légales incomplètes ({legalMissing.length}) : obligatoires pour vendre en France. <a href="/admin/legal">Compléter →</a></div> : null}

      {mode !== 'tebex' || !pluginEnabled() || !getSetting('synced_once', false) || !botOnline || jobErrors || drafts || getSetting('maintenance', false) ? (
        <div className="panel"><h2>À faire</h2><div className="pb" style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14 }}>
          {!tebexEnabled() ? <span>• Ajoute <code>TEBEX_PUBLIC_TOKEN</code> dans le .env pour afficher tes vrais scripts et ouvrir les paiements.</span> : null}
          {!pluginEnabled() ? <span>• Ajoute <code>TEBEX_SECRET_KEY</code> pour créer les codes promo depuis l’admin.</span> : null}
          {!botOnline ? <span>• Le bot Discord ne répond pas (dernier signe : {heartbeat ? when(new Date(heartbeat).toISOString()) : 'jamais'}). Vérifie <code>pm2 logs orion-bot</code>.</span> : null}
          {jobErrors ? <span>• {jobErrors} tâche(s) du bot en erreur : <a href="/admin/journal">voir le journal</a>.</span> : null}
          {drafts ? <span>• {drafts} nouveau(x) script(s) en brouillon : <a href="/admin/produits">publier</a>.</span> : null}
          {getSetting('maintenance', false) ? <span>• Le site est en maintenance : <a href="/admin/maintenance">le remettre en ligne</a>.</span> : null}
        </div></div>
      ) : null}

      <div className="stats">
        <div className="stat"><span>Chiffre d’affaires 30 j</span><b>{eur(rev30 || 0).replace('Gratuit', '0,00 €')}</b></div>
        <div className="stat"><span>Total encaissé</span><b>{eur(revAll || 0).replace('Gratuit', '0,00 €')}</b></div>
        <div className="stat"><span>Ventes aujourd’hui</span><b>{today}</b></div>
        <div className="stat"><span>Clients</span><b>{clients}</b></div>
      </div>

      <div className="stats s3">
        <div className="stat"><span>Bot Discord</span><b style={{ fontSize: 20, color: botOnline ? '#86efac' : '#ffb38a' }}>{botOnline ? 'En ligne' : 'Hors ligne'}</b></div>
        <div className="stat"><span>Devis à traiter</span><b>{quotes}</b></div>
        <div className="stat"><span>Tâches en erreur</span><b>{jobErrors}</b></div>
      </div>

      <div className="panel">
        <div className="ph">Dernières commandes <a className="btn sm" href="/admin/commandes">Tout voir</a></div>
        <div className="tscroll"><table className="tbl">
          <thead><tr><th>Date</th><th>Client</th><th>Total</th><th>Statut</th></tr></thead>
          <tbody>
            {orders.length ? orders.map((o) => (
              <tr key={o.id}><td>{when(o.created_at)}</td><td>{o.customer || '—'}{o.discord_id ? <span className="muted"> · Discord ✓</span> : null}</td><td>{eur(o.total || 0)}</td><td><Status s={o.status} /></td></tr>
            )) : <tr><td colSpan="4" className="muted">Aucune commande pour le moment.</td></tr>}
          </tbody>
        </table></div>
      </div>

      {top.length ? (
        <div className="panel">
          <h2>Meilleures ventes</h2>
          <table className="tbl"><tbody>
            {top.map((t) => <tr key={t.name}><td>{t.name}</td><td>{t.n} vente(s)</td><td>{eur(t.total || 0)}</td></tr>)}
          </tbody></table>
        </div>
      ) : null}
    </>
  );
}
