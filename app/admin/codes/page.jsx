import { guard } from '../guard';
import { getFullCatalog } from '../../../lib/catalog';
import { listCoupons, pluginEnabled } from '../../../lib/tebexPlugin';
import { createCode, removeCode } from '../actions';
import { Flash, Head } from '../ui';

export default async function Codes({ searchParams }) {
  guard('codes');
  const enabled = pluginEnabled();
  let coupons = [];
  let error = null;
  if (enabled) {
    try { coupons = await listCoupons(); } catch (e) { error = e.message; }
  }
  const { products } = await getFullCatalog();

  return (
    <>
      <Head title="Codes promo" sub="Codes que les clients tapent dans le panier. Ils sont créés directement sur Tebex, qui calcule la réduction." />
      <Flash searchParams={searchParams} />
      {!enabled ? (
        <div className="flash err">Ajoute <code>TEBEX_SECRET_KEY</code> dans le .env du site pour gérer les codes ici. En attendant, crée-les sur Tebex (Webstore → Coupons) : ils fonctionnent déjà dans le panier.</div>
      ) : null}
      {error ? <div className="flash err">Tebex : {error}</div> : null}

      {enabled ? (
        <div className="panel">
          <h2>Nouveau code</h2>
          <form action={createCode} className="pb frm" noValidate>
            <label>Code<input className="field mono" name="code" required maxLength={40} placeholder="ORION10" /></label>
            <label>Type<select className="field" name="type"><option value="percent">Pourcentage (%)</option><option value="fixed">Montant fixe (€)</option></select></label>
            <label>Valeur<input className="field" name="value" required inputMode="decimal" placeholder="10" /></label>
            <label>Utilisations max <span className="hint">0 = illimité</span><input className="field" name="max" type="number" min="0" defaultValue="0" /></label>
            <label>Expire le <span className="hint">Vide = jamais</span><input className="field" name="expires" type="date" /></label>
            <div />
            <div className="full chks">
              <label className="chk"><input type="radio" name="scope" value="all" defaultChecked /> Tout le panier</label>
              <label className="chk"><input type="radio" name="scope" value="selected" /> Seulement :</label>
              {products.filter((p) => p.tebexId).map((p) => <label className="chk" key={p.key}><input type="checkbox" name="keys" value={p.key} /> {p.name}</label>)}
            </div>
            <div className="full"><button className="btn pri">Créer sur Tebex</button></div>
          </form>
        </div>
      ) : null}

      {enabled ? (
        <div className="panel">
          <h2>Codes sur Tebex</h2>
          <div className="tscroll"><table className="tbl">
            <thead><tr><th>Code</th><th>Réduction</th><th>S’applique à</th><th>Expiration</th><th></th></tr></thead>
            <tbody>
              {coupons.length ? coupons.map((c) => (
                <tr key={c.id}>
                  <td className="mono"><b>{c.code}</b></td>
                  <td>{c.discount?.type === 'value' ? `−${c.discount?.value} €` : `−${c.discount?.percentage ?? c.discount?.value} %`}</td>
                  <td>{c.effective?.type === 'cart' ? 'Tout le panier' : `${(c.effective?.packages || []).length} script(s)`}</td>
                  <td className="muted">{c.expire?.redeem_unlimited === false ? `${c.expire?.limit} utilisations` : ''} {c.expire?.date && !String(c.expire.date).startsWith('0') ? `jusqu’au ${String(c.expire.date).slice(0, 10)}` : ''}</td>
                  <td><form action={removeCode}><input type="hidden" name="id" value={c.id} /><button className="btn sm danger">Supprimer</button></form></td>
                </tr>
              )) : <tr><td colSpan="5" className="muted">Aucun code.</td></tr>}
            </tbody>
          </table></div>
        </div>
      ) : null}
    </>
  );
}
