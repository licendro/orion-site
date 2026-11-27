// Réponses toutes faites créées au premier lancement (modifiables dans Admin → Support).
// Variables : {client} (mention du client), {equipe} (ton pseudo), {site}
export const DEFAULT_MACROS = [
  ['infos', '🔎 Il me faut plus d’infos', 'Salut {client} ! Pour t’aider vite, envoie-moi :\n1. Le **script** et sa **version**\n2. Ton **framework** (ESX, QBCore, QBox) et ton inventaire\n3. Une **capture** de l’erreur en F8 et dans la console serveur\n4. Ce que tu faisais quand c’est arrivé'],
  ['installation', '📦 Installation', 'Pour installer correctement :\n1. Télécharge la dernière version dans ton **Keymaster** (portal.cfx.re → Granted assets)\n2. Mets le dossier dans `resources/`\n3. Dans `server.cfg` : `ensure orn_lib` **avant** `ensure` du script\n4. Redémarre complètement le serveur (pas juste `refresh`)\nGuide complet : {site}/docs/installation'],
  ['escrow', '🔑 Erreur de licence (escrow)', 'Cette erreur veut dire que le serveur n’utilise pas la licence du compte Cfx.re qui a acheté le script.\n1. Va sur portal.cfx.re avec le compte qui a acheté\n2. Vérifie que la **clé de licence de ton serveur** (`sv_licenseKey`) vient de ce compte\n3. Redémarre le serveur\nDétails : {site}/docs/licence-keymaster'],
  ['mise-a-jour', '⬆️ Mettre à jour', 'Une nouvelle version est dispo :\n1. Télécharge-la dans ton Keymaster\n2. Sauvegarde ton `config.lua`\n3. Remplace le dossier, remets ta config\n4. Redémarre le serveur\nNouveautés : {site}/changelog'],
  ['attente', '⏳ On s’en occupe', 'Merci {client}, c’est bien noté. Je regarde ça et je reviens vers toi ici dès que possible.'],
  ['resolu', '✅ Résolu ?', 'Est-ce que c’est réglé de ton côté {client} ? Si oui, tu peux fermer le ticket avec le bouton 🔒. Sinon dis-moi ce qui coince encore.'],
];
