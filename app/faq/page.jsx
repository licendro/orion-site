export const metadata = { title: 'FAQ', description: 'Livraison, compatibilité, licences, remboursement, données : les réponses aux questions fréquentes.' };

export default function Faq() {
  return (
    <main>
      <section className="band" style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
        <div className="wrap faq">
          <div><span className="label"><i></i>FAQ</span><h2>Questions fréquentes.</h2><p className="sub">Une autre question ? Consultez <a href="/docs">la documentation</a> ou notre Discord, qui répond en général dans la journée.</p></div>
          <div>
            <details open><summary>Comment je reçois mes scripts ?</summary><p>Après le paiement, ils apparaissent dans votre Keymaster sur portal.cfx.re, liés au compte FiveM utilisé à la connexion, dans la section « Granted assets ».</p></details>
            <details><summary>Pourquoi se connecter avec FiveM ?</summary><p>Les scripts sont protégés par l'escrow Cfx.re. La connexion relie l'achat à votre compte, sans quoi la licence ne peut pas être attribuée.</p></details>
            <details><summary>Quels frameworks sont compatibles ?</summary><p>ESX Legacy, QBCore et QBox, détectés automatiquement. Inventaires : ox_inventory, qs-inventory, qb-inventory.</p></details>
            <details><summary>Comment marche un partenariat ?</summary><p>On fixe ensemble une formule entre 20 et 200 € par mois selon la taille du serveur et ce dont vous avez besoin. Vous pouvez l'ajuster ou l'arrêter chaque mois.</p></details>
            <details><summary>Comment se passe une commande sur mesure ?</summary><p>Devis gratuit sous 24 h, acompte de 50 %, test sur votre serveur, puis solde et livraison. Les corrections sont ensuite gratuites selon la formule. Le script est livré protégé avec sa configuration ouverte ; le code source n'est fourni que sur exception.</p></details>
            <details><summary>Puis-je être remboursé ?</summary><p>Les scripts sont des contenus numériques livrés immédiatement : en validant la commande, vous demandez cet accès immédiat et renoncez au droit de rétractation (article L221-28 du Code de la consommation). En cas de script défectueux ou non conforme, vous restez couvert par la garantie légale de conformité : contactez-nous sur Discord. Détails dans les <a href="/cgv">CGV</a>.</p></details>
            <details><summary>Quelles données gardez-vous sur moi ?</summary><p>Votre identifiant, pseudo et avatar Discord, votre pseudo Cfx.re et vos achats, uniquement pour livrer et suivre vos scripts. Vous pouvez tout télécharger ou supprimer depuis <a href="/compte">Mon compte</a>. Détails dans la <a href="/confidentialite">politique de confidentialité</a>.</p></details>
            <details><summary>Je peux modifier le code ?</summary><p>La configuration, les textes et les fichiers d'ouverture (client/open.lua, server/open.lua) sont modifiables. Le cœur du script reste protégé.</p></details>
          </div>
        </div>
      </section>
    </main>
  );
}
