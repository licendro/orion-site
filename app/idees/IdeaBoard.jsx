'use client';

import { useMemo, useState } from 'react';
import { IDEA_KIND, IDEA_STATUS } from '../../db/ideas.mjs';

const TABS = [
  ['top', 'Populaires'], ['new', 'Récentes'], ['plan', 'Prévues'], ['done', 'Disponibles'],
];
const LOGIN = '/api/auth/discord?next=/idees';

export default function IdeaBoard({ ideas: initial, logged, products }) {
  const [ideas, setIdeas] = useState(initial);
  const [tab, setTab] = useState('top');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', description: '', kind: 'script', product: '' });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    let l = ideas.filter((x) => !s || `${x.title} ${x.description}`.toLowerCase().includes(s));
    if (tab === 'top') l = l.filter((x) => IDEA_STATUS[x.status]?.open).sort((a, b) => b.score - a.score || b.id - a.id);
    if (tab === 'new') l = l.filter((x) => x.status !== 'refusee').sort((a, b) => b.id - a.id);
    if (tab === 'plan') l = l.filter((x) => ['prevue', 'dev'].includes(x.status)).sort((a, b) => b.score - a.score);
    if (tab === 'done') l = l.filter((x) => x.status === 'sortie').sort((a, b) => b.id - a.id);
    return l;
  }, [ideas, tab, q]);

  // Idées proches de ce qu'on est en train d'écrire : pour voter au lieu de dupliquer
  const similar = useMemo(() => {
    const w = f.title.toLowerCase().split(/\W+/).filter((x) => x.length > 3);
    if (w.length < 1) return [];
    return ideas.filter((x) => x.status !== 'refusee' && w.some((m) => x.title.toLowerCase().includes(m))).slice(0, 3);
  }, [f.title, ideas]);

  async function vote(id, value) {
    if (!logged) { window.location.href = LOGIN; return; }
    const r = await fetch('/api/ideas/vote', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, value }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setMsg({ err: true, text: j.error || 'Vote impossible.' });
    setIdeas((l) => l.map((x) => (x.id === id ? { ...x, up: j.up, down: j.down, score: j.up - j.down, my: j.my } : x)));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const r = await fetch('/api/ideas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || 'Envoi impossible.');
      setIdeas((l) => [{ id: j.id, title: f.title.trim(), description: f.description.trim(), kind: f.kind, status: 'nouvelle', up: 1, down: 0, score: 1, my: 1, author_name: 'toi', product: products.find((p) => p.key === f.product)?.name }, ...l]);
      setF({ title: '', description: '', kind: 'script', product: '' });
      setOpen(false); setTab('new');
      setMsg({ text: '💡 Merci ! Ton idée est en ligne ici et dans #suggestions sur Discord. Tu seras prévenu quand elle avancera.' });
    } catch (err) { setMsg({ err: true, text: err.message }); }
    finally { setBusy(false); }
  }

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  return (
    <div className="ideas">
      <div className="ideas-top">
        {logged
          ? <button className="btn pri" onClick={() => setOpen((v) => !v)}>{open ? 'Fermer' : '💡 Proposer une idée'}</button>
          : <a className="btn pri" href={LOGIN}>💡 Proposer une idée</a>}
        <input className="field" placeholder="Rechercher une idée…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher" />
      </div>

      {open ? (
        <form className="qform idea-form" onSubmit={submit}>
          <label className="full">Ton idée en une phrase
            <input className="field" autoFocus required minLength={5} maxLength={100} value={f.title} onChange={set('title')} placeholder="ex. Un script de fourrière avec dépanneuse" />
          </label>
          {similar.length ? (
            <div className="full similar">Déjà proposé ? Vote plutôt pour :{' '}
              {similar.map((x) => <button type="button" key={x.id} className="chipb" onClick={() => vote(x.id, 1)}>👍 {x.title}</button>)}
            </div>
          ) : null}
          <label>Type
            <select className="field" value={f.kind} onChange={set('kind')}>{Object.entries(IDEA_KIND).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}</select>
          </label>
          {f.kind === 'amelioration' ? (
            <label>Quel script ?
              <select className="field" value={f.product} onChange={set('product')}><option value="">Choisir…</option>{products.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
            </label>
          ) : <span />}
          <label className="full">Détails <span className="hint">Facultatif</span>
            <textarea maxLength={1500} value={f.description} onChange={set('description')} placeholder="Ce que le script ferait, pour quel job, ton framework…" />
          </label>
          <div className="full"><button className="btn pri" disabled={busy}>{busy ? 'Envoi…' : 'Publier mon idée'}</button></div>
        </form>
      ) : null}

      {msg ? <div className="qok on" role="status" style={msg.err ? { borderColor: 'rgba(255,122,47,.5)' } : null}>{msg.text}</div> : null}

      <div className="tabs" role="tablist">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      {shown.length ? (
        <ul className="idealist">
          {shown.map((x) => {
            const s = IDEA_STATUS[x.status] || IDEA_STATUS.nouvelle;
            return (
              <li key={x.id}>
                <div className="vote">
                  <button aria-label="Pour" className={x.my > 0 ? 'on' : ''} disabled={!s.open} onClick={() => vote(x.id, 1)}>▲</button>
                  <b>{x.score}</b>
                  <button aria-label="Contre" className={x.my < 0 ? 'on down' : ''} disabled={!s.open} onClick={() => vote(x.id, -1)}>▼</button>
                </div>
                <div className="body">
                  <h4>{x.title}</h4>
                  {x.description ? <p>{x.description}</p> : null}
                  <div className="meta">
                    <span className={`st s-${x.status}`}>{s.emoji} {s.label}</span>
                    <span>{IDEA_KIND[x.kind]?.emoji} {x.product ? `Amélioration · ${x.product}` : IDEA_KIND[x.kind]?.label}</span>
                    {x.author_name ? <span>par {x.author_name}</span> : null}
                    {x.released_k ? <a href={`/scripts/${x.released_k}`}>👉 {x.released_name}</a> : null}
                  </div>
                  {x.note ? <p className="note">💬 {x.note}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      ) : <div className="empty">{tab === 'done' ? 'Aucune idée réalisée pour le moment… bientôt !' : 'Aucune idée ici. Soyez le premier !'}</div>}
    </div>
  );
}
