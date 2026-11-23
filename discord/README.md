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

## Tickets intelligents (assistant IA)
- Chaque ticket affiche une **fiche client** (scripts achetés, commandes, partenariat, avertissements).
- Avec `ANTHROPIC_API_KEY` dans `.env`, l’**Assistant Orion (IA)** répond au client à partir de la doc, du catalogue et de ses achats.
  - **✅ C’est résolu** : transcript puis fermeture.
  - **🙋 Parler à l’équipe**, demande hors doc (remboursement, devis…), panne de l’IA ou 6 réponses sans solution : salon renommé `🔴・…`, rôles Support/Modo/Dev pingés, l’IA se tait.
  - Dès qu’un membre du staff écrit ou clique **Prendre en charge** : salon renommé `🟢・…`.
- Relance du client après 24 h sans réponse, fermeture automatique après 48 h.
- ⚠️ Active **Message Content Intent** (portail Discord → Bot) sinon le bot ne lit pas les messages.
