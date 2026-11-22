# Discord Orion

- `npm run setup` : crée ou met à jour tout le serveur (rôles, catégories, salons, droits, messages, webhook des devis). Relançable sans doublon.
- `npm start` : le bot (validation du règlement, rôles de notification, tickets, logs d'arrivées et de départs).

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
