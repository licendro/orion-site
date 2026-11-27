import { getLegal, v } from '../../lib/legal';
import { PRIVACY_UPDATED } from '../../content/legal';
import CookieLink from '../../components/CookieLink';

export const metadata = { title: 'Politique de confidentialité', description: 'Quelles données Orion collecte, pourquoi, combien de temps, et comment exercer vos droits (RGPD).' };

const ROWS = [
  ['Compte et connexion', 'Identifiant, pseudo et avatar Discord ; date de dernière connexion', 'Vous connecter, relier vos achats à votre compte, vous donner accès à notre Discord', 'Exécution du contrat', '3 ans après votre dernière connexion si vous n’avez rien acheté, sinon tant que le compte existe'],
  ['Achats', 'Pseudo Cfx.re (FiveM), produits, montant, date, et les informations de commande transmises par Tebex (nom, e-mail, pays)', 'Livrer vos licences, gérer le support, les remboursements et nos obligations comptables', 'Exécution du contrat, obligation légale', '10 ans (Code de commerce, art. L123-22) ; le détail brut transmis par Tebex est effacé après 1 an'],
  ['Acceptation des CGV', 'Version des CGV acceptée, renonciation au droit de rétractation, produits, date', 'Prouver votre accord au moment de la commande', 'Obligation légale (Code de la consommation)', '5 ans'],
  ['Devis', 'Compte Discord, type de service, framework, budget, description', 'Répondre à votre demande et préparer un devis', 'Mesures précontractuelles', '3 ans après le dernier échange'],
  ['Idées, votes et bugs', 'Compte Discord, texte publié, votes', 'Faire fonctionner les idées et le suivi des bugs, vous prévenir de leur avancement', 'Intérêt légitime', 'Tant que la publication est en ligne ; votre nom est retiré si vous supprimez votre compte'],
  ['Tickets Discord', 'Messages et captures échangés dans le ticket, note de satisfaction, délais de réponse', 'Vous aider ; historique du support', 'Exécution du contrat, intérêt légitime', '3 ans après la fermeture'],
  ['Assistant IA des tickets', 'Messages du ticket envoyés à Anthropic (Claude) pour générer la réponse ; un court profil technique retenu par l’assistant (framework, inventaire, scripts utilisés)', 'Répondre à vos demandes de support et ne pas vous reposer les mêmes questions', 'Intérêt légitime', 'Profil : 2 ans après sa dernière mise à jour ; les connaissances générales apprises ne contiennent aucune donnée personnelle'],
  ['Serveur de test', 'Compte Discord, créneau réservé', 'Gérer la file d’attente et l’accès au serveur', 'Exécution du contrat', '1 an'],
  ['Modération Discord', 'Avertissements et sanctions', 'Faire respecter le règlement du serveur', 'Intérêt légitime', '1 an'],
  ['Sécurité', 'Adresse IP (en mémoire, quelques minutes), journaux techniques', 'Limiter les abus, prévenir la fraude, corriger les pannes', 'Intérêt légitime', 'IP non enregistrée ; journaux 1 an'],
];

