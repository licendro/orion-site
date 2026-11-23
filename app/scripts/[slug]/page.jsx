import { notFound } from 'next/navigation';
import { getCatalog, getProduct } from '../../../lib/catalog';
import { AddButton } from '../../../components/Shop';
import { Price, PromoBand } from '../../../components/Price';
import Gallery from '../../../components/Gallery';
import { db } from '../../../lib/db';

export const revalidate = 300;

export async function generateMetadata({ params }) {
  const p = await getProduct(params.slug);
  if (!p) return { title: 'Script introuvable' };
  return { title: p.name, description: p.desc, openGraph: { title: `${p.name} · Orion Scripts`, description: p.desc } };
}

export default async function ProductPage({ params }) {
  const p = await getProduct(params.slug);
  if (!p) notFound();
  const { products } = await getCatalog();
  const bundleItems = p.bundle.map((k) => products.find((x) => x.key === k)).filter(Boolean);
  const lib = products.find((x) => x.required);
  const logs = db().prepare('SELECT version, notes, created_at FROM changelogs WHERE product_key = ? ORDER BY id DESC LIMIT 8').all(p.key);
  const doc = db().prepare('SELECT slug FROM docs WHERE product_key = ? AND published = 1 ORDER BY sort LIMIT 1').get(p.key);
  const images = [p.img, ...p.gallery.filter((g) => g !== p.img)];

  return (
    <main className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div className="wrap">
        <div className="crumbs"><a href="/#scripts">Catalogue</a> / {p.catName}</div>
        <div className="pp">
          <Gallery images={images} video={p.video} name={p.name} pos={p.pos} />
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
            <a className="btn" href={`/docs/${doc?.slug || `script-${p.slug}`}`}>📚 Documentation du script</a>
          </div>
        </div>

        {logs.length ? (
          <section className="changelog">
            <h2>Historique des versions</h2>
            <ol>
              {logs.map((l, k) => (
                <li key={k}>
                  <div className="v"><b className="mono">v{l.version}</b><span>{new Date(l.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })}</span>{k === 0 ? <span className="badge">Actuelle</span> : null}</div>
                  <ul>{l.notes.split('\n').map((n) => n.trim()).filter(Boolean).map((n, j) => (
                    <li key={j} className={n.startsWith('+') ? 'add' : n.startsWith('-') ? 'del' : n.startsWith('~') ? 'fix' : ''}>{n.replace(/^[+~-]\s*/, '')}</li>
                  ))}</ul>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>
    </main>
  );
}
