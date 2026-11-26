import { changelogAll } from '../../lib/licences';
import { db } from '../../lib/db';
import { VersionEntry } from '../../components/Changelog';

export const metadata = { title: 'Changelog', description: 'Toutes les mises à jour des scripts FiveM Orion : ajouts, améliorations et correctifs.' };
export const dynamic = 'force-dynamic';

// Repli si l'API de licences ne répond pas : historique local du site
function localData() {
  const rows = db().prepare('SELECT c.*, p.name FROM changelogs c LEFT JOIN products p ON p.key = c.product_key ORDER BY c.id DESC LIMIT 60').all();
  return {
    scripts: [...new Map(rows.map((r) => [r.product_key, { name: r.product_key, title: r.name || r.product_key, latest: r.version }])).values()],
    recent: rows.map((r) => ({ script: r.product_key, version: r.version, date: Date.parse(r.created_at.replace(' ', 'T') + 'Z'), kinds: [], notes: r.notes })),
  };
}

export default async function ChangelogAll({ searchParams }) {
  let data;
  try { data = await changelogAll(); } catch { data = localData(); }
  const title = Object.fromEntries(data.scripts.map((s) => [s.name, s.title]));
  const kind = searchParams?.type;
  const recent = kind ? data.recent.filter((v) => v.kinds.includes(kind)) : data.recent;
  const chip = (k, l) => <a className={`chipf${(kind || '') === k ? ' on' : ''}`} href={k ? `/changelog?type=${k}` : '/changelog'}>{l}</a>;
  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap" style={{ maxWidth: 980 }}>
        <div className="head" style={{ marginBottom: 24 }}>
          <div><span className="label"><i></i>Changelog</span><h2>Toutes les nouveautés.</h2></div>
          <p className="sub">Chaque mise à jour de nos scripts, avec ses ajouts, améliorations et correctifs. Vos serveurs vous préviennent au démarrage quand une nouvelle version sort.</p>
        </div>
        <div className="cl-scripts">
          {data.scripts.map((s) => <a key={s.name} href={`/changelog/${s.name}`}><b>{s.title}</b><span className="mono">{s.latest ? `v${s.latest}` : '—'}</span></a>)}
        </div>
        <div className="chips" style={{ margin: '28px 0 8px' }}>{chip('', 'Tout')}{chip('ajout', 'Ajouts')}{chip('amelioration', 'Améliorations')}{chip('correctif', 'Correctifs')}</div>
        <div className="vers">
          {recent.length ? recent.map((v) => <VersionEntry key={`${v.script}-${v.version}`} v={v} title={title[v.script] || v.script} href={`/changelog/${v.script}#v${v.version}`} />)
            : <div className="empty">Aucune mise à jour publiée pour le moment.</div>}
        </div>
      </div>
    </main>
  );
}
