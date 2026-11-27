import { getLegal, v } from '../../lib/legal';
import { CGV_VERSION } from '../../content/legal';

export const metadata = { title: 'Conditions générales de vente', description: 'Conditions de vente des scripts FiveM et des services Orion : commande, livraison, rétractation, garanties, licence.' };

export default function Cgv() {
  const l = getLegal();
  const brand = l.brand || 'Orion Scripts';
  const mail = l.email ? <a href={`mailto:${l.email}`}>{l.email}</a> : v('');
  return (
    <main className="band legal-doc">
      <div className="wrap">
        <span className="label"><i></i>Conditions</span>
        <h1>Conditions générales de vente et d’utilisation</h1>
        <p className="muted">Version du {CGV_VERSION.split('-').reverse().join('/')}. La version acceptée lors de votre commande est enregistrée avec elle.</p>

        <h2>1. Qui sommes-nous</h2>
        <p>Les produits et services sont proposés par {v(l.name)}, {v(l.status)}, SIRET {v(l.siret)}, {v(l.address)}, sous le nom commercial <b>{brand}</b> (le « Vendeur »). Contact : {mail}, téléphone {v(l.phone)}, ou un ticket sur notre Discord.</p>
        <p>Les paiements sont encaissés par <b>Tebex Limited</b>, qui agit comme revendeur (« merchant of record ») : il traite le paiement, émet le reçu et applique les taxes éventuelles. Les conditions de Tebex s’appliquent au paiement lui-même ; les présentes CGV s’appliquent aux produits, à leur licence et aux services.</p>

        <h2>2. Produits et services</h2>
        <ul>
          <li><b>Scripts</b> : contenus numériques (ressources pour serveurs FiveM) fournis sous forme de licence d’utilisation, livrés dans le Keymaster Cfx.re de l’acheteur.</li>
          <li><b>Services</b> : scripts sur mesure, bots Discord, et abonnement « développeur partenaire ».</li>
        </ul>
        <p>Les caractéristiques essentielles (fonctions, frameworks compatibles, dépendances) figurent sur la fiche de chaque produit. Un serveur FiveM fonctionnel est nécessaire. La ressource gratuite orn_lib, requise par les scripts, est ajoutée automatiquement. Vous pouvez essayer les scripts sur notre <a href="/essai">serveur de test</a> avant d’acheter.</p>

        <h2>3. Prix</h2>
        <p>Les prix sont indiqués en euros. {l.vat || ''} Les taxes éventuellement dues selon votre pays sont calculées par Tebex et le <b>prix total</b> est toujours affiché avant que vous ne validiez le paiement. Les promotions sont valables pendant la durée affichée.</p>

        <h2>4. Commande</h2>
        <ol>
          <li>Vous ajoutez les produits au panier.</li>
          <li>Vous vous connectez avec Discord, puis reliez votre compte FiveM (Cfx.re), qui recevra les licences.</li>
          <li>Vous vérifiez le panier et le total, acceptez les présentes CGV et, pour les scripts, demandez leur livraison immédiate (voir l’article 6).</li>
          <li>Vous payez sur la fenêtre sécurisée de Tebex. Le contrat est conclu à la confirmation du paiement ; Tebex vous envoie un reçu par e-mail.</li>
        </ol>

        <h2>5. Livraison</h2>
        <p>Les scripts sont livrés dans votre Keymaster (portal.cfx.re, « Granted assets ») généralement en quelques minutes après le paiement. Sans livraison sous 24 h, contactez-nous : nous réglons le problème ou vous remboursons. Les services sont réalisés dans les délais indiqués au devis.</p>

        <h2>6. Droit de rétractation</h2>
        <p><b>Scripts (contenus numériques)</b> : ils sont fournis immédiatement après le paiement. Conformément à l’article L221-28, 13° du Code de la consommation, en cochant la case prévue avant le paiement, vous demandez expressément cette fourniture immédiate et reconnaissez <b>perdre votre droit de rétractation</b> dès la livraison dans votre Keymaster. Cet accord est enregistré et rappelé dans la confirmation de commande.</p>
        <p><b>Services</b> (sur mesure, bot, abonnement partenaire) : vous disposez de 14 jours à compter de la conclusion du contrat pour vous rétracter, sans motif (article L221-18). Si vous avez demandé que le service commence avant la fin de ce délai, vous paierez la part du service déjà fournie (article L221-25) ; un service entièrement exécuté avant la fin du délai, à votre demande, n’est plus rétractable (article L221-28, 1°).</p>
        <p>Pour vous rétracter, envoyez-nous une déclaration claire ({mail} ou ticket), par exemple avec ce formulaire :</p>
        <blockquote>À l’attention de {v(l.name)}, {v(l.address)}, {l.email || '[e-mail]'} : je vous notifie par la présente ma rétractation du contrat portant sur la prestation de services ci-dessous : […] Commandé le […] Nom : […] Compte Discord : […] Adresse : […] Date : […]</blockquote>
        <p>Le remboursement intervient sous 14 jours, par le moyen de paiement utilisé.</p>

        <h2>7. Garanties légales</h2>
        <p>Vous bénéficiez de la garantie légale de conformité des contenus et services numériques (articles L224-25-12 et suivants du Code de la consommation) : si un script n’est pas conforme à sa description ou ne fonctionne pas dans les conditions annoncées, signalez-le-nous. Nous le mettons en conformité (correction, mise à jour) sans frais et dans un délai raisonnable ; à défaut, vous pouvez obtenir une réduction du prix ou le remboursement. Pour un contenu fourni en une fois, la garantie couvre les défauts qui apparaissent dans les 2 ans suivant la livraison.</p>
        <p>En plus, nous fournissons gratuitement les mises à jour de chaque script acheté tant qu’il est commercialisé, et l’aide à l’installation via les tickets.</p>

        <h2>8. Licence d’utilisation</h2>
        <p>L’achat d’un script vous donne une licence <b>personnelle, non exclusive et non transférable</b>, pour l’utiliser sur les serveurs FiveM liés à votre compte Cfx.re. Les fichiers de configuration et d’ouverture peuvent être modifiés ; le cœur du script reste protégé (escrow Cfx.re).</p>
        <p>Sont interdits : la revente, le partage, la diffusion publique ou privée (« leak »), la tentative de contourner la protection, et la réutilisation du code dans un autre produit. En cas de violation, la licence peut être révoquée sans remboursement, sans préjudice d’éventuelles poursuites.</p>

        <h2>9. Services sur mesure et bots</h2>
        <p>Un devis gratuit précise le prix, le contenu et le délai. Le travail commence à réception d’un acompte de 50 % ; le solde est payé après votre validation sur votre serveur, avant la livraison finale. Les délais sont indicatifs et dépendent de vos retours. Sauf accord écrit contraire, vous recevez une licence d’utilisation : le code source n’est pas fourni et le Vendeur reste propriétaire du code.</p>

        <h2>10. Abonnement « développeur partenaire »</h2>
        <p>L’abonnement est mensuel, payé d’avance via Tebex, et se renouvelle automatiquement chaque mois. Il est <b>sans engagement</b> : vous pouvez le résilier à tout moment depuis le lien de gestion de l’abonnement reçu par e-mail de Tebex, ou en nous le demandant par e-mail ou ticket. La résiliation prend effet à la fin du mois en cours, déjà payé.</p>

        <h2>11. Responsabilité</h2>
        <p>Les scripts dépendent de FiveM, de votre framework et de vos autres ressources, que nous ne contrôlons pas. Notre responsabilité ne couvre pas les dommages causés par une modification du script de votre part, une incompatibilité non annoncée avec une ressource tierce, ni une mise à jour de FiveM ou de Rockstar ; dans ces cas, nous faisons de notre mieux pour vous aider. Rien dans ces CGV ne limite vos droits légaux de consommateur.</p>

        <h2>12. Comptes, Discord et contenus publiés</h2>
        <p>En publiant une idée, un vote, un signalement de bug ou un message sur notre Discord, vous vous engagez à respecter le règlement du serveur et la loi. Nous pouvons retirer un contenu ou suspendre un accès en cas d’abus.</p>

        <h2>13. Données personnelles</h2>
        <p>Voir la <a href="/confidentialite">politique de confidentialité</a>.</p>

        <h2>14. Réclamations, médiation et droit applicable</h2>
        <p>Pour toute réclamation, contactez-nous d’abord ({mail} ou ticket). Si le litige n’est pas résolu, vous pouvez recourir gratuitement au médiateur de la consommation : <b>{v(l.mediator_name)}</b>{l.mediator_url ? <> — <a href={l.mediator_url} target="_blank" rel="noopener">{l.mediator_url.replace(/^https?:\/\//, '')}</a></> : null}.</p>
        <p>Les présentes CGV sont soumises au droit français. En cas de litige, le consommateur peut saisir le tribunal de son lieu de domicile ou celui du Vendeur.</p>
      </div>
    </main>
  );
}
