# Orion — site public

Site vitrine et boutique d'Orion Scripts : Next.js 14, catalogue et paiement Tebex (Headless API + Tebex.js), formulaire de devis envoyé sur Discord.

Contenu :
- site public (catalogue, fiches, panier, paiement Tebex sans quitter le site, devis) ;
- connexion Discord des clients (`/compte`), ajout automatique au serveur Discord ;
- webhooks Tebex (`/api/webhooks/tebex`) : commandes, remboursements, litiges ;
- espace admin (`/admin`) : produits, promotions + coupons Tebex, codes promo, commandes, clients, mises à jour, annonces Discord, devis, maintenance, réglages, journal ;
- bot Discord (`discord/`) : règlement, notifications, tickets, rôle client, salon unique par client, annonces automatiques.

Base de données : SQLite dans `data/orion.db` (partagée par le site et le bot, jamais versionnée).

## Fonctionnement

- **Catalogue** : lu depuis Tebex (`TEBEX_PUBLIC_TOKEN`), rafraîchi toutes les 5 minutes. Sans clé, le site affiche le catalogue de démonstration et le paiement est désactivé.
- **Contenu enrichi** (`content/products.js`) : image, points forts, version… reliés à chaque package Tebex par son nom (ex. `orn_bank`). Un package absent du fichier s'affiche quand même, avec l'image et la description de Tebex.
- **orn_lib** : dépendance livrée avec chaque script, jamais vendue ni affichée en boutique (cachée même si elle existe sur Tebex).
- **Packs** : un package Tebex normal ; dans `content/products.js`, son entrée a un champ `bundle` avec la liste des scripts.
- **Promotions** (`content/promotions.js`) : bandeau prix barré + pourcentage. Chaque promo doit avoir son coupon identique dans Tebex (champ `coupon`), appliqué automatiquement au paiement.
- **Paiement** : panier Tebex créé côté serveur → connexion Cfx.re → retour sur le site → ajout des scripts et des coupons → fenêtre Tebex.js sans quitter le site.
- **Devis** : le formulaire Services poste un embed dans le salon Discord du webhook `DISCORD_QUOTE_WEBHOOK`.

## Installation sur le VPS (première fois)

```bash
cd /root
git clone https://github.com/licendro/orion-site.git orion
cd orion
cp .env.example .env
nano .env                       # au minimum SITE_URL
npm ci && npm run build
PORT=3001 pm2 start npm --name orion -- start   # test sur le port 3001
curl http://127.0.0.1:3001/api/health
```

## Mettre à jour

```bash
cd /root/orion && ./deploy.sh
```

## Développement local

```bash
npm install
npm run dev     # http://localhost:3000
```
