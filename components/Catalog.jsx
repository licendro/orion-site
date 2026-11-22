'use client';

import { useMemo, useState } from 'react';
import { useShop, AddButton } from './Shop';
import { Price, PromoBand } from './Price';

function Badge({ p }) {
  if (p.price === 0 && p.basePrice === 0) return <span className="badge">Gratuit</span>;
  if (p.was) return <span className="badge hot">−{p.pct} %</span>;
  if (p.isNew) return <span className="badge">Nouveau</span>;
  return null;
}

export default function Catalog({ categories }) {
  const { products } = useShop();
  const [cat, setCat] = useState(0);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('pop');

  const list = useMemo(() => {
    const l = products.filter((p) => !p.bundle.length && (!cat || p.cat === cat) && (p.name + ' ' + p.desc).toLowerCase().includes(q.toLowerCase()));
    const by = {
      pop: (a, b) => b.pop - a.pop,
      asc: (a, b) => a.price - b.price,
      desc: (a, b) => b.price - a.price,
      new: (a, b) => (b.isNew - a.isNew) || String(b.created || '').localeCompare(String(a.created || '')) || b.pop - a.pop,
    }[sort];
    return l.sort(by);
  }, [products, cat, q, sort]);

  const showBig = !cat && !q && sort === 'pop';

  return (
    <>
      <div className="cbar">
        <div className="seg" role="group" aria-label="Catégories">
          {[{ id: 0, name: 'Tous' }, ...categories.filter((c) => products.some((p) => p.cat === c.id && !p.bundle.length))].map((c) => (
            <button key={c.id} aria-pressed={cat === c.id} onClick={() => setCat(c.id)}>{c.name}</button>
          ))}
        </div>
        <label htmlFor="q" className="sr">Rechercher un script</label>
        <input className="field search" id="q" type="search" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label htmlFor="sort" className="sr">Trier</label>
        <select className="field" id="sort" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="pop">Populaires</option>
          <option value="asc">Prix croissant</option>
          <option value="desc">Prix décroissant</option>
          <option value="new">Nouveautés</option>
        </select>
      </div>
      <div className="grid">
        {list.length ? list.map((p) => (showBig && p.featured ? (
          <a className="card big" href={`/scripts/${p.slug}`} key={p.key}>
            <div className="row2">
              <div className="im"><Badge p={p} /><img src={p.img} alt="" loading="lazy" style={{ objectPosition: p.pos }} /></div>
              <div className="bd">
                <div className="top"><h4>{p.name}</h4>{p.ver ? <span className="v">v{p.ver}</span> : null}</div>
                <p>{p.desc}</p>
                <ul>{p.feat.slice(0, 3).map((f) => <li key={f}>{f}</li>)}</ul>
                <PromoBand p={p} />
                <div className="ft"><Price p={p} /><AddButton k={p.key} /></div>
              </div>
            </div>
          </a>
        ) : (
          <a className="card" href={`/scripts/${p.slug}`} key={p.key}>
            <div className="im"><Badge p={p} /><img src={p.img} alt="" loading="lazy" style={{ objectPosition: p.pos }} /></div>
            <div className="bd">
              <div className="top"><h4>{p.name}</h4><span className="v">{p.ver ? `v${p.ver} · ` : ''}{p.catName}</span></div>
              <p>{p.desc}</p>
              <PromoBand p={p} />
              <div className="ft"><Price p={p} /><AddButton k={p.key} /></div>
            </div>
          </a>
        ))) : (
          <div className="empty">
            Aucun script ne correspond.{' '}
            <button className="btn sm" onClick={() => { setCat(0); setQ(''); }}>Tout afficher</button>
          </div>
        )}
      </div>
    </>
  );
}
