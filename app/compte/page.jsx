import { redirect } from 'next/navigation';
import { avatarUrl, getUser } from '../../lib/auth';
import { db } from '../../lib/db';
import { getFullCatalog } from '../../lib/catalog';
import { eur } from '../../lib/format';

export const metadata = { title: 'Mon compte', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS = { paid: 'Payée', refunded: 'Remboursée', chargeback: 'Litige' };

export default async function Account() {
  const user = getUser();
  if (!user) redirect('/api/auth/discord?next=/compte');
  const orders = db().prepare('SELECT * FROM orders WHERE user_id = ? OR discord_id = ? ORDER BY created_at DESC').all(user.id, user.discord_id);
  const items = db().prepare(`SELECT oi.*, o.status, o.created_at FROM order_items oi JOIN orders o ON o.id = oi.order_id
    WHERE (o.user_id = ? OR o.discord_id = ?) ORDER BY o.created_at DESC`).all(user.id, user.discord_id);
  const { products } = await getFullCatalog();
  const owned = [...new Map(items.filter((i) => i.status === 'paid').map((i) => [i.product_key, i])).values()];
  const discord = process.env.DISCORD_INVITE || 'https://discord.com';

  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <img src={avatarUrl(user)} alt="" width="56" height="56" style={{ borderRadius: '50%', border: '1px solid var(--line2)' }} />
          <div style={{ flex: 1 }}>
            <span className="label" style={{ marginBottom: 4 }}><i></i>Mon compte</span>
            <h2 style={{ fontSize: 'clamp(28px,4vw,44px)' }}>{user.username}</h2>
          </div>
          <form action="/api/auth/logout" method="post"><button className="btn sm" type="submit">Se déconnecter</button></form>
        </div>

        <section>
          <h3 style={{ marginBottom: 18 }}>Mes scripts</h3>
          {owned.length ? (
            <div className="grid">
              {owned.map((i) => {
                const p = products.find((x) => x.key === i.product_key);
                return (
                  <div className="card" key={i.product_key} style={{ cursor: 'default' }}>
                    <div className="im"><img src={p?.img || '/img/menu.jpg'} alt="" style={{ objectPosition: p?.pos }} /></div>
                    <div className="bd">
                      <div className="top"><h4>{i.name}</h4>{p?.ver ? <span className="v">v{p.ver}</span> : null}</div>
                      <p>Acheté le {new Date(i.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR')}</p>
                      <div className="ft">
                        <a className="add" href="https://portal.cfx.re/assets/granted-assets" target="_blank" rel="noopener">Keymaster</a>
                        {p ? <a className="add" href={`/scripts/${p.slug}`}>Fiche</a> : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty">Aucun script pour le moment. <a className="btn sm" href="/#scripts">Voir le catalogue</a></div>
          )}
        </section>

        <section>
          <h3 style={{ marginBottom: 18 }}>Mes commandes</h3>
          {orders.length ? (
            <div className="rows">
              {orders.map((o) => (
                <div className="rw" key={o.id}>
                  <b>Commande {o.tebex_tx}</b>
                  <span className="p">{eur(o.total || 0)}</span>
                  <span className="d">{new Date(o.created_at.replace(' ', 'T') + 'Z').toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} · {STATUS[o.status] || o.status}</span>
                </div>
              ))}
            </div>
          ) : <p className="muted">Aucune commande.</p>}
        </section>

        <div className="warn">
          Tes scripts sont livrés dans ton Keymaster Cfx.re. Le rôle Client et ton salon privé t’attendent sur notre Discord.{' '}
          <a href={discord} target="_blank" rel="noopener" style={{ color: 'var(--ink)' }}>Rejoindre le Discord</a>
        </div>
      </div>
    </main>
  );
}
