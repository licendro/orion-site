import { guard } from '../guard';
import { getFullCatalog } from '../../../lib/catalog';
import { licencesEnabled, licenceStats, listLicences, listScripts } from '../../../lib/licences';
import { adminCreateLicence, adminSaveScript } from '../actions';
import { Flash, Head } from '../ui';

const STATUS = { active: ['🟢', 'Active'], suspended: ['🟠', 'Suspendue'], revoked: ['🔴', 'Révoquée'] };
const d = (ms) => (ms ? new Date(ms).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'short', timeStyle: 'short' }) : '—');

export default async function Licences({ searchParams }) {
  guard('licences');
  const tab = searchParams?.tab === 'scripts' ? 'scripts' : 'licences';
  if (!licencesEnabled()) {
    return (<><Head title="Licences" /><div className="flash err">L’API de licences n’est pas reliée : ajoute LICENCE_ADMIN_TOKEN (le même que ADMIN_TOKEN de l’API) dans le .env du site, puis redémarre. Voir licence-api/README.md.</div></>);
  }
  let scripts = [], licences = [], stats = null, error = null;
  try {
    [scripts, stats] = await Promise.all([listScripts(), licenceStats()]);
    if (tab === 'licences') licences = await listLicences({ q: searchParams?.q, script: searchParams?.script, status: searchParams?.status });
  } catch (e) { error = e.message; }
  const { products } = await getFullCatalog();
  const count = (s) => stats?.licences?.find((x) => x.status === s)?.n || 0;
  const t = (k, l) => <a className={`btn sm${tab === k ? ' pri' : ''}`} href={`/admin/licences${k === 'scripts' ? '?tab=scripts' : ''}`}>{l}</a>;

  return (
    <>
      <Head title="Licences" sub={`API de licences · ${count('active')} actives · ${count('suspended')} suspendues · ${count('revoked')} révoquées. Créées automatiquement à chaque achat Tebex, révoquées en cas de remboursement ou de litige.`} />
      <Flash searchParams={searchParams} />
      {error ? <div className="flash err">API de licences injoignable : {error}. Sur le VPS : <code>pm2 logs orion-api</code>.</div> : null}
      <div className="actions" style={{ marginBottom: 14 }}>{t('licences', 'Licences')}{t('scripts', `Scripts (${scripts.length})`)}</div>

      {tab === 'licences' ? (<>
        <form className="actions" method="get" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
          <input className="field" name="q" defaultValue={searchParams?.q || ''} placeholder="Clé, pseudo, ID Discord ou transaction Tebex" style={{ minWidth: 260 }} />
          <select className="field" name="script" defaultValue={searchParams?.script || ''}><option value="">Tous les scripts</option>{scripts.map((s) => <option key={s.name} value={s.name}>{s.title}</option>)}</select>
          <select className="field" name="status" defaultValue={searchParams?.status || ''}><option value="">Tous les statuts</option>{Object.entries(STATUS).map(([k, [e, l]]) => <option key={k} value={k}>{e} {l}</option>)}</select>
          <button className="btn sm">Filtrer</button>
        </form>
        <div className="panel"><div className="tscroll"><table className="tbl">
          <thead><tr><th>#</th><th>Script</th><th>Client</th><th>Statut</th><th>IP liée</th><th>Dernière vérif</th><th>Source</th></tr></thead>
          <tbody>{licences.length ? licences.map((l) => (
            <tr key={l.id}>
              <td className="mono"><a href={`/admin/licences/${l.id}`}>#{l.id}</a></td>
              <td>{l.title || l.script}{l.last_version ? <span className="muted"> · v{l.last_version}</span> : null}</td>
              <td>{l.customer || '—'}{l.discord_id ? <div className="muted mono" style={{ fontSize: 12 }}>{l.discord_id}</div> : null}</td>
              <td>{STATUS[l.status]?.[0]} {STATUS[l.status]?.[1]}</td>
              <td className="mono">{l.ip || <span className="muted">pas encore liée</span>}</td>
              <td className="muted">{d(l.last_check_at)}</td>
              <td className="muted">{l.source === 'manuel' ? 'Manuelle' : 'Tebex'}</td>
            </tr>
          )) : <tr><td colSpan="7" className="muted">Aucune licence.</td></tr>}</tbody>
        </table></div></div>

        <h2 style={{ fontSize: 20, margin: '28px 0 12px' }}>Créer une licence à la main</h2>
        <div className="panel"><form action={adminCreateLicence} className="pb frm">
          <label>Script<select className="field" name="script" required>{scripts.map((s) => <option key={s.name} value={s.name}>{s.title}</option>)}</select></label>
          <label>ID Discord du client <span className="hint">Pour qu’il la voie dans son espace</span><input className="field mono" name="discord_id" maxLength={30} /></label>
          <label>Nom / pseudo<input className="field" name="customer" maxLength={80} /></label>
          <label>Note interne<input className="field" name="note" maxLength={300} placeholder="ex. Cadeau partenaire, test Clem" /></label>
          <div className="full"><button className="btn pri" disabled={!scripts.length}>Créer la licence</button></div>
        </form></div>
      </>) : (<>
        <div className="panel"><div className="tscroll"><table className="tbl">
          <thead><tr><th>Ressource</th><th>Nom</th><th>Produit du site</th><th>Packages Tebex</th><th>Dernière version</th><th>Licences actives</th></tr></thead>
          <tbody>{scripts.length ? scripts.map((s) => (
            <tr key={s.name}><td className="mono">{s.name}</td><td>{s.title}</td><td>{s.product_key || '—'}</td><td className="mono">{s.tebex_ids || '—'}</td><td className="mono">{s.latest_version ? `v${s.latest_version}` : '—'}</td><td>{s.active_licences}</td></tr>
          )) : <tr><td colSpan="6" className="muted">Aucun script : ajoute le premier ci-dessous.</td></tr>}</tbody>
        </table></div></div>
        <h2 style={{ fontSize: 20, margin: '28px 0 12px' }}>Ajouter ou modifier un script</h2>
        <div className="panel"><form action={adminSaveScript} className="pb frm">
          <label>Nom de la ressource <span className="hint">Comme dans le fxmanifest (orion_script), ex. orn_garage</span><input className="field mono" name="name" required pattern="[a-zA-Z0-9_\-]{2,64}" /></label>
          <label>Nom affiché<input className="field" name="title" maxLength={80} /></label>
          <label>Produit du site<select className="field" name="product_key"><option value="">—</option>{products.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></label>
          <label>IDs des packages Tebex <span className="hint">Séparés par des virgules ; ajoute aussi l’ID des packs qui contiennent ce script</span><input className="field mono" name="tebex_ids" placeholder="6123456, 6123999" /></label>
          <div className="full"><button className="btn pri">Enregistrer</button></div>
        </form></div>
        <p className="muted" style={{ fontSize: 13.5 }}>Associé, Clem peut tout faire ici avec son propre compte Discord (rôle Admin dans Admin → Équipe), sans ton compte Cfx.re ni Tebex.</p>
      </>)}
    </>
  );
}
