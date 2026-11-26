import { guard } from '../guard';
import { db } from '../../../lib/db';
import { getFullCatalog } from '../../../lib/catalog';
import { publishUpdate } from '../actions';
import { Flash, Head, when } from '../ui';

export default async function Updates({ searchParams }) {
  guard('updates');
  const { products } = await getFullCatalog();
  const logs = db().prepare('SELECT * FROM changelogs ORDER BY created_at DESC LIMIT 30').all();
  const name = (k) => products.find((p) => p.key === k)?.name || k;
  return (
    <>
      <Head title="Mises à jour" sub="Publie une version : dernière version dans l’API de licences (les serveurs FiveM affichent « mise à jour disponible »), page /changelog, post dans #patch-notes et message aux clients." />
      <Flash searchParams={searchParams} />
      <div className="panel">
        <h2>Nouveau patch note</h2>
        <form action={publishUpdate} className="pb frm">
          <label>Script<select className="field" name="key" required>{products.filter((p) => !p.bundle.length).map((p) => <option key={p.key} value={p.key}>{p.name}{p.ver ? ` (v${p.ver})` : ''}</option>)}</select></label>
          <label>Nouvelle version<input className="field mono" name="version" required maxLength={20} placeholder="1.2.0" /></label>
          <label className="full">Notes (markdown) <span className="hint">Une ligne par changement : « + » ajout, « ~ » amélioration, « - » correctif. Envoyées à l’API, à /changelog et à #patch-notes.</span>
            <textarea name="notes" required maxLength={3500} style={{ minHeight: 160 }} placeholder={'+ Nouveau menu de configuration\n~ Correction des factures en double\n- Suppression de l’ancien HUD'} />
          </label>
          <div className="full chks">
            <span className="hint" style={{ width: '100%' }}>Badges (sinon devinés depuis les lignes + / ~ / -) :</span>
            <label className="chk"><input type="checkbox" name="kind_ajout" /> Ajout</label>
            <label className="chk"><input type="checkbox" name="kind_amelioration" /> Amélioration</label>
            <label className="chk"><input type="checkbox" name="kind_correctif" /> Correctif</label>
          </div>
          <div className="full chks">
            <label className="chk"><input type="checkbox" name="announce" defaultChecked /> Poster dans #patch-notes</label>
            <label className="chk"><input type="checkbox" name="clients" defaultChecked /> Prévenir chaque client dans son salon</label>
          </div>
          <p className="full hint">Pense à mettre le nouveau fichier à jour sur Tebex / Keymaster : c’est là que les clients le téléchargent.</p>
          <div className="full"><button className="btn pri">Publier la mise à jour</button></div>
        </form>
      </div>
      <div className="panel"><h2>Historique</h2><div className="tscroll"><table className="tbl">
        <thead><tr><th>Date</th><th>Script</th><th>Version</th><th>Notes</th><th>Par</th></tr></thead>
        <tbody>{logs.length ? logs.map((l) => (
          <tr key={l.id}><td className="muted">{when(l.created_at)}</td><td>{name(l.product_key)}</td><td className="mono">{l.version}</td><td style={{ whiteSpace: 'pre-line', maxWidth: 420 }}>{l.notes}</td><td className="muted">{l.author}</td></tr>
        )) : <tr><td colSpan="5" className="muted">Aucune mise à jour publiée.</td></tr>}</tbody>
      </table></div></div>
    </>
  );
}
