# API de licences Orion

Service séparé du site, très léger (Fastify + SQLite en mode WAL, ~40 Mo de RAM) :

- crée une licence à chaque achat Tebex, la **révoque** en cas de remboursement ou de litige perdu, la **suspend** pendant un litige ;
- répond aux serveurs FiveM (`POST /v1/verify`) avec une **réponse signée Ed25519** et horodatée, impossible à falsifier ;
- lie chaque licence à l'IP du serveur (lue côté API, jamais envoyée par le client), changeable par le client 1 fois tous les 7 jours ;
- limite le débit (par IP et par clé) et alerte sur Discord si une clé est utilisée depuis plus de 2 IP en 24 h ;
- sert le changelog (`GET /v1/changelog`, `GET /v1/changelog/:script`) lu par le site ;
- garde les IP des journaux 30 jours (RGPD), sauvegarde la base chaque nuit (14 jours).

## Installation sur le VPS (une seule fois)

Toutes les commandes se tapent sur le VPS, en root.

### 1. Swap de 2 Go (si absent)

```bash
cd /root/orion/licence-api
bash scripts/setup-swap.sh
```

### 2. Dépendances et clés

```bash
cd /root/orion/licence-api
npm ci --omit=dev
cp .env.example .env
npm run keygen          # affiche SIGNING_KEY (privée) et la clé publique
openssl rand -hex 32    # affiche un jeton pour ADMIN_TOKEN
nano .env
```

Dans `.env`, remplis :

- `SIGNING_KEY` : la clé privée affichée par `npm run keygen`. **Garde-en une copie en lieu sûr**, ne la partage jamais.
- `ADMIN_TOKEN` : le jeton `openssl`.
- `TEBEX_WEBHOOK_SECRET` : le même que dans le `.env` du site.
- `DISCORD_ALERT_WEBHOOK` : l'URL du webhook du salon #alertes (Discord → paramètres du salon → Intégrations → Webhooks), ou laisse vide.

Puis dans le `.env` **du site** (`/root/orion/.env`), ajoute :

```bash
LICENCE_API_URL=http://127.0.0.1:3020
LICENCE_ADMIN_TOKEN=le_même_jeton_que_ADMIN_TOKEN
```

### 3. Démarrage avec pm2

```bash
cd /root/orion/licence-api
mkdir -p logs data backups
pm2 start ecosystem.config.cjs     # nom : orion-api, port 3020, redémarre au-delà de 150 Mo
pm2 save
curl -s http://127.0.0.1:3020/v1/health
```

Ensuite, `./deploy.sh` (à la racine) met à jour le site, le bot **et** l'API, et installe la sauvegarde nocturne.

### 4. Sous-domaine api.jdev-hub.fr

1. Chez IONOS (Domaines → jdev-hub.fr → DNS), ajoute un enregistrement **A** : `api` → l'IP de ton VPS. Attends quelques minutes.
2. Nginx et HTTPS :

```bash
cp /root/orion/licence-api/deploy/api.jdev-hub.fr.conf /etc/nginx/sites-available/api.jdev-hub.fr
ln -s /etc/nginx/sites-available/api.jdev-hub.fr /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d api.jdev-hub.fr
curl -s https://api.jdev-hub.fr/v1/health
```

La partie `/v1/admin/` est bloquée par Nginx : seul le site (même machine) y accède.

### 5. Sauvegarde nocturne

Installée par `./deploy.sh`. Pour la lancer à la main :

```bash
cd /root/orion/licence-api && node scripts/backup.js && ls backups/
```

Elle copie `data/licences.db` et la base du site (`SITE_DB_PATH`) dans `backups/`, et supprime ce qui a plus de 14 jours. Pense à copier de temps en temps ce dossier hors du VPS.

### 6. Premier paramétrage (sur le site)

1. **Admin → Licences → Scripts** : ajoute chaque script avec son nom de ressource (`orn_garage`), le produit du site et les **IDs des packages Tebex** (ceux des packs aussi).
2. Copie la **clé publique** dans `orn_lib/licence/config.lua` (voir `fivem/orn_lib_licence/README.md`).
3. Teste : crée une licence à la main pour toi, mets-la dans le `server.cfg` de ton serveur de test, démarre le script.

Les webhooks Tebex n'ont rien à changer : le site les transfère tels quels à l'API, qui vérifie elle-même la signature.

## Commandes utiles

```bash
pm2 logs orion-api --lines 50       # journaux
pm2 restart orion-api               # redémarrer
npm test                            # tests automatiques
```

## Points d'entrée

| Méthode | Chemin | Rôle |
|---|---|---|
| POST | `/v1/verify` | `{cle, script, version, nonce}` → réponse signée |
| GET | `/v1/changelog` | tous les scripts + dernières versions |
| GET | `/v1/changelog/:script` | versions d'un script (badges, notes markdown) |
| POST | `/v1/webhooks/tebex` | webhook Tebex (signature vérifiée) |
| GET | `/v1/health` | santé |
| — | `/v1/admin/*` | licences, scripts, versions, journaux (jeton `ADMIN_TOKEN`, réservé au site) |

### Message signé

```
orion-licence-v1
<nonce envoyé par le serveur FiveM>
<horodatage unix>
<script>
<valid | invalid:code>
<dernière version>
<16 premiers hex du SHA-512 de la clé>
```

Le module Lua reconstruit ce texte, vérifie la signature avec la clé publique, le nonce, l'empreinte de la clé et l'horodatage (± 10 min).
