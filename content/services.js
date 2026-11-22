// Offres de services et grilles tarifaires (page /services).
// Pour chaque offre : les lignes (features) et les paliers. Dans un palier, une ligne vaut :
//   true  → cochée      false → non incluse      'texte' → valeur affichée (ex. '24 h')

export const OFFERS = [
  {
    id: 'bot',
    label: 'Bot Discord',
    title: 'Le bot de votre serveur, prêt à l’emploi.',
    sub: 'Installé et configuré sur votre Discord, à vos couleurs. Vous choisissez la formule selon ce dont votre communauté a besoin.',
    quote: 'bot',
    features: [
      ['tickets', 'Tickets de support'],
      ['rules', 'Règlement et rôle automatique'],
      ['status', 'Statut du serveur et joueurs en ligne'],
      ['logs', 'Logs d’arrivées, départs et modération'],
      ['apply', 'Candidatures (staff, whitelist, métiers)'],
      ['whitelist', 'Whitelist liée au serveur FiveM'],
      ['mod', 'Modération : ban, mute, avertissements, anti-spam'],
      ['announce', 'Annonces en embed depuis un formulaire'],
      ['shop', 'Liaison boutique Tebex (rôle client automatique)'],
      ['custom', 'Commandes sur mesure'],
      ['hosting', 'Hébergement 24 h/24'],
      ['support', 'Corrections après livraison'],
    ],
    tiers: [
      { name: 'Essentiel', price: '25 €', note: 'paiement unique', features: { tickets: true, rules: true, status: true, logs: true, apply: false, whitelist: false, mod: false, announce: false, shop: false, custom: false, hosting: false, support: '15 jours' } },
      { name: 'Avancé', price: '45 €', note: 'paiement unique', highlight: true, features: { tickets: true, rules: true, status: true, logs: true, apply: true, whitelist: true, mod: true, announce: true, shop: false, custom: false, hosting: '1 mois offert', support: '30 jours' } },
      { name: 'Complet', price: '79 €', note: 'paiement unique', features: { tickets: true, rules: true, status: true, logs: true, apply: true, whitelist: true, mod: true, announce: true, shop: true, custom: 'Illimitées', hosting: '3 mois offerts', support: '60 jours' } },
    ],
  },
  {
    id: 'partenariat',
    label: 'Développeur partenaire',
    title: 'Un développeur attitré pour votre serveur.',
    sub: 'On rejoint votre équipe comme développeurs : corrections, nouveaux scripts, optimisation. Formule au mois, ajustable ou résiliable chaque mois.',
    quote: 'partenariat',
    features: [
      ['bugs', 'Corrections de bugs'],
      ['reply', 'Délai de réponse'],
      ['edits', 'Modifications de scripts existants'],
      ['new', 'Nouveaux scripts sur mesure'],
      ['discount', 'Réduction sur notre catalogue'],
      ['optim', 'Optimisation (resmon, SQL)'],
      ['audit', 'Audit de sécurité (backdoors, events)'],
      ['access', 'Accès développeur à votre serveur'],
      ['bot', 'Bot Discord inclus'],
      ['meeting', 'Point mensuel avec votre staff'],
    ],
    tiers: [
      { name: 'Starter', price: '20 €', note: '/ mois', features: { bugs: true, reply: '72 h', edits: false, new: false, discount: '−10 %', optim: false, audit: false, access: false, bot: false, meeting: false } },
      { name: 'Serveur', price: '50 €', note: '/ mois', features: { bugs: true, reply: '48 h', edits: true, new: false, discount: '−20 %', optim: true, audit: false, access: true, bot: false, meeting: false } },
      { name: 'Pro', price: '100 €', note: '/ mois', highlight: true, features: { bugs: true, reply: '24 h', edits: true, new: '1 par mois', discount: '−30 %', optim: true, audit: true, access: true, bot: 'Essentiel', meeting: false } },
      { name: 'Premium', price: '200 €', note: '/ mois', features: { bugs: true, reply: 'Prioritaire', edits: true, new: '3 par mois', discount: '−40 %', optim: true, audit: true, access: true, bot: 'Complet', meeting: true } },
    ],
  },
  {
    id: 'sur-mesure',
    label: 'Script sur mesure',
    title: 'Le script qu’il manque à votre serveur.',
    sub: 'Développé pour vous, dans le style Orion, compatible avec votre framework. Livré protégé (escrow Cfx.re) avec sa configuration ouverte. Le prix dépend de la taille du script ; le devis est gratuit.',
    quote: 'sur-mesure',
    features: [
      ['spec', 'Cahier des charges validé ensemble'],
      ['fw', 'ESX, QBCore ou QBox'],
      ['ui', 'Menus et interactions dans le style Orion'],
      ['nui', 'Interface NUI sur mesure'],
      ['sql', 'Base de données (SQL)'],
      ['config', 'Configuration ouverte'],
      ['delay', 'Délai de livraison'],
      ['fix', 'Corrections gratuites'],
      ['updates', 'Mises à jour de compatibilité'],
      ['source', 'Code source livré (sur exception uniquement)'],
    ],
    tiers: [
      { name: 'Simple', price: '20 €', note: 'à partir de', features: { spec: true, fw: true, ui: true, nui: false, sql: false, config: true, delay: '3 à 5 jours', fix: '15 jours', updates: false, source: false } },
      { name: 'Standard', price: '50 €', note: 'à partir de', highlight: true, features: { spec: true, fw: true, ui: true, nui: false, sql: true, config: true, delay: '1 à 2 semaines', fix: '30 jours', updates: false, source: false } },
      { name: 'Avancé', price: '100 €', note: 'à partir de', features: { spec: true, fw: true, ui: true, nui: true, sql: true, config: true, delay: '1 à 2 semaines', fix: '60 jours', updates: '3 mois', source: false } },
    ],
  },
];

export const A_LA_CARTE = [
  ['Adaptation de framework', 'dès 25 €', "Passer un script d'ESX à QBCore ou QBox, et inversement."],
  ['Correction de bug', 'dès 15 €', 'Erreur console, script qui ne démarre pas, conflit entre ressources.'],
  ['Optimisation', 'dès 30 €', 'Baisse du resmon, boucles et requêtes SQL trop lourdes.'],
  ['Audit de sécurité', 'dès 35 €', "Recherche de backdoors, d'events exploitables et de triggers non protégés."],
  ['Interface NUI sur mesure', 'dès 79 €', 'Menu, tablette ou écran complet dans le style de votre serveur.'],
  ['Serveur clé en main', 'sur devis', 'Installation txAdmin, framework, base de données, suite ox et scripts configurés.'],
  ['Site boutique relié à Tebex', 'dès 199 €', 'Votre propre site, produits Tebex affichés, paiement sans quitter la page.'],
  ['Système complet', 'sur devis', 'Métier, économie, gouvernement, braquages : un ensemble de scripts pensé ensemble.'],
];
