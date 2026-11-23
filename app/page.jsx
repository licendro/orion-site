import { getCatalog } from '../lib/catalog';
import { eur } from '../lib/format';
import { db } from '../lib/db';
import Effects, { CompatTrack } from '../components/Effects';
import { AddButton } from '../components/Shop';
import { Price, PromoBand } from '../components/Price';

export const dynamic = 'force-dynamic';

function Spot({ p, rev, title, sub, list, children }) {
  if (!p) return null;
  return (
    <div className={'spot' + (rev ? ' rev' : '')}>
      <div className="stx">
        <span className="label"><i></i>{p.name}</span>
        <h3>{title}</h3>
        <p className="sub">{sub}</p>
        <ul className="flist">{list.map((l, i) => <li key={l}><span>0{i + 1}</span>{l}</li>)}</ul>
        <div className="buy">
          <Price p={p} style={{ fontSize: 28 }} />
          <AddButton k={p.key} variant="pri" />
          <a className="btn" href={`/scripts/${p.slug}`}>Détails</a>
        </div>
        <div style={{ maxWidth: 420 }}><PromoBand p={p} /></div>
      </div>
      {children}
    </div>
  );
}

export default async function Home() {
  const { products, categories, pack } = await getCatalog();
  const find = (k) => products.find((p) => p.key === k);
  const police = find('ornpolice');
  const bank = find('ornbank');
  const shop = find('ornshop');
  const bySlug = Object.fromEntries(products.map((p) => [p.key, p]));
  const updates = db().prepare('SELECT product_key, version, notes, created_at FROM changelogs ORDER BY id DESC LIMIT 12').all()
    .filter((u) => bySlug[u.product_key]).filter((u, i, a) => a.findIndex((x) => x.product_key === u.product_key) === i).slice(0, 4)
    .map((u) => ({ ...u, name: bySlug[u.product_key].name, slug: bySlug[u.product_key].slug }));

  return (
    <main id="top">
      <Effects />
      <section className="hero">
        <canvas id="stars" aria-hidden="true"></canvas>
        <div className="wrap" style={{ position: 'relative' }}>
          {police ? <a className="pill" href={`/scripts/${police.slug}`}><b>Nouveau</b>orn_police · fouille, menottes et tablette de recherche <span className="arrow">→</span></a> : null}
          <h1>Des scripts FiveM qui font vivre <span>votre serveur.</span></h1>
          <p className="sub">Banque, garage, police, braquages, métiers : des scripts prêts à installer sur ESX, QBCore ou QBox, livrés dans votre Keymaster et mis à jour à vie.</p>
          <div className="cta">
            <a className="btn pri" href="/scripts">Parcourir les scripts <span className="arrow">→</span></a>
            <a className="btn" href="/services">Nos services</a>
          </div>
        </div>
        <div className="stage">
          <div className="arc" aria-hidden="true"></div>
          <div className="wrap">
            <figure className="shot" id="shot" style={{ margin: '0 auto' }}>
              <i className="tk a"></i><i className="tk b"></i>
              <span className="tag">orn_garage · capture en jeu</span>
              <img src="/img/garage.jpg" alt="Interface du garage Orion en jeu : liste des véhicules, fiche détaillée avec état du moteur, de la carrosserie et du carburant" width="1400" height="788" />
              <div className="fade"></div>
            </figure>
          </div>
        </div>
      </section>

      <CompatTrack />

      {bank || shop ? (
        <section className="band" style={{ paddingTop: 0 }}>
          <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(72px,10vw,140px)' }}>
            <Spot p={bank} title="Une Maze Bank complète, en plein écran." sub="Comptes, distributeurs, virements et factures, dans un écran qui ressemble enfin à une vraie application."
              list={['Virements entre joueurs avec fenêtre de saisie', 'Factures des sociétés, payables en un clic', "Comptes d'entreprise gérés par le patron"]}>
              <div className="frame"><i className="tk a"></i><i className="tk d"></i><img src="/img/banque.jpg" alt="Écran Maze Bank : espèces, compte courant, factures et dernières opérations" loading="lazy" /></div>
            </Spot>
            <Spot p={shop} rev title="Des boutiques que les joueurs aiment ouvrir." sub="Catégories, panier, ruptures de stock, paiement en espèces ou par carte. Une ligne de configuration par magasin."
              list={['Magasins illimités, articles et prix par fichier', 'Stock réel et gérance possible par un joueur', 'Sélection rapide 1 à 9 pour les objets achetés']}>
              <div className="frame"><i className="tk b"></i><i className="tk c"></i><img src="/img/boutique.jpg" alt="Supérette 24/7 : catégories, articles et panier" loading="lazy" /><div className="float"><img src="/img/rapide.jpg" alt="Barre de sélection rapide" loading="lazy" /></div></div>
            </Spot>
          </div>
        </section>
      ) : null}

      <section className="band" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="head" style={{ marginBottom: 28 }}>
            <div><span className="label"><i></i>Explorer</span><h2>Tout Orion, en un coup d’œil.</h2></div>
            <p className="sub">Choisissez une rubrique : la barre de navigation reste toujours à portée de main.</p>
          </div>
          <div className="hub">
            <a href="/scripts" className="big"><span className="k">Boutique</span><b>Les scripts</b><p>{products.filter((p) => !p.required && !p.subscription && !p.bundle?.length).length} scripts prêts à installer{pack ? ', et le pack complet' : ''}.</p><span className="more">Voir le catalogue →</span></a>
            <a href="/services"><span className="k">Sur mesure</span><b>Services</b><p>Bot Discord, développeur partenaire, script sur mesure.</p><span className="more">Voir les formules →</span></a>
            <a href="/idees"><span className="k">Communauté</span><b>Idées</b><p>Proposez un script, votez pour les meilleures idées.</p><span className="more">Proposer →</span></a>
            <a href="/essai"><span className="k">Tester</span><b>Serveur de test</b><p>Essayez nos scripts en jeu avant d’acheter.</p><span className="more">Réserver un créneau →</span></a>
            <a href="/docs"><span className="k">Aide</span><b>Documentation</b><p>Installation, configuration, dépannage.</p><span className="more">Lire la doc →</span></a>
          </div>
        </div>
      </section>

      {updates.length ? (
        <section className="band" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="head" style={{ marginBottom: 24 }}><div><span className="label"><i></i>Nouveautés</span><h2>Dernières mises à jour.</h2></div></div>
            <div className="upd">
              {updates.map((u, k) => (
                <a key={k} href={`/scripts/${u.slug}`}>
                  <span className="mono">v{u.version}</span><b>{u.name}</b>
                  <p>{u.notes.split('\n').map((n) => n.replace(/^[+~-]\s*/, '').trim()).filter(Boolean).slice(0, 2).join(' · ')}</p>
                  <span className="d">{new Date(u.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' })}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}




      <section className="final band">
        <div className="arc" aria-hidden="true"></div>
        <div className="wrap">
          <h2>Un script suffit pour commencer.</h2>
          <p className="sub">Ajoutez les autres quand votre serveur en a besoin : ils partagent la même base, donc la même interface, sans rien reconfigurer.</p>
          <div className="cta">
            <a className="btn pri" href="/scripts">Voir le catalogue</a>
            <a className="btn" href="/services#devis">Demander un devis</a>
          </div>
        </div>
      </section>
    </main>
  );
}
