import { redirect } from 'next/navigation';
import { avatarUrl, getUser } from '../../lib/auth';
import { db } from '../../lib/db';
import { getFullCatalog } from '../../lib/catalog';
import { eur } from '../../lib/format';
import BugList from '../../components/BugList';
import { bugsOf } from '../../lib/bugs';
import { changeMyIp, deleteMyAccount } from './actions';
import LicenceKey from './LicenceKey';
import { licencesEnabled, myLicences } from '../../lib/licences';
import { ideasOf } from '../../lib/ideas';
import { IDEA_STATUS } from '../../db/ideas.mjs';

export const metadata = { title: 'Mon compte', robots: { index: false } };
export const dynamic = 'force-dynamic';

const STATUS = { paid: 'Payée', refunded: 'Remboursée', chargeback: 'Litige' };

export default async function Account({ searchParams }) {
  const user = getUser();
  if (!user) redirect('/api/auth/discord?next=/compte');
  const myBugs = bugsOf(user.discord_id);
  const subs = db().prepare("SELECT COUNT(*) n FROM subscriptions WHERE discord_id = ? AND status IN ('active','cancelling')").get(user.discord_id).n;
  const myIdeas = ideasOf(user.discord_id);
  const licences = licencesEnabled() ? await myLicences(user.discord_id).catch(() => null) : [];
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
            <div className="empty">Aucun script pour le moment. <a className="btn sm" href="/scripts">Voir le catalogue</a></div>
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

        {licences === null || licences.length ? (
          <section id="licences">
            <h3 style={{ marginBottom: 6 }}>Mes licences</h3>
            <p className="muted" style={{ marginTop: 0 }}>Ajoute la ligne <code>set orn_licence_…</code> dans ton server.cfg, après <code>ensure orn_lib</code>. La licence se lie à l’IP de ton serveur au premier démarrage.</p>
            {searchParams?.ok ? <div className="flash">{searchParams.ok}</div> : null}
            {searchParams?.err ? <div className="flash err">{searchParams.err}</div> : null}
            {licences === null ? <p className="muted">Le service des licences ne répond pas pour le moment, réessaie dans quelques minutes.</p> : (
              <div className="lics">
                {licences.map((l) => {
                  const wait = l.next_ip_change && l.next_ip_change > Date.now();
                  return (
                    <div className={`lic s-${l.status}`} key={l.id}>
                      <div className="lic-h">
                        <b>{l.title || l.script}</b>
                        <span className={`st s-${l.status}`}>{l.status === 'active' ? '🟢 Active' : l.status === 'suspended' ? '🟠 Suspendue' : '🔴 Révoquée'}</span>
                        <span className="muted">{l.latest ? `Dernière version v${l.latest}` : ''}{l.last_version ? ` · ton serveur : v${l.last_version}` : ''}</span>
                        <a href={`/changelog/${l.script}`}>Changelog →</a>
                      </div>
                      <LicenceKey value={l.key} script={l.script} />
                      <form action={changeMyIp} className="lic-ip">
                        <input type="hidden" name="id" value={l.id} />
                        <span>IP liée : <b className="mono">{l.ip || 'pas encore liée'}</b></span>
                        <input className="field mono" name="ip" placeholder="Nouvelle IP (vide = au prochain démarrage)" disabled={wait || l.status !== 'active'} />
                        <button className="btn sm" disabled={wait || l.status !== 'active'}>Changer</button>
                        {wait ? <span className="muted" style={{ fontSize: 12.5 }}>Prochain changement possible le {new Date(l.next_ip_change).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}</span> : <span className="muted" style={{ fontSize: 12.5 }}>1 changement tous les 7 jours</span>}
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : null}

        <section>
          <h3 style={{ marginBottom: 18 }}>Mes idées</h3>
          {myIdeas.length ? (
            <div className="rows">
              {myIdeas.map((x) => (
                <div className="rw" key={x.id}>
                  <b>{x.title}</b>
                  <span className="p">▲ {x.up - x.down}</span>
                  <span className="d">{IDEA_STATUS[x.status]?.emoji} {IDEA_STATUS[x.status]?.label}{x.note ? ` · ${x.note}` : ''}</span>
                </div>
              ))}
            </div>
          ) : <p className="muted">Un script te manque ? <a href="/idees">Propose une idée</a>, la communauté vote.</p>}
        </section>

        {myBugs.length ? (
          <section>
            <h3 style={{ marginBottom: 18 }}>Mes bugs signalés</h3>
            <BugList bugs={myBugs} />
          </section>
        ) : null}

        <section id="donnees">
          <h3 style={{ marginBottom: 12 }}>Mes données</h3>
          <p className="muted" style={{ marginTop: 0 }}>Tu peux récupérer tout ce qu’on sait sur toi, ou supprimer ton compte. Détails dans la <a href="/confidentialite">politique de confidentialité</a>.</p>
          <div className="actions" style={{ flexWrap: 'wrap', gap: 10 }}>
            <a className="btn" href="/api/account/export">⬇ Télécharger mes données</a>
          </div>
          <details className="danger-zone" open={searchParams?.err === 'confirm'}>
            <summary>Supprimer mon compte</summary>
            <p>Ton compte, tes devis, tes votes et ton nom sur tes idées et bugs seront effacés, et ton salon privé Discord retiré. Tes scripts restent dans ton Keymaster : la licence appartient à ton compte FiveM. Les commandes sont gardées 10 ans pour la comptabilité, sans lien avec ton compte.{subs ? ' ⚠ Pense à résilier ton abonnement partenaire depuis l’e-mail de Tebex avant.' : ''}</p>
            {searchParams?.err === 'confirm' ? <p style={{ color: 'var(--acc)' }}>Écris SUPPRIMER pour confirmer.</p> : null}
            <form action={deleteMyAccount} className="actions" style={{ flexWrap: 'wrap', gap: 10 }}>
              <input className="field" name="confirm" placeholder="Écris SUPPRIMER" autoComplete="off" style={{ maxWidth: 220 }} />
              <button className="btn danger">Supprimer définitivement</button>
            </form>
          </details>
        </section>

        <div className="warn">
          Tes scripts sont livrés dans ton Keymaster Cfx.re. Le rôle Client et ton salon privé t’attendent sur notre Discord.{' '}
          <a href={discord} target="_blank" rel="noopener" style={{ color: 'var(--ink)' }}>Rejoindre le Discord</a>
        </div>
      </div>
    </main>
  );
}
