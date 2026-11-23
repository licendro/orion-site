import { notFound } from 'next/navigation';
import { guard } from '../../guard';
import { db } from '../../../../lib/db';
import { getFullCatalog } from '../../../../lib/catalog';
import { IDEA_KIND, IDEA_STATUS } from '../../../../db/ideas.mjs';
import { deleteIdea, saveIdea } from '../../actions';
import { Flash, Head, when } from '../../ui';

export default async function Idea({ params, searchParams }) {
  guard('ideas');
  const x = db().prepare('SELECT * FROM ideas WHERE id = ?').get(Number(params.id));
  if (!x) notFound();
  const { products } = await getFullCatalog();
  const votes = db().prepare('SELECT SUM(value > 0) up, SUM(value < 0) down FROM idea_votes WHERE idea_id = ?').get(x.id);
  const gid = process.env.DISCORD_GUILD_ID;
  return (
    <>
      <Head title={`Idée #${x.id}`} sub={`Par ${x.author_name || '—'} · ${when(x.created_at)} · 👍 ${votes.up || 0} · 👎 ${votes.down || 0}`}>
        {x.thread_id && gid ? <a className="btn sm" href={`https://discord.com/channels/${gid}/${x.thread_id}`}>Voir sur Discord ↗</a> : null}
        <a className="btn sm" href="/admin/idees">← Idées</a>
      </Head>
      <Flash searchParams={searchParams} />
      <div className="panel">
        <form action={saveIdea} className="pb frm" noValidate>
          <input type="hidden" name="id" value={x.id} />
          <label className="full">Titre<input className="field" name="title" maxLength={100} defaultValue={x.title} /></label>
          <label>Statut <span className="hint">Changer prévient l’auteur et les votants 👍</span>
            <select className="field" name="status" defaultValue={x.status}>{Object.entries(IDEA_STATUS).map(([k, s]) => <option key={k} value={k}>{s.emoji} {s.label}</option>)}</select>
          </label>
          <label>Type<select className="field" name="kind" defaultValue={x.kind}>{Object.entries(IDEA_KIND).map(([k, s]) => <option key={k} value={k}>{s.emoji} {s.label}</option>)}</select></label>
          <label className="full">Script sorti <span className="hint">Pour « Disponible » : lien envoyé à tout le monde</span>
            <select className="field" name="released" defaultValue={x.released_key || ''}><option value="">—</option>{products.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
          </label>
          <label className="full">Réponse de l’équipe <span className="hint">Facultatif, affichée publiquement et envoyée avec la notification{x.note ? ` · actuelle : « ${x.note} »` : ''}</span>
            <input className="field" name="note" maxLength={500} placeholder="ex. Prévu pour cet été !" />
          </label>
          <label className="full">Description<textarea name="description" maxLength={1500} defaultValue={x.description || ''} /></label>
          <div className="full actions"><button className="btn pri">Enregistrer</button></div>
        </form>
      </div>
      <form action={deleteIdea}><input type="hidden" name="id" value={x.id} /><button className="btn sm danger">Supprimer cette idée</button></form>
    </>
  );
}
