'use client';

import { useMemo, useState } from 'react';

export default function DocsSearch({ docs, categories }) {
  const [q, setQ] = useState('');
  const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const found = useMemo(() => docs.filter((d) => norm(`${d.title} ${d.summary} ${d.category}`).includes(norm(q))), [docs, q]);
  return (
    <>
      <label htmlFor="dq" className="sr">Rechercher dans la documentation</label>
      <input id="dq" className="field search" type="search" placeholder="Rechercher : installation, licence, orn_bank…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', maxWidth: 560, marginBottom: 32 }} />
      {categories.map((c) => {
        const items = found.filter((d) => d.category === c);
        if (!items.length) return null;
        return (
          <section key={c} className="dcat">
            <h3>{c}</h3>
            <div className="dgrid">
              {items.map((d) => <a key={d.slug} href={`/docs/${d.slug}`}><b>{d.title}</b><span>{d.summary}</span></a>)}
            </div>
          </section>
        );
      })}
      {!found.length ? <div className="empty">Aucun résultat. Essayez un autre mot, ou ouvrez un ticket.</div> : null}
    </>
  );
}
