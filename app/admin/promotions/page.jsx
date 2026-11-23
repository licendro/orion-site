import { guard } from '../guard';
import { db } from '../../../lib/db';
import { getFullCatalog } from '../../../lib/catalog';
import { pluginEnabled } from '../../../lib/tebexPlugin';
import { createPromotion, deletePromotion, togglePromotion } from '../actions';
import { Flash, Head, when } from '../ui';

export default async function Promotions({ searchParams }) {
  guard('promotions');
  const promos = db().prepare('SELECT * FROM promotions ORDER BY created_at DESC').all();
  const { products } = await getFullCatalog();
  const now = Date.now();
  const state = (p) => !p.active ? ['Coupée', 'off'] : p.starts_at && Date.parse(p.starts_at) > now ? ['Programmée', ''] : p.ends_at && Date.parse(p.ends_at) < now ? ['Terminée', 'off'] : ['Active', 'ok'];
  const name = (k) => products.find((p) => p.key === k)?.name || k;

  return (
    <>
      <Head title="Promotions" sub="Affichent le bandeau prix barré + réduction sous les produits. Le coupon Tebex identique garantit que le client paie bien ce prix." />
      <Flash searchParams={searchParams} />

      <div className="panel">
        <h2>Nouvelle promotion</h2>
        <form action={createPromotion} className="pb frm" noValidate>
          <label>Nom<input className="field" name="name" required maxLength={60} placeholder="Black Friday" /></label>
          <label>Texte du bandeau<input className="field" name="banner" maxLength={60} placeholder="Black Friday · jusqu’à dimanche" /></label>
          <label>Type<select className="field" name="type"><option value="percent">Pourcentage (%)</option><option value="fixed">Montant fixe (€)</option></select></label>
          <label>Valeur<input className="field" name="value" required inputMode="decimal" placeholder="20" /></label>
          <label>Début <span className="hint">Vide = maintenant</span><input className="field" name="starts" type="datetime-local" /></label>
          <label>Fin <span className="hint">Vide = sans fin</span><input className="field" name="ends" type="datetime-local" /></label>
          <div className="full" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="chks">
              <label className="chk"><input type="radio" name="scope" value="all" defaultChecked /> Tous les produits</label>
              <label className="chk"><input type="radio" name="scope" value="selected" /> Seulement ceux cochés :</label>
            </div>
            <div className="chks">
              {products.map((p) => <label className="chk" key={p.key}><input type="checkbox" name="keys" value={p.key} /> {p.name}</label>)}
            </div>
          </div>
          <label>Code du coupon Tebex <span className="hint">Vide = généré automatiquement</span><input className="field mono" name="coupon" maxLength={40} placeholder="BLACKFRIDAY" /></label>
          <div className="chks" style={{ alignSelf: 'end' }}>
            <label className="chk"><input type="checkbox" name="tebex" defaultChecked={pluginEnabled()} disabled={!pluginEnabled()} /> Créer le coupon sur Tebex</label>
            <label className="chk"><input type="checkbox" name="announce" /> Annoncer sur Discord</label>
          </div>
          {!pluginEnabled() ? <p className="full hint">Sans <code>TEBEX_SECRET_KEY</code>, crée le coupon toi-même sur Tebex (mêmes produits, même valeur) et indique son code ci-dessus : il sera appliqué automatiquement au paiement.</p> : null}
          <div className="full"><button className="btn pri" type="submit">Créer la promotion</button></div>
        </form>
      </div>

      <div className="panel">
        <h2>Promotions</h2>
        <div className="tscroll"><table className="tbl">
          <thead><tr><th>Nom</th><th>Réduction</th><th>Produits</th><th>Période</th><th>Coupon</th><th>État</th><th></th></tr></thead>
          <tbody>
            {promos.length ? promos.map((p) => {
              const [label, cls] = state(p);
              return (
                <tr key={p.id}>
                  <td><b>{p.name}</b><div className="muted" style={{ fontSize: 12.5 }}>{p.banner}</div></td>
                  <td>{p.type === 'percent' ? `−${p.value} %` : `−${p.value} €`}</td>
                  <td style={{ maxWidth: 260 }}>{p.scope === 'all' ? 'Tous' : p.scope.split(',').map(name).join(', ')}</td>
                  <td className="muted" style={{ fontSize: 13 }}>{p.starts_at ? when(p.starts_at) : 'maintenant'} → {p.ends_at ? when(p.ends_at) : 'sans fin'}</td>
                  <td className="mono">{p.coupon || '—'}</td>
                  <td><span className={`pill2 ${cls}`}>{label}</span></td>
                  <td className="actions">
                    <form action={togglePromotion}><input type="hidden" name="id" value={p.id} /><button className="btn sm">{p.active ? 'Couper' : 'Réactiver'}</button></form>
                    <form action={deletePromotion}><input type="hidden" name="id" value={p.id} /><button className="btn sm danger">Supprimer</button></form>
                  </td>
                </tr>
              );
            }) : <tr><td colSpan="7" className="muted">Aucune promotion.</td></tr>}
          </tbody>
        </table></div>
      </div>
    </>
  );
}
