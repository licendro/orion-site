import { getCatalog } from '../../lib/catalog';
import { eur } from '../../lib/format';
import Catalog from '../../components/Catalog';
import { AddButton } from '../../components/Shop';

export const metadata = { title: 'Scripts', description: 'Tous les scripts FiveM Orion : banque, garage, police, boutiques, braquages. Compatibles ESX, QBCore et QBox.' };

export default async function Scripts() {
  const { products, categories, pack } = await getCatalog();
  const find = (k) => products.find((p) => p.key === k);
  const packItems = pack ? pack.bundle.map(find).filter(Boolean) : [];
  const packTotal = packItems.reduce((s, p) => s + p.price, 0);
  return (
    <main>
      <section className="band" id="catalogue" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
        <div className="wrap">
          <div className="head" style={{ marginBottom: 32 }}>
            <div><span className="label"><i></i>Boutique</span><h2>Le catalogue.</h2></div>
            <p className="sub">Chaque script est livré dans votre Keymaster Cfx.re, mis à jour à vie, avec sa configuration ouverte. Envie d’essayer avant ? <a href="/essai">Réservez le serveur de test</a>.</p>
          </div>
          <Catalog categories={categories} />
        </div>
      </section>

      {pack ? (
        <section className="band" id="packs" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="pack">
              <div className="ring" aria-hidden="true"></div>
              <div className="l">
                <span className="label"><i></i>Offre groupée</span>
                <h2>{pack.name}</h2>
                <p className="sub">{pack.desc} Une installation, une configuration, une interface identique partout.</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
                  <AddButton k={pack.key} variant="hot" />
                  <a className="btn" href="#catalogue">Voir chaque script</a>
                </div>
              </div>
              <div className="r">
                {packItems.map((p) => <div className="pk" key={p.key}><span>{p.name}</span><span className="mono">{eur(p.price)}</span></div>)}
                <div className="ptot">
                  <b>{eur(pack.price)}</b>
                  {packTotal > pack.price ? <span><s>{eur(packTotal)}</s> · {Math.round((1 - pack.price / packTotal) * 100)} % d'économie</span> : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
