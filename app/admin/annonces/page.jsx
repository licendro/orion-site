import { guard } from '../guard';
import { db } from '../../../lib/db';
import { sendAnnouncement } from '../actions';
import { Flash, Head, when } from '../ui';

const CHANNELS = [['announcements', '📢 annonces'], ['teasers', '👀 teasers'], ['news', '🆕 nouveautés'], ['patchnotes', '📝 patch-notes'], ['promos', '🏷️ promos'], ['partners', '🤝 partenaires'], ['clientUpdates', '📥 mises-à-jour (clients)']];
const PINGS = [['', 'Personne'], ['notifNew', '@🔔 Nouveautés'], ['notifPatch', '@🔔 Patch notes'], ['notifTeaser', '@🔔 Teasers'], ['notifPromo', '@🔔 Promos'], ['client', '@💎 Client Orion'], ['everyone', '@everyone']];

export default function Announcements({ searchParams }) {
  guard('announcements');
  const sent = db().prepare("SELECT * FROM jobs WHERE type = 'announce.custom' ORDER BY created_at DESC LIMIT 20").all();
  return (
    <>
      <Head title="Annonces Discord" sub="Le bot poste un embed aux couleurs Orion dans le salon choisi." />
      <Flash searchParams={searchParams} />
      <div className="panel">
        <h2>Nouvelle annonce</h2>
        <form action={sendAnnouncement} className="pb frm">
          <label>Salon<select className="field" name="channel">{CHANNELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label>Mentionner<select className="field" name="ping">{PINGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="full">Titre<input className="field" name="title" required maxLength={200} placeholder="Teaser : orn_casino arrive" /></label>
          <label className="full">Texte <span className="hint">Markdown Discord : **gras**, *italique*, listes…</span><textarea name="text" required maxLength={3800} style={{ minHeight: 160 }} /></label>
          <label>Image (URL)<input className="field" name="image_url" maxLength={500} /></label>
          <label>Ou envoyer une image<input className="field" name="image_file" type="file" accept="image/png,image/jpeg,image/webp,image/gif" style={{ paddingTop: 10 }} /></label>
          <label className="full">Bouton lien <span className="hint">Facultatif, ex. la fiche du script</span><input className="field" name="link" maxLength={300} placeholder="https://jdev-hub.fr/scripts/orn_bank" /></label>
          <div className="full"><button className="btn pri">Envoyer sur Discord</button></div>
        </form>
      </div>
      <div className="panel"><h2>Dernières annonces</h2><table className="tbl"><tbody>
        {sent.length ? sent.map((j) => {
          const p = JSON.parse(j.payload || '{}');
          return <tr key={j.id}><td className="muted">{when(j.created_at)}</td><td>{p.title}</td><td>#{p.channel}</td><td>{j.status === 'done' ? <span className="pill2 ok">Envoyée</span> : j.status === 'error' ? <span className="pill2 warn" title={j.error}>Erreur</span> : <span className="pill2">En attente</span>}</td></tr>;
        }) : <tr><td className="muted">Aucune annonce.</td></tr>}
      </tbody></table></div>
    </>
  );
}
