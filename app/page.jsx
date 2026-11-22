import { getCatalog } from '../lib/catalog';
import { eur } from '../lib/format';
import Catalog from '../components/Catalog';
import Effects, { CompatTrack } from '../components/Effects';
import { AddButton } from '../components/Shop';
import { Price, PromoBand } from '../components/Price';

export const revalidate = 300;

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
  const packItems = pack ? pack.bundle.map(find).filter(Boolean) : [];
  const packTotal = packItems.reduce((s, p) => s + p.price, 0);

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
            <a className="btn pri" href="#scripts">Parcourir les scripts <span className="arrow">→</span></a>
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

      <section className="band" id="scripts" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="head" style={{ marginBottom: 32 }}><h2>Le catalogue.</h2><p className="sub">Chaque script est livré dans votre Keymaster, mis à jour à vie, avec sa configuration ouverte.</p></div>
          <Catalog categories={categories} />
        </div>
      </section>

      {pack ? (
        <section className="band" id="pack" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="pack">
              <div className="ring" aria-hidden="true"></div>
              <div className="l">
                <span className="label"><i></i>Offre groupée</span>
                <h2>{pack.name}</h2>
                <p className="sub">{pack.desc} Une installation, une configuration, une interface identique partout.</p>
                <div style={{ display: 'flex', gap: 12, marginTop: 32, flexWrap: 'wrap' }}>
                  <AddButton k={pack.key} variant="hot" />
                  <a className="btn" href="#scripts">Voir chaque script</a>
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

      <section className="band" id="services" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="head">
            <div><span className="label"><i></i>Services</span><h2>Votre serveur, développé par ceux qui écrivent les scripts.</h2></div>
            <p className="sub">Bot Discord, développeur attitré au mois ou script sur mesure : des formules claires, avec tout ce qui est inclus.</p>
          </div>
          <div className="svc">
            <a href="/services#bot"><span className="from">dès 25 €</span><b>Bot Discord</b><p>Tickets, rôles, statut, modération, candidatures, liaison boutique.</p><span className="more">Voir les formules →</span></a>
            <a href="/services#partenariat"><span className="from">20 à 200 € / mois</span><b>Développeur partenaire</b><p>On rejoint votre équipe : corrections, nouveaux scripts, optimisation.</p><span className="more">Voir les formules →</span></a>
            <a href="/services#sur-mesure"><span className="from">dès 20 €</span><b>Script sur mesure</b><p>Le script qu’il manque à votre serveur, dans le style Orion.</p><span className="more">Voir les formules →</span></a>
          </div>
        </div>
      </section>

      <section className="band" id="faq" style={{ paddingTop: 0 }}>
        <div className="wrap faq">
          <div><h2>Questions fréquentes.</h2><p className="sub">Une autre question ? Notre Discord répond en général dans la journée.</p></div>
          <div>
            <details open><summary>Comment je reçois mes scripts ?</summary><p>Après le paiement, ils apparaissent dans votre Keymaster sur portal.cfx.re, liés au compte FiveM utilisé à la connexion, dans la section « Granted assets ».</p></details>
            <details><summary>Pourquoi se connecter avec FiveM ?</summary><p>Les scripts sont protégés par l'escrow Cfx.re. La connexion relie l'achat à votre compte, sans quoi la licence ne peut pas être attribuée.</p></details>
            <details><summary>Quels frameworks sont compatibles ?</summary><p>ESX Legacy, QBCore et QBox, détectés automatiquement. Inventaires : ox_inventory, qs-inventory, qb-inventory.</p></details>
            <details><summary>Comment marche un partenariat ?</summary><p>On fixe ensemble une formule entre 20 et 200 € par mois selon la taille du serveur et ce dont vous avez besoin. Vous pouvez l'ajuster ou l'arrêter chaque mois.</p></details>
            <details><summary>Comment se passe une commande sur mesure ?</summary><p>Devis gratuit sous 24 h, acompte de 50 %, test sur votre serveur, puis solde et livraison. Les corrections sont ensuite gratuites selon la formule. Le script est livré protégé avec sa configuration ouverte ; le code source n'est fourni que sur exception.</p></details>
            <details><summary>Je peux modifier le code ?</summary><p>La configuration, les textes et les fichiers d'ouverture (client/open.lua, server/open.lua) sont modifiables. Le cœur du script reste protégé.</p></details>
          </div>
        </div>
      </section>

      <section className="final band">
        <div className="arc" aria-hidden="true"></div>
        <div className="wrap">
          <h2>Un script suffit pour commencer.</h2>
          <p className="sub">Ajoutez les autres quand votre serveur en a besoin : ils partagent la même base, donc la même interface, sans rien reconfigurer.</p>
          <div className="cta">
            <a className="btn pri" href="#scripts">Voir le catalogue</a>
            <a className="btn" href="/services#devis">Demander un devis</a>
          </div>
        </div>
      </section>
    </main>
  );
}
