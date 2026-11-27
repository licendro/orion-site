import { guard } from '../guard';
import { db, getSetting } from '../../../lib/db';
import { DAYS, HOURS_DEFAULT, isOpen } from '../../../db/support.mjs';
import { DEFAULT_MACROS } from '../../../db/macros.mjs';
import { deleteMacro, saveHours, saveMacro } from '../actions';
import { Flash, Head } from '../ui';

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const dur = (ms) => (ms == null ? '—' : ms < 60e3 ? `${Math.round(ms / 1000)} s` : ms < 3600e3 ? `${Math.round(ms / 60e3)} min` : `${(ms / 3600e3).toFixed(1).replace('.', ',')} h`);
const avg = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1).replace('.', ',') : '—');
const pct = (n, d) => (d ? `${Math.round((n / d) * 100)} %` : '—');
const TYPES = { support: 'Support', bug: 'Bug', presale: 'Avant-vente', partner: 'Partenariat', custom: 'Sur mesure', other: 'Autre' };

export default function Support({ searchParams }) {
  guard('support');
  const days = [7, 30, 90].includes(Number(searchParams?.j)) ? Number(searchParams.j) : 30;
  const since = Date.now() - days * 864e5;
  const rows = db().prepare('SELECT * FROM ticket_stats WHERE opened_at > ?').all(since);
  const closed = rows.filter((r) => r.closed_at);
  const answered = closed.filter((r) => r.resolved_by !== 'inactif');
  const byIa = answered.filter((r) => r.resolved_by === 'ia').length;
  const rated = rows.filter((r) => r.rating);
  const firstIa = rows.filter((r) => r.first_response_by === 'ia').map((r) => r.first_response_at - r.opened_at);
  const firstTeam = rows.filter((r) => r.transferred_at || r.first_response_by === 'equipe').map((r) => {
    const from = r.transferred_at || r.opened_at;
    return r.staff_id && r.first_response_at && r.first_response_by === 'equipe' ? r.first_response_at - from : null;
  }).filter((x) => x != null && x >= 0);
  const users = Object.fromEntries(db().prepare('SELECT discord_id, username FROM users').all().map((u) => [u.discord_id, u.username]));
  const staff = {};
  for (const r of closed.filter((x) => x.staff_id)) {
    const s = (staff[r.staff_id] ||= { n: 0, notes: [], resp: [] });
    s.n++; if (r.rating) s.notes.push(r.rating);
    if (r.first_response_by === 'equipe' && r.first_response_at) s.resp.push(r.first_response_at - (r.transferred_at || r.opened_at));
  }
  const types = {};
  for (const r of rows) (types[r.type] ||= { n: 0, ia: 0 }).n++, r.resolved_by === 'ia' && types[r.type].ia++;
  const lowNotes = rows.filter((r) => r.rating && r.rating <= 2).sort((a, b) => b.rated_at - a.rated_at).slice(0, 8);
  const h = { ...HOURS_DEFAULT, ...(getSetting('support_hours', {}) || {}) };
  const macros = db().prepare('SELECT * FROM ticket_macros ORDER BY uses DESC, title').all();
  const list = macros.length ? macros : DEFAULT_MACROS.map(([name, title, content]) => ({ name, title, content, uses: 0 }));
  const tab = (j) => <a className={`btn sm${days === j ? ' pri' : ''}`} href={`/admin/support?j=${j}`}>{j} jours</a>;

  return (
    <>
      <Head title="Support" sub="Statistiques des tickets, horaires de l’équipe et réponses toutes faites (/reponse sur Discord)." />
      <Flash searchParams={searchParams} />
      <div className="actions" style={{ marginBottom: 14 }}>{tab(7)}{tab(30)}{tab(90)}</div>
      <div className="kpis">
        <div><b>{rows.length}</b><span>tickets ouverts</span></div>
        <div><b>{pct(byIa, answered.length)}</b><span>réglés par l’IA</span></div>
        <div><b>{dur(median(firstIa))}</b><span>1re réponse de l’IA (médiane)</span></div>
        <div><b>{dur(median(firstTeam))}</b><span>1re réponse de l’équipe après transfert</span></div>
        <div><b>{avg(rated.map((r) => r.rating))}{rated.length ? ' ⭐' : ''}</b><span>note moyenne ({rated.length} avis)</span></div>
        <div><b>{rows.filter((r) => r.priority === 'urgent').length}</b><span>tickets urgents</span></div>
      </div>

      <div className="panel"><h2>Par membre de l’équipe</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>Membre</th><th>Tickets traités</th><th>Réponse (médiane)</th><th>Note moyenne</th></tr></thead>
        <tbody>{Object.keys(staff).length ? Object.entries(staff).sort((a, b) => b[1].n - a[1].n).map(([id, s]) => (
          <tr key={id}><td>{users[id] || <span className="mono">{id}</span>}</td><td>{s.n}</td><td>{dur(median(s.resp))}</td><td>{avg(s.notes)}{s.notes.length ? ` ⭐ (${s.notes.length})` : ''}</td></tr>
        )) : <tr><td colSpan="4" className="muted">Pas encore de ticket traité par l’équipe sur la période.</td></tr>}</tbody>
      </table></div></div>

      <div className="panel"><h2>Par type</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>Type</th><th>Tickets</th><th>Réglés par l’IA</th></tr></thead>
        <tbody>{Object.entries(types).map(([k, t]) => <tr key={k}><td>{TYPES[k] || k}</td><td>{t.n}</td><td>{pct(t.ia, t.n)}</td></tr>)}</tbody>
      </table></div></div>

      {lowNotes.length ? <div className="panel"><h2>Notes basses récentes</h2><div className="pb">{lowNotes.map((r) => (
        <p key={r.channel_id} style={{ margin: '0 0 6px' }}>{'⭐'.repeat(r.rating)} · {TYPES[r.type] || r.type} · {users[r.discord_id] || r.discord_id} · {r.staff_id ? `traité par ${users[r.staff_id] || r.staff_id}` : 'traité par l’IA'} · {new Date(r.rated_at).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}</p>
      ))}<p className="muted" style={{ fontSize: 13 }}>L’historique complet de chaque ticket est dans le salon #transcripts.</p></div></div> : null}

      <div className="panel" id="horaires"><h2>Horaires de l’équipe {h.enabled ? (isOpen(h) ? '· 🟢 ouvert en ce moment' : '· 🌙 fermé en ce moment') : '· désactivés'}</h2>
        <form action={saveHours} className="pb frm">
          <label className="full chk"><input type="checkbox" name="enabled" defaultChecked={h.enabled} /> Activer : hors de ces horaires, le ticket indique quand l’équipe revient (l’IA, elle, répond 24 h/24)</label>
          {DAYS.map((d, i) => (
            <label key={d}>{d} <span className="hint">ex. 18:00-22:00 · vide = fermé</span><input className="field mono" name={`day_${i}`} defaultValue={h.slots?.[i] || ''} /></label>
          ))}
          <label className="full">Message ajouté<input className="field" name="note" maxLength={300} defaultValue={h.note} /></label>
          <div className="full"><button className="btn pri">Enregistrer les horaires</button></div>
        </form>
      </div>

      <div className="panel" id="reponses"><h2>Réponses toutes faites</h2>
        <p className="pb muted" style={{ margin: 0, fontSize: 13.5 }}>Sur Discord, dans un ticket : <code>/reponse</code> puis choisis la réponse. Variables : <code>{'{client}'}</code> mentionne le client, <code>{'{equipe}'}</code> ton pseudo, <code>{'{site}'}</code> l’adresse du site. Les réponses envoyées comptent comme des réponses de l’équipe (l’IA en apprend).</p>
        <div className="mems">
          {list.map((m) => (
            <details key={m.name} className="mem">
              <summary><span className="mono">{m.name}</span> <b>{m.title}</b> <span className="muted">· utilisée {m.uses}×</span></summary>
              <form action={saveMacro} className="frm">
                <input type="hidden" name="old" value={m.name} />
                <label>Nom (commande)<input className="field mono" name="name" defaultValue={m.name} maxLength={40} /></label>
                <label>Titre<input className="field" name="title" defaultValue={m.title} maxLength={100} /></label>
                <label className="full">Texte<textarea name="content" defaultValue={m.content} maxLength={3500} style={{ minHeight: 140 }} /></label>
                <div className="full actions"><button className="btn sm pri">Enregistrer</button></div>
              </form>
              {macros.length ? <form action={deleteMacro}><input type="hidden" name="name" value={m.name} /><button className="btn sm danger">Supprimer</button></form> : null}
            </details>
          ))}
        </div>
        <form action={saveMacro} className="pb frm" style={{ borderTop: '1px solid var(--line)' }}>
          <b className="full">Nouvelle réponse</b>
          <label>Nom (commande)<input className="field mono" name="name" maxLength={40} placeholder="ex. remboursement" /></label>
          <label>Titre<input className="field" name="title" maxLength={100} placeholder="ex. 💸 Demande de remboursement" /></label>
          <label className="full">Texte<textarea name="content" maxLength={3500} style={{ minHeight: 120 }} /></label>
          <div className="full"><button className="btn pri">Ajouter</button></div>
        </form>
      </div>
    </>
  );
}
