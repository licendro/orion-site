import { getCatalog } from '../lib/catalog';
import { eur } from '../lib/format';
import Catalog from '../components/Catalog';
import Effects, { CompatTrack } from '../components/Effects';
import QuoteForm, { QuoteButton } from '../components/QuoteForm';
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
          <h1>Une seule interface pour tout votre serveur. <span>Chaque script la parle.</span></h1>
          <p className="sub">Les scripts Orion partagent les mêmes menus, interactions et notifications. Installez-en un ou douze : votre serveur garde un rendu identique, sur ESX, QBCore ou QBox.</p>
          <div className="cta">
            <a className="btn pri" href="#scripts">Parcourir les scripts <span className="arrow">→</span></a>
            <a className="btn" href="#services">Un script sur mesure</a>
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

      <section className="band" id="plateforme">
        <div className="wrap">
          <div className="head">
            <h2>Pensé comme une plateforme, pas comme une pile de scripts.</h2>
            <p className="sub">Chaque script Orion est livré avec orn_lib, notre base commune : interface, ciblage, zones et compatibilité framework. Une mise à jour de la base améliore tous vos scripts Orion d'un coup.</p>
          </div>
          <div className="bento">
            <article className="tile t1">
              <div className="txt"><h3>Menus façon RageUI</h3><p>Sous-menus sans limite, listes, cases, sliders. Cadenas automatiques selon le job, le grade, l'admin ou le véhicule.</p></div>
              <div className="img" role="img" aria-label="Menu personnel Orion avec cadenas et description"></div>
              <img className="img2" src="/img/customs.jpg" alt="Sous-menu mécano avec panneau de couleurs" loading="lazy" />
            </article>
            <article className="tile t2">
              <div className="txt"><h3>Ciblage intégré</h3><p>Maintenez ALT, visez, choisissez. Joueurs, véhicules, objets et zones.</p></div>
              <div className="img" role="img" aria-label="Ciblage Orion sur un citoyen : fouiller, menotter, escorter, facturer"></div>
            </article>
            <article className="tile t3">
              <div className="txt"><h3>Notifications</h3><p>Info, message ou erreur, toujours au même endroit.</p></div>
              <div className="stack" id="stack" aria-live="off"></div>
            </article>
            <article className="tile t4">
              <div className="txt"><h3>Trois lignes pour un menu</h3></div>
              <pre className="code"><b>Orion</b>.Menu.register('garage', {'{'}{'\n'}  title = 'GARAGE',{'\n'}  items = {'{'} {'{'} label = 'Sortir',{'\n'}    lock = {'{'} job = {'{'} police = <em>2</em> {'}'} {'}'} {'}'} {'}'},{'\n'}{'}'}){'\n'}<span className="caret"></span></pre>
            </article>
            <article className="tile t5">
              <div className="txt"><h3>Détecté tout seul</h3><p>Framework, inventaire, ciblage, téléphone, dispatch.</p></div>
              <div className="fw" id="fw">
                {['ESX', 'QBCore', 'QBox', 'ox_inventory', 'ox_target', 'lb-phone'].map((x, i) => <span key={x} className={i === 0 || i === 3 ? 'on' : ''}>{x}</span>)}
              </div>
            </article>
          </div>
        </div>
      </section>

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
            <p className="sub">Scripts sur mesure, bot Discord ou partenariat au mois. On travaille avec la même base que nos scripts, donc tout ce qu'on livre reste cohérent avec le reste de votre serveur.</p>
          </div>
          <div className="tiers">
            <article className="tier">
              <span className="tg" style={{ visibility: 'hidden' }} aria-hidden="true">·</span>
              <h3>Script sur mesure</h3>
              <div className="pr"><b>20 à 100 €</b></div>
              <p>Le prix moyen d'un script développé pour votre serveur, selon sa taille.</p>
              <ul><li>Cahier des charges validé ensemble</li><li>ESX, QBCore ou QBox</li><li>Interface Orion incluse</li><li>Livraison en 3 à 7 jours</li><li>30 jours de corrections</li></ul>
              <QuoteButton type="sur-mesure" className="btn">Demander un devis</QuoteButton>
            </article>
            <article className="tier feat">
              <span className="tg">Pour les serveurs</span>
              <h3>Partenariat serveur</h3>
              <div className="pr"><b>20 à 200 €</b><span>/ mois</span></div>
              <p>Un développeur attitré pour votre serveur. Le prix suit la taille du serveur et le volume de travail.</p>
              <ul><li>Corrections et mises à jour en continu</li><li>Nouveaux scripts selon la formule choisie</li><li>Demandes traitées en priorité</li><li>Réduction sur tout notre catalogue</li><li>Formule ajustable chaque mois, sans engagement</li></ul>
              <QuoteButton type="partenariat" className="btn pri">Proposer un partenariat</QuoteButton>
            </article>
            <article className="tier">
              <span className="tg" style={{ visibility: 'hidden' }} aria-hidden="true">·</span>
              <h3>Bot Discord</h3>
              <div className="pr"><b>25 €</b></div>
              <p>Le bot de votre serveur, prêt et installé sur votre Discord.</p>
              <ul><li>Tickets de support et candidatures</li><li>Whitelist et attribution des rôles</li><li>Statut du serveur et joueurs en ligne</li><li>Logs de modération et d'arrivées</li><li>Couleurs et nom de votre serveur</li></ul>
              <QuoteButton type="bot" className="btn">Commander le bot</QuoteButton>
            </article>
          </div>

          <div className="carte">
            <div><h3>À la carte</h3><p className="sub" style={{ fontSize: 16 }}>Pour un besoin ponctuel. Le prix final dépend de la taille du travail ; le devis est gratuit.</p></div>
            <div className="rows">
              {[
                ['Adaptation de framework', 'dès 25 €', "Passer un script d'ESX à QBCore ou QBox, et inversement."],
                ['Correction de bug', 'dès 15 €', 'Erreur console, script qui ne démarre pas, conflit entre ressources.'],
                ['Optimisation', 'dès 30 €', 'Baisse du resmon, boucles et requêtes SQL trop lourdes.'],
                ['Audit de sécurité', 'dès 35 €', "Recherche de backdoors, d'events exploitables et de triggers non protégés."],
                ['Interface NUI sur mesure', 'dès 79 €', 'Menu, tablette ou écran complet dans le style de votre serveur.'],
                ['Serveur clé en main', 'sur devis', 'Installation txAdmin, framework, base de données, suite ox et scripts Orion configurés.'],
                ['Site boutique relié à Tebex', 'dès 199 €', 'Votre propre site, produits Tebex affichés, paiement sans quitter la page.'],
                ['Système complet', 'sur devis', 'Métier, économie, gouvernement, braquages : un ensemble de scripts pensé ensemble.'],
              ].map(([a, b, c]) => <div className="rw" key={a}><b>{a}</b><span className="p">{b}</span><span className="d">{c}</span></div>)}
            </div>
          </div>

          <div className="steps">
            <div className="step"><b>Devis gratuit</b><p>Vous décrivez le besoin, on répond sous 24 h avec un prix et un délai.</p></div>
            <div className="step"><b>Acompte de 50 %</b><p>Le travail commence à la réception de l'acompte, via Tebex ou PayPal.</p></div>
            <div className="step"><b>Test sur votre serveur</b><p>Vous essayez avant le solde. Les retouches demandées sont incluses.</p></div>
            <div className="step"><b>Livraison</b><p>Solde réglé, fichiers livrés, puis 30 jours de corrections gratuites.</p></div>
          </div>

          <div className="quote" id="devis">
            <div><h3>Demander un devis</h3><p className="sub" style={{ fontSize: 16 }}>Plus la description est précise, plus le devis l'est aussi. Captures, liens et exemples sont les bienvenus sur Discord ensuite.</p></div>
            <QuoteForm />
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
            <details><summary>C'est quoi orn_lib, livré avec les scripts ?</summary><p>La base commune de tous nos scripts : menus, ciblage, zones, notifications et compatibilité ESX, QBCore, QBox. Elle est fournie avec chaque script, ne se vend pas à part et ne sert qu'aux scripts Orion. Il suffit de la démarrer avant eux dans le server.cfg.</p></details>
            <details><summary>Comment marche un partenariat ?</summary><p>On fixe ensemble une formule entre 20 et 200 € par mois selon la taille du serveur et ce dont vous avez besoin. Vous pouvez l'ajuster ou l'arrêter chaque mois.</p></details>
            <details><summary>Comment se passe une commande sur mesure ?</summary><p>Devis gratuit sous 24 h, acompte de 50 %, test sur votre serveur, puis solde et livraison. Les 30 jours suivants, les corrections sont gratuites. Le code livré sur mesure vous appartient.</p></details>
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
            <a className="btn" href="#devis">Demander un devis</a>
          </div>
        </div>
      </section>
    </main>
  );
}
