// Guides de la documentation, chargés en base au premier lancement (ensuite modifiables dans Admin → Documentation).
// Les pages « Scripts » sont générées automatiquement pour chaque script tant qu'aucune page dédiée n'existe.

export const DOC_CATEGORIES = ['Démarrer', 'Achats et licences', 'Installation', 'Discord et support', 'Services', 'Scripts'];

export const SEED_DOCS = [
  {
    slug: 'demarrage-rapide', category: 'Démarrer', sort: 1, title: 'Démarrage rapide',
    summary: 'De l’achat au script qui tourne sur votre serveur, en 5 étapes.',
    body: `Bienvenue dans la documentation Orion. Voici le chemin le plus court pour faire tourner un script.

## 1. Connectez vos comptes
Sur le site, connectez-vous avec **Discord** (pour recevoir le rôle Client et votre salon privé), puis reliez votre **compte FiveM (Cfx.re)** dans le panier. C’est sur ce compte que les scripts sont livrés.

## 2. Achetez
Ajoutez le script au panier : **orn_lib**, gratuite et obligatoire, s’ajoute automatiquement. Le paiement se fait par Tebex sans quitter le site.

## 3. Téléchargez
Ouvrez [votre Keymaster](https://portal.cfx.re/assets/granted-assets), rubrique **Granted assets**, et téléchargez le script et orn_lib.

## 4. Installez
Placez les dossiers dans \`resources/[orion]/\`, puis dans le \`server.cfg\` :

\`\`\`cfg
ensure orn_lib
ensure orn_bank
\`\`\`

## 5. Configurez
Ouvrez le \`config.lua\` du script, réglez-le, redémarrez le serveur. C’est prêt.

> Un souci ? Consultez [Dépannage](/docs/depannage) ou ouvrez un ticket sur notre Discord.`,
  },
  {
    slug: 'acheter', category: 'Achats et licences', sort: 10, title: 'Acheter un script',
    summary: 'Connexion Discord et FiveM, paiement, livraison et suivi de vos achats.',
    body: `## Pourquoi deux connexions ?
- **Discord** : relie l’achat à votre compte Discord. Vous recevez automatiquement le rôle **Client Orion** et un **salon privé** listant vos scripts.
- **FiveM (Cfx.re)** : nos scripts sont protégés par l’escrow Cfx.re. La licence est attribuée au compte FiveM connecté, celui qui pourra faire tourner le script.

## Le paiement
Le paiement est traité par **Tebex**, revendeur officiel. La fenêtre s’ouvre directement sur le site : carte bancaire, PayPal et les autres moyens proposés par Tebex selon votre pays.

## Après le paiement
- Le script apparaît dans votre [Keymaster](https://portal.cfx.re/assets/granted-assets) en quelques minutes.
- Sur Discord : rôle Client + salon privé (créé une seule fois, puis mis à jour à chaque achat).
- Sur le site : la page [Mon compte](/compte) liste vos scripts et vos commandes.

## Codes promo et codes créateur
- **Code promo** : à saisir dans le panier, la réduction est appliquée par Tebex au paiement.
- **Code créateur** : soutient un créateur ou un serveur partenaire. Si vous arrivez par son lien, il est appliqué tout seul.`,
  },
  {
    slug: 'licence-keymaster', category: 'Achats et licences', sort: 11, title: 'Licence et Keymaster',
    summary: 'Où trouver vos scripts, sur quel serveur ils fonctionnent, et ce qui est interdit.',
    body: `## Où sont mes scripts ?
Dans le [Keymaster Cfx.re](https://portal.cfx.re/assets/granted-assets), rubrique **Granted assets**, sur le compte FiveM utilisé au moment de l’achat.

## Sur quel serveur ils fonctionnent
Un script protégé fonctionne sur les serveurs dont la **clé de licence** (\`sv_licenseKey\`) a été créée sur **le même compte Cfx.re** que celui qui a reçu le script. Si votre serveur utilise la clé d’un autre compte, le script refusera de démarrer.

## Ce qui est autorisé
- Modifier la configuration, les textes et les fichiers ouverts (\`config.lua\`, \`client/open.lua\`, \`server/open.lua\`, fichiers de langue).
- Utiliser le script sur vos serveurs, sans limite de durée.

## Ce qui est interdit
- Revendre, partager ou publier le script, même modifié.
- Contourner la protection.

Toute fuite entraîne la révocation de la licence et un bannissement de nos services.

## Remboursements
Les scripts étant livrés immédiatement, ils ne sont pas remboursables une fois téléchargés. En cas de problème, ouvrez un ticket : on le règle avec vous.`,
  },
  {
    slug: 'installation', category: 'Installation', sort: 20, title: 'Installer un script',
    summary: 'Ordre de démarrage, base de données, et vérification au premier lancement.',
    body: `## Pré-requis
- Un serveur FiveM à jour (artifacts récents) avec **ESX Legacy, QBCore ou QBox**.
- **oxmysql** si le script utilise une base de données.
- **orn_lib**, gratuite, livrée avec votre premier achat.

## Étapes
1. Téléchargez le script et orn_lib depuis le Keymaster.
2. Décompressez-les dans \`resources/[orion]/\` **sans renommer les dossiers** (le nom est lié à la licence).
3. Si le script contient un fichier \`.sql\`, importez-le dans votre base de données.
4. Dans le \`server.cfg\`, démarrez votre framework, puis orn_lib, puis nos scripts :

\`\`\`cfg
ensure oxmysql
ensure es_extended      # ou qb-core / qbx_core
ensure ox_inventory     # votre inventaire
ensure orn_lib
ensure orn_bank
ensure orn_garage
\`\`\`

5. Redémarrez le serveur (pas seulement \`refresh\`).

## Vérifier
Au démarrage, la console affiche une ligne Orion avec le framework et l’inventaire détectés. Si quelque chose manque, voir [Dépannage](/docs/depannage).`,
  },
  {
    slug: 'orn-lib', category: 'Installation', sort: 21, title: 'orn_lib',
    summary: 'Le package gratuit et obligatoire dont dépendent tous nos scripts.',
    body: `**orn_lib** est un package **gratuit et obligatoire** : tous nos scripts en ont besoin pour fonctionner.

## L’obtenir
Elle est ajoutée automatiquement et gratuitement au panier avec votre premier script. Vous la retrouvez ensuite dans votre Keymaster.

## L’installer
Démarrez-la **après votre framework et avant nos scripts** :

\`\`\`cfg
ensure orn_lib
ensure orn_bank
\`\`\`

## La mettre à jour
Gardez toujours la dernière version : nos scripts récents peuvent en avoir besoin. Les mises à jour sont annoncées dans **#patch-notes** sur Discord.`,
  },
  {
    slug: 'compatibilite', category: 'Installation', sort: 22, title: 'Compatibilité',
    summary: 'Frameworks, inventaires et ressources reconnus automatiquement.',
    body: `Nos scripts détectent automatiquement ce qui tourne sur votre serveur. Rien à configurer dans la plupart des cas.

| Type | Reconnus |
|---|---|
| Framework | ESX Legacy, QBCore, QBox |
| Inventaire | ox_inventory, qs-inventory, qb-inventory |
| Ciblage | ox_target, qb-target (ou celui d’Orion) |
| Téléphone | lb-phone, qs-smartphone |
| Dispatch | ps-dispatch, cd_dispatch |
| Vêtements | illenium-appearance |
| Carburant | ox_fuel, LegacyFuel |

Votre ressource n’est pas dans la liste ? Ouvrez un ticket « Question avant achat » : on vous dit si c’est compatible, ou on l’ajoute.`,
  },
  {
    slug: 'configuration', category: 'Installation', sort: 23, title: 'Configurer un script',
    summary: 'config.lua, fichiers ouverts et traductions.',
    body: `## config.lua
Chaque script a un \`config.lua\` commenté : positions, prix, jobs autorisés, touches, options. Modifiez-le puis redémarrez la ressource.

## Fichiers ouverts
Les fichiers \`client/open.lua\` et \`server/open.lua\` restent lisibles et modifiables : ils servent à brancher vos propres systèmes (notifications, factures, logs…).

## Langues
Les textes sont dans \`locales/\`. Dupliquez \`fr.lua\` pour créer une autre langue, puis choisissez-la dans la configuration.

## Bonnes pratiques
- Gardez une copie de votre \`config.lua\` avant chaque mise à jour.
- Ne renommez jamais le dossier d’un script protégé.`,
  },
  {
    slug: 'mises-a-jour', category: 'Installation', sort: 24, title: 'Mettre à jour',
    summary: 'Être prévenu, télécharger la nouvelle version et garder sa configuration.',
    body: `## Être prévenu
- **#patch-notes** sur Discord (prenez le rôle 🔔 Patch notes dans #rôles).
- Votre **salon privé** client : chaque mise à jour d’un script que vous possédez y est annoncée.
- L’**historique des versions** sur la fiche de chaque script.

## Mettre à jour
1. Sauvegardez votre \`config.lua\` (et vos fichiers ouverts modifiés).
2. Téléchargez la nouvelle version dans le Keymaster.
3. Remplacez le dossier, remettez votre configuration.
4. Mettez aussi orn_lib à jour si la note de version le demande.
5. Redémarrez le serveur.

Les mises à jour sont **incluses à vie**.`,
  },
  {
    slug: 'depannage', category: 'Installation', sort: 25, title: 'Dépannage',
    summary: 'Les erreurs les plus fréquentes et comment les corriger.',
    body: `## « You lack the required entitlement »
Le script n’est pas lié au compte de votre serveur. Vérifiez que la clé \`sv_licenseKey\` de votre serveur a été créée sur **le même compte Cfx.re** que celui qui a acheté le script.

## Le script ne démarre pas / « orn_lib introuvable »
- orn_lib est-elle installée et démarrée **avant** le script ?
- Le dossier a-t-il été renommé ? Remettez son nom d’origine.

## Framework ou inventaire non détecté
Vérifiez l’ordre dans le \`server.cfg\` : framework et inventaire doivent démarrer **avant** orn_lib.

## Erreur SQL
Importez le fichier \`.sql\` fourni et vérifiez qu’oxmysql est à jour.

## Toujours bloqué ?
Ouvrez un ticket **Support** sur Discord avec : le nom et la version du script, votre framework, et l’erreur complète (console serveur ou F8).`,
  },
  {
    slug: 'support', category: 'Discord et support', sort: 30, title: 'Obtenir de l’aide',
    summary: 'Tickets, assistant IA, équipe et délais de réponse.',
    body: `## Ouvrir un ticket
Sur notre Discord, salon **#ouvrir-un-ticket**, choisissez le type de demande. Un salon privé s’ouvre avec vous.

- **Support** et **Bug** : réservés aux clients, traités en priorité.
- **Question avant achat**, **Partenariat**, **Sur mesure**, **Autre** : ouverts à tous.

## L’assistant Orion
Un assistant IA répond tout de suite, avec la documentation et la liste de vos scripts. Si sa réponse vous suffit, cliquez **Résolu**. Sinon, **Parler à l’équipe** : le ticket passe à un membre du staff, qui reprend la conversation.

## Délais
L’équipe répond en général dans la journée. Les tickets sans réponse de votre part pendant 48 h sont fermés automatiquement (après un rappel).

## Pour aller plus vite
Donnez dès le départ : le script et sa version, votre framework, l’erreur complète et ce que vous avez déjà essayé.`,
  },
  {
    slug: 'discord', category: 'Discord et support', sort: 31, title: 'Notre Discord',
    summary: 'Rôles, salon client, notifications et commandes.',
    body: `## Accéder au serveur
Acceptez le règlement dans **#règlement** pour obtenir le rôle Membre.

## Rôle Client et salon privé
Après un achat (connecté avec Discord sur le site), vous recevez le rôle **💎 Client Orion** et un salon **📦 votre-pseudo**, visible seulement par vous et l’équipe. Il liste vos scripts et reçoit leurs mises à jour.

## Notifications
Dans **#rôles**, choisissez ce qui vous intéresse : nouveaux scripts, patch notes, teasers, promos.

## Commandes
- \`/mes-scripts\` : la liste de vos scripts, visible par vous seul.`,
  },
  {
    slug: 'services', category: 'Services', sort: 40, title: 'Services et partenariats',
    summary: 'Bot Discord, développeur partenaire par abonnement, scripts sur mesure.',
    body: `Retrouvez toutes les formules et leurs tarifs sur la [page Services](/services).

## Développeur partenaire (abonnement)
L’abonnement se prend directement sur la page Services et se renouvelle chaque mois via Tebex. Vous recevez le rôle **🤝 Partenaire** sur notre Discord, et l’équipe vous contacte pour l’accès à votre serveur. Résiliable à tout moment depuis votre compte Tebex.

## Script sur mesure et bot Discord
Demandez un devis gratuit sur la page Services ou en ticket. Acompte de 50 %, test sur votre serveur, puis livraison. Les scripts sont livrés protégés (escrow) avec leur configuration ouverte ; le code source n’est fourni que sur exception.`,
  },
  {
    slug: 'serveur-de-test', category: 'Services', sort: 41, title: 'Serveur de test',
    summary: 'Essayer nos scripts avant d’acheter, sur notre serveur.',
    body: `Notre serveur de test permet d’essayer les scripts en conditions réelles avant d’acheter.

## Réserver un créneau
Les places sont limitées : réservez un créneau sur la page [Essayer nos scripts](/essai), connecté avec Discord. Quand c’est votre tour, le bouton **Se connecter au serveur** apparaît.

## Pendant le créneau
Votre accès dure le temps indiqué sur la page. À la fin, la place est libérée pour la personne suivante.`,
  },
];
