import { getSetting } from '../../../lib/db';
import { tebexEnabled } from '../../../lib/tebex';
import { pluginEnabled } from '../../../lib/tebexPlugin';
import { discordConfigured } from '../../../lib/auth';
import { saveSettings } from '../actions';
import { Flash, Head } from '../ui';

const ok = (b) => (b ? <span className="pill2 ok">OK</span> : <span className="pill2 warn">À remplir</span>);

export default function Settings({ searchParams }) {
  return (
    <>
      <Head title="Réglages" />
      <Flash searchParams={searchParams} />
      <div className="panel">
        <h2>Boutique</h2>
        <form action={saveSettings} className="pb frm">
          <div className="full chks"><label className="chk"><input type="checkbox" name="auto_announce" defaultChecked={getSetting('auto_announce', true)} /> Quand j’ajoute un script sur Tebex : le publier et l’annoncer sur Discord automatiquement</label></div>
          <p className="full hint">Décoché : les nouveaux scripts arrivent en brouillon dans Produits, tu complètes la fiche puis tu cliques « Publier + annoncer ».</p>
          <label className="full">Bandeau en haut du site <span className="hint">Vide = aucun</span><input className="field" name="top_banner" maxLength={200} defaultValue={getSetting('top_banner', '')} placeholder="Black Friday : −20 % sur tout le catalogue" /></label>
          <div className="full"><button className="btn pri">Enregistrer</button></div>
        </form>
      </div>
      <div className="panel">
        <h2>Configuration du serveur (.env)</h2>
        <table className="tbl"><tbody>
          <tr><td>Clé publique Tebex (catalogue, paiement)</td><td><code>TEBEX_PUBLIC_TOKEN</code></td><td>{ok(tebexEnabled())}</td></tr>
          <tr><td>Clé secrète Tebex (codes promo)</td><td><code>TEBEX_SECRET_KEY</code></td><td>{ok(pluginEnabled())}</td></tr>
          <tr><td>Secret des webhooks Tebex (commandes)</td><td><code>TEBEX_WEBHOOK_SECRET</code></td><td>{ok(!!process.env.TEBEX_WEBHOOK_SECRET)}</td></tr>
          <tr><td>Connexion Discord</td><td><code>DISCORD_CLIENT_ID / SECRET</code></td><td>{ok(discordConfigured())}</td></tr>
          <tr><td>Bot (ajout auto au serveur)</td><td><code>DISCORD_TOKEN / DISCORD_GUILD_ID</code></td><td>{ok(!!process.env.DISCORD_TOKEN && !!process.env.DISCORD_GUILD_ID)}</td></tr>
          <tr><td>Webhook des devis</td><td><code>DISCORD_QUOTE_WEBHOOK</code></td><td>{ok(!!process.env.DISCORD_QUOTE_WEBHOOK)}</td></tr>
        </tbody></table>
      </div>
    </>
  );
}
