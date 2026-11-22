import { notFound } from 'next/navigation';
import { getCatalog, getProduct } from '../../../lib/catalog';
import { AddButton } from '../../../components/Shop';
import { Price, PromoBand } from '../../../components/Price';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const p = await getProduct(params.slug);
  if (!p) return { title: 'Script introuvable' };
  return { title: p.name, description: p.desc, openGraph: { title: p.name, description: p.desc, images: [p.img] } };
}

export default async function ProductPage({ params }) {
  const p = await getProduct(params.slug);
  if (!p) notFound();
  const { products } = await getCatalog();
  const bundleItems = p.bundle.map((k) => products.find((x) => x.key === k)).filter(Boolean);
  const lib = products.find((x) => x.required);

  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap">
        <div className="crumbs"><a href="/#scripts">Catalogue</a> / {p.catName}</div>
        <div className="pp">
          <div className="frame"><i className="tk a"></i><i className="tk d"></i><img src={p.img} alt={`Aperçu de ${p.name}`} style={{ objectPosition: p.pos }} /></div>
          <div className="box">
            <span className="label" style={{ marginBottom: 0 }}><i></i>{p.catName}{p.ver ? ` · v${p.ver}` : ''}</span>
            <h1>{p.name}</h1>
            <p className="long">{p.longDesc}</p>
            {p.feat.length && !bundleItems.length ? <ul className="feats">{p.feat.map((f) => <li key={f}>{f}</li>)}</ul> : null}
            {bundleItems.length ? (
              <ul className="feats">{bundleItems.map((b) => <li key={b.key}><a href={`/scripts/${b.slug}`}>{b.name}</a> · {b.desc}</li>)}</ul>
            ) : null}
            <dl className="spec">
              <dt>Frameworks</dt><dd>ESX, QBCore, QBox</dd>
              {p.required ? <><dt>Prix</dt><dd>Gratuit, obligatoire pour tous nos scripts</dd></>
                : lib ? <><dt>Requis</dt><dd><a href={`/scripts/${lib.slug}`}>{lib.name}</a> (gratuit, ajouté automatiquement au panier)</dd></> : null}
              <dt>Protection</dt><dd>Escrow Cfx.re, configuration ouverte</dd>
              <dt>Mises à jour</dt><dd>Incluses à vie</dd>
              <dt>Livraison</dt><dd>Keymaster Cfx.re, juste après le paiement</dd>
            </dl>
            <PromoBand p={p} />
            <div className="buyrow">
              <Price p={p} />
              <AddButton k={p.key} variant="pri" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
