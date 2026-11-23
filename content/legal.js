// Version des CGV : à changer quand le texte change (l'acceptation enregistrée au paiement porte ce numéro).
export const CGV_VERSION = '2026-11-23';
export const PRIVACY_UPDATED = '23 novembre 2026';

// Informations légales, modifiables dans Admin → Infos légales (repli sur le .env).
export const LEGAL_FIELDS = [
  ['name', 'Nom de l’éditeur', 'Ton nom et prénom (entrepreneur individuel) ou le nom de ta société', true, 'LEGAL_NAME'],
  ['brand', 'Nom commercial', 'ex. Orion Scripts', false, 'LEGAL_BRAND'],
  ['status', 'Statut', 'ex. Entrepreneur individuel (micro-entreprise)', true, 'LEGAL_STATUS'],
  ['siret', 'SIRET', '14 chiffres, sur ton avis de situation INSEE', true, 'LEGAL_SIRET'],
  ['registry', 'Immatriculation', 'ex. RNE / RCS de … (laisser vide si non concerné)', false, 'LEGAL_REGISTRY'],
  ['address', 'Adresse', 'Adresse postale de l’éditeur (ou de domiciliation)', true, 'LEGAL_ADDRESS'],
  ['email', 'E-mail de contact', 'Adresse qui répond vraiment', true, 'LEGAL_EMAIL'],
  ['phone', 'Téléphone', 'Obligatoire pour un professionnel', true, 'LEGAL_PHONE'],
  ['director', 'Directeur de la publication', 'En général toi', true, 'LEGAL_DIRECTOR'],
  ['vat', 'Mention TVA', 'Micro-entreprise : « TVA non applicable, art. 293 B du CGI »', true, 'LEGAL_VAT'],
  ['host_name', 'Hébergeur : nom', 'La société de ton VPS (ex. OVH SAS, Hetzner Online GmbH…)', true, 'HOST_NAME'],
  ['host_address', 'Hébergeur : adresse', 'Sur le site de ton hébergeur', true, 'HOST_ADDRESS'],
  ['host_phone', 'Hébergeur : téléphone', '', false, 'HOST_PHONE'],
  ['mediator_name', 'Médiateur de la consommation', 'Obligatoire pour vendre à des particuliers (ex. CM2C, Medicys…)', true, 'MEDIATOR_NAME'],
  ['mediator_url', 'Médiateur : site web', 'Lien où le client peut le saisir', true, 'MEDIATOR_URL'],
  ['mediator_address', 'Médiateur : adresse', '', false, 'MEDIATOR_ADDRESS'],
];
