import { changelogAll } from '../../lib/changelog';
import { VersionEntry } from '../../components/Changelog';

export const metadata = { title: 'Changelog', description: 'Toutes les mises à jour des scripts FiveM Orion : ajouts, améliorations et correctifs.' };
export const dynamic = 'force-dynamic';

export default function ChangelogAll({ searchParams }) {
  const data = changelogAll();
  const title = Object.fromEntries(data.scripts.map((s) => [s.name, s.title]));
  const kind = searchParams?.type;
  const recent = kind ? data.recent.filter((v) => v.kinds.includes(kind)) : data.recent;
  const chip = (k, l) => <a className={`chipf${(kind || '') === k ? ' on' : ''}`} href={k ? `/changelog?type=${k}` : '/changelog'}>{l}</a>;
  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap" style={{ maxWidth: 980 }}>
        <div className="head" style={{ marginBottom: 24 }}>
          <div><span className="label"><i></i>Changelog</span><h2>Toutes les nouveautés.</h2></div>
          <p className="sub">Chaque mise à jour de nos scripts, avec ses ajouts, améliorations et correctifs. Les mises à jour sont gratuites : téléchargez la dernière version dans votre Keymaster Cfx.re.</p>
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
