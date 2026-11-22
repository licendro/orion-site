// Contenu enrichi des scripts : ce que Tebex ne stocke pas (image du site, points forts, version…).
// En mode Tebex, chaque package est relié à une entrée par son nom (ex. « orn_bank »).
// Sans clé Tebex, ces entrées servent de catalogue de démonstration (prix "demoPrice").
// orn_lib n'est PAS un produit : c'est la dépendance livrée avec chaque script, il n'apparaît jamais en boutique.

export const DEMO_CATEGORIES = [
  { id: 2, name: 'Véhicules' },
  { id: 3, name: 'Économie' },
  { id: 4, name: 'Police' },
  { id: 5, name: 'Illégal' },
  { id: 6, name: 'Vie civile' },
  { id: 7, name: 'Interface' },
  { id: 8, name: 'Packs' },
];

export const CONTENT = [
  {
    name: 'orn_garage', cat: 2, demoPrice: 14.99, ver: '1.4.2', pop: 95, img: '/img/garage.jpg', featured: true,
    desc: 'Garages publics et privés, fourrière, partage de clés et véhicules de société.',
    feat: ['Garages illimités configurables', 'Fourrière avec tarif par véhicule', 'Véhicules de service par job et grade', 'Partage de clés entre joueurs'],
  },
  {
    name: 'orn_bank', cat: 3, demoPrice: 19.99, ver: '2.0.1', pop: 92, img: '/img/banque.jpg',
    desc: 'Maze Bank complète : comptes, distributeurs, virements et factures.',
    feat: ['Écran banque plein écran', 'Distributeurs avec retrait et dépôt', 'Factures entre joueurs et sociétés', 'Historique des opérations'],
  },
  {
    name: 'orn_police', cat: 4, demoPrice: 24.99, ver: '1.0.4', pop: 90, isNew: true, img: '/img/ciblage.jpg',
    desc: 'Fouille, menottes, escorte, amendes, casier et tablette de recherche.',
    feat: ['Ciblage : fouiller, menotter, escorter', 'Amendes et casier judiciaire', 'Tablette de recherche', "Saisies d'objets et de véhicules"],
  },
  {
    name: 'orn_braquages', cat: 5, demoPrice: 19.99, ver: '1.2.3', pop: 88, img: '/img/interactions.jpg',
    desc: 'Supérettes, Fleeca et bijouterie, avec mini-jeux, minuteur et alerte police.',
    feat: ['Trois types de braquages', 'Mini-jeux de piratage et crochetage', 'Minuteur et alerte dispatch', 'Nombre de policiers minimum'],
  },
  {
    name: 'orn_hud', cat: 7, demoPrice: 9.99, ver: '1.5.0', pop: 86, img: '/img/hud.jpg',
    desc: 'Jauges, compteur de vitesse, ceinture et carburant.',
    feat: ['Compteur de vitesse et rapport', 'Jauges santé, armure, faim, soif', 'Alerte ceinture et carburant', 'Positions réglables par le joueur'],
  },
  {
    name: 'orn_shop', cat: 3, demoPrice: 12.99, ver: '1.2.0', pop: 84, img: '/img/boutique.jpg',
    desc: 'Supérettes et boutiques avec panier, stock et paiement espèces ou carte.',
    feat: ['Boutiques illimitées par configuration', 'Stock et rupture par article', 'Paiement espèces ou carte', 'Gérance possible par un joueur'],
  },
  {
    name: 'orn_mecano', cat: 2, demoPrice: 17.99, ver: '1.3.0', pop: 81, img: '/img/customs.jpg',
    desc: 'Réparations, customs et factures pour les mécaniciens.',
    feat: ['Menu customs avec aperçu en direct', 'Réparation par étapes avec animation', 'Factures envoyées au client', 'Stock de pièces de la société'],
  },
  {
    name: 'orn_concession', cat: 2, demoPrice: 16.99, ver: '1.1.1', pop: 74, img: '/img/banque-lib.jpg',
    desc: 'Vitrine, essai routier, financement et vente par les vendeurs.',
    feat: ['Vitrine avec aperçu', 'Essai routier chronométré', 'Paiement comptant ou en plusieurs fois', 'Commission des vendeurs'],
  },
  {
    name: 'orn_metiers', cat: 6, demoPrice: 14.99, ver: '1.0.2', pop: 72, isNew: true, img: '/img/notifications.jpg',
    desc: 'Livreur, éboueur et taxi : tournées, objectifs et salaires.',
    feat: ['Tournées générées au hasard', "Suivi d'objectifs à l'écran", 'Salaire par mission', 'Classement des employés'],
  },
  {
    name: 'orn_dispatch', cat: 4, demoPrice: 9.99, ver: '1.1.0', pop: 70, img: '/img/notifications.jpg', pos: '100% 0',
    desc: "Alertes police et secours, avec blips, codes et prise d'appel.",
    feat: ['Alertes automatiques (tirs, braquages)', "Prise d'appel et itinéraire", 'Codes 10 configurables', 'Compatible avec nos braquages'],
  },
  {
    name: 'orn_immo', cat: 3, demoPrice: 22.99, ver: '1.0.0', pop: 66, isNew: true, img: '/img/fenetres.jpg',
    desc: 'Agence immobilière : visites, ventes, locations et loyers prélevés.',
    feat: ['Visites guidées des biens', 'Contrats de vente et de location', 'Loyers prélevés automatiquement', 'Gestion par les agents'],
  },
  {
    // Un pack = un package Tebex normal, avec ici la liste des scripts qu'il contient.
    name: 'Pack Ville', cat: 8, demoPrice: 59.99, ver: '1.0.0', pop: 0, img: '/img/garage.jpg',
    desc: "Les cinq scripts qui font tourner l'économie d'une ville.",
    bundle: ['orn_garage', 'orn_bank', 'orn_shop', 'orn_mecano', 'orn_hud'],
    feat: ['orn_garage', 'orn_bank', 'orn_shop', 'orn_mecano', 'orn_hud'],
  },
];