export default function Privacy() {
  const l = getLegal();
  return (
    <main className="band legal-doc">
      <div className="wrap">
        <span className="label"><i></i>RGPD</span>
        <h1>Politique de confidentialité</h1>
        <p className="muted">Dernière mise à jour : {PRIVACY_UPDATED}.</p>

        <p>On collecte le strict nécessaire pour vous vendre des scripts et vous aider. Pas de publicité, pas de revente de données, pas d’outil de mesure d’audience.</p>

        <h2>Responsable du traitement</h2>
        <p>{v(l.name)}{l.brand ? ` (${l.brand})` : ''}, {v(l.address)}. Contact : {l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : v('')} ou un ticket sur notre Discord.</p>

        <h2>Données, finalités, bases légales et durées</h2>
        <div className="tscroll"><table className="ltbl">
          <thead><tr><th>Quoi</th><th>Données</th><th>Pourquoi</th><th>Base légale</th><th>Durée</th></tr></thead>
          <tbody>{ROWS.map((r) => <tr key={r[0]}>{r.map((c, i) => (i ? <td key={i}>{c}</td> : <th key={i} scope="row">{c}</th>))}</tr>)}</tbody>
        </table></div>
        <p>Aucune donnée bancaire n’arrive sur ce site : le paiement se fait entièrement chez Tebex.</p>

        <h2>Qui reçoit vos données</h2>
        <ul>
          <li><b>Tebex Limited</b> (Royaume-Uni) : paiement, facturation, prévention de la fraude. Le Royaume-Uni bénéficie d’une décision d’adéquation de la Commission européenne.</li>
          <li><b>Discord Inc.</b> (États-Unis) : connexion, serveur communautaire, tickets, messages privés du bot. Transfert encadré par le Data Privacy Framework UE–États-Unis.</li>
          <li><b>Cfx.re</b> (Rockstar Games / Take-Two) : attribution des licences à votre compte FiveM (Keymaster).</li>
          <li><b>{v(l.host_name)}</b> : hébergement du site et de sa base de données.</li>
          <li><b>Anthropic PBC</b> (États-Unis) : génération des réponses de l’assistant IA des tickets. Transfert encadré par les clauses contractuelles types de la Commission européenne.</li>
          <li><b>YouTube</b> (Google) : uniquement si vous lancez une vidéo de présentation, avec votre accord.</li>
        </ul>
        <p>Seuls l’éditeur et les membres de l’équipe Orion habilités (support) accèdent à vos données, selon leur rôle.</p>

        <h2 id="cookies">Cookies et stockage local</h2>
        <p><b>Nécessaires</b> (pas de consentement requis) : cookie de session après connexion Discord (30 jours), cookies temporaires de connexion (10 minutes), panier, compte FiveM relié et mémorisation de votre choix de cookies (stockés dans votre navigateur), et les traceurs de Tebex pendant le paiement.</p>
        <p><b>Avec votre accord</b> : la lecture des vidéos YouTube (Google peut alors déposer des traceurs), et la mémorisation pendant 30 jours du code créateur apporté par un lien. Votre choix, accord ou refus, est gardé 6 mois puis redemandé. Vous pouvez le changer à tout moment : <CookieLink />.</p>
        <p>Les polices du site sont hébergées sur notre serveur : aucune requête n’est envoyée à Google en naviguant.</p>

        <h2>Vos droits</h2>
        <p>Vous pouvez accéder à vos données, les corriger, les effacer, en limiter l’usage, vous opposer à un traitement fondé sur l’intérêt légitime, les récupérer dans un format lisible (portabilité), retirer votre consentement, et donner des directives sur leur sort après votre décès.</p>
        <ul>
          <li><b>Tout de suite, en autonomie</b> : depuis <a href="/compte">Mon compte</a>, « Télécharger mes données » et « Supprimer mon compte ».</li>
          <li><b>Sinon</b> : écrivez-nous ({l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : v('')}) ou ouvrez un ticket. Réponse sous un mois au plus.</li>
        </ul>
        <p>Les données de commande nécessaires à la comptabilité sont conservées malgré une suppression de compte (obligation légale), mais détachées de votre compte Discord.</p>
        <p>Si vous estimez que vos droits ne sont pas respectés, vous pouvez saisir la <b>CNIL</b> : <a href="https://www.cnil.fr/fr/plaintes" target="_blank" rel="noopener">cnil.fr/fr/plaintes</a>.</p>

        <h2>Mineurs</h2>
        <p>Le compte Discord exige l’âge minimum fixé par Discord. Pour acheter, il faut être majeur ou avoir l’accord d’un parent ou tuteur.</p>

        <h2>Sécurité</h2>
        <p>Connexion chiffrée (HTTPS), sessions protégées, accès à l’administration limité par rôles, journal des actions de l’équipe, aucune donnée de paiement stockée.</p>
      </div>
    </main>
  );
}
