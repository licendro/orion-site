import { notFound } from 'next/navigation';
import { guard } from '../../guard';
import { db } from '../../../../lib/db';
import { getFullCatalog } from '../../../../lib/catalog';
import { BUG_SEVERITY, BUG_STATUS } from '../../../../db/bugs.mjs';
import { deleteBug, saveBug } from '../../actions';
import { Flash, Head, when } from '../../ui';

export default async function Bug({ params, searchParams }) {
  guard('bugs');
  const b = db().prepare('SELECT * FROM bugs WHERE id = ?').get(Number(params.id));
  if (!b) notFound();
  const { products } = await getFullCatalog();
  const followers = db().prepare('SELECT f.discord_id, u.username FROM bug_followers f LEFT JOIN users u ON u.discord_id = f.discord_id WHERE f.bug_id = ?').all(b.id);
  const name = (id) => db().prepare('SELECT username FROM users WHERE discord_id = ?').get(id)?.username || id;
  const gid = process.env.DISCORD_GUILD_ID;
  const link = b.thread_id || b.ticket_channel_id;

  return (
    <>
      <Head title={`Bug #${b.id}`} sub={`Créé ${when(b.created_at)}${b.created_by ? ` par ${b.created_by}` : ''} · mis à jour ${when(b.updated_at)}`}>
        {link && gid ? <a className="btn sm" href={`https://discord.com/channels/${gid}/${link}`}>Ouvrir sur Discord ↗</a> : null}
        <a className="btn sm" href="/admin/bugs">← Bugs</a>
      </Head>
      <Flash searchParams={searchParams} />
      <div className="panel">
        <form action={saveBug} className="pb frm" noValidate>
          <input type="hidden" name="id" value={b.id} />
          <label className="full">Titre<input className="field" name="title" required maxLength={120} defaultValue={b.title} /></label>
          <label>Script<select className="field" name="product" defaultValue={b.product_key || ''}>{products.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
          <label>Gravité<select className="field" name="severity" defaultValue={b.severity}>{Object.entries(BUG_SEVERITY).map(([k, s]) => <option key={k} value={k}>{s.emoji} {s.label}</option>)}</select></label>
          <label>Statut <span className="hint">Changer prévient les personnes concernées</span>
            <select className="field" name="status" defaultValue={b.status}>{Object.entries(BUG_STATUS).map(([k, s]) => <option key={k} value={k}>{s.emoji} {s.label}</option>)}</select>
          </label>
          <label>Version qui corrige <span className="hint">Pour « Corrigé et publié »</span><input className="field mono" name="version" maxLength={20} defaultValue={b.fixed_version || ''} placeholder="ex. 1.3.0" /></label>
          <label>Doublon de <span className="hint">N° du bug d’origine</span><input className="field mono" name="duplicate_of" type="number" defaultValue={b.duplicate_of || ''} /></label>
          <label className="full">Message pour le client <span className="hint">Facultatif, envoyé avec la notification{b.note ? ` · actuel : « ${b.note} »` : ''}</span><input className="field" name="note" maxLength={500} placeholder="ex. Corrigé, sortie de la mise à jour demain" /></label>
          <label className="full">Description<textarea name="description" maxLength={1500} defaultValue={b.description || ''} /></label>
          <div className="full actions"><button className="btn pri">Enregistrer</button></div>
        </form>
      </div>
      <div className="panel"><div className="pb">
        <p style={{ margin: 0 }}><b>Signalé par :</b> {b.reporter_id ? name(b.reporter_id) : '—'}</p>
        <p style={{ margin: '8px 0 0' }}><b>Aussi concernés ({followers.length}) :</b> {followers.length ? followers.map((f) => f.username || f.discord_id).join(', ') : 'personne pour l’instant'}</p>
        <p className="muted" style={{ margin: '12px 0 0', fontSize: 13.5 }}>Astuce : mets le bug en « Corrigé, prochaine mise à jour ». Quand tu publieras la nouvelle version du script dans « Mises à jour », il passera tout seul en « Corrigé dans la vX » et apparaîtra dans le patch note.</p>
      </div></div>
      <form action={deleteBug}><input type="hidden" name="id" value={b.id} /><button className="btn sm danger">Supprimer ce bug</button></form>
    </>
  );
}
