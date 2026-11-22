# Discord Orion

- `npm run setup` : crée ou met à jour tout le serveur (rôles, catégories, salons, droits, messages, webhook des devis). Relançable sans doublon.
- `npm start` : le bot (règlement, notifications, tickets, logs, et les tâches du site : rôle client, salon unique par client, annonces, patch notes, promos, maintenance). Il lit la même base que le site (`../data/orion.db`).

Le plan du serveur est dans `structure.js`, les textes des messages dans `messages.js`.
Les identifiants créés sont enregistrés dans `config.json` (non versionné, contient l'URL du webhook).

## Installation

```bash
cd /root/orion/discord
cp .env.example .env && nano .env
npm ci
npm run setup
pm2 start npm --name orion-bot -- start && pm2 save
```

## Commandes

- Clients : `/mes-scripts`
- Équipe : `/client info|resync`, `/donner joueur package raison` (package Tebex offert à un pseudo Cfx.re, via l'API Plugin : nécessite `TEBEX_SECRET_KEY` dans le `.env` du site ; **non révocable**)
- Modération : `/ban` `/unban` `/kick` `/mute` `/unmute` `/warn` `/warns` `/unwarn` `/clear` `/slowmode` `/lock` `/unlock` `/userinfo` (3 avertissements = muet 1 h automatiquement). Tout est journalisé dans #modération.
- AutoMod Discord (créé par `npm run setup`) : invitations d'autres serveurs, spam de mentions, spam, insultes et contenu choquant.
