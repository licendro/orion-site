# Panneau VPS Orion

Un espace web pour gérer **tout le VPS** sans taper de commandes : il pilote toutes les applications lancées avec pm2 (Orion Store, bot Discord, site RP, et tout ce que tu ajouteras).

- **Tableau de bord** : processeur, RAM, disque, swap, courbes sur 24 h, mémoire réservée par application, dernière sauvegarde.
- **Applications** : démarrer, arrêter, redémarrer, **choisir la mémoire allouée** à chacune (pm2 la redémarre si elle dépasse, elle ne peut pas faire tomber le VPS), mettre à jour (git pull + compilation) avec le résultat en direct.
- **Journaux** en direct : sortie et erreurs, filtre, « erreurs seulement », téléchargement, vidage.
- **Fichiers** : parcourir, modifier (éditeur), créer, renommer, envoyer, télécharger, supprimer. Limité aux dossiers choisis ; tout ce qui est supprimé ou remplacé va dans une **corbeille** (30 jours, restauration en un clic).
- **Alertes Discord** (vérification toutes les 30 s) : application plantée ou qui redémarre toute seule (avec les dernières erreurs), mémoire presque pleine, site qui ne répond plus, disque plein, VPS surchargé, pas de sauvegarde depuis 36 h, retour à la normale, **récap quotidien**.
- **Journal** de toutes les actions faites depuis le panneau.
- **Sécurité** : mot de passe + code à 6 chiffres (appli d'authentification), sessions de 12 h, blocage après 5 essais, aucune commande libre (seulement des actions prévues), pas d'accès hors des dossiers autorisés, en-têtes de sécurité stricts. Le panneau ne peut pas s'arrêter lui-même.

Il consomme environ 40 Mo de RAM (limité à 120 Mo).

## Installation sur le VPS

```bash
cd /root/orion && git pull
cd panel
npm ci --omit=dev
npm run setup                  # identifiant, mot de passe, double authentification, webhook Discord
pm2 start ecosystem.config.cjs # nom : orion-panel, port 3030 (local uniquement)
pm2 save
```

Pendant `npm run setup`, ouvre ton appli d'authentification (Google Authenticator, Aegis, 2FAS…), choisis **Saisir une clé** et recopie la clé affichée.

### Accès sécurisé : panel.jdev-hub.fr

1. Chez ton registraire (IONOS → DNS), ajoute un enregistrement **A** : `panel` → l'IP du VPS.
2. Nginx + HTTPS :

```bash
cp /root/orion/panel/deploy/panel.jdev-hub.fr.conf /etc/nginx/sites-available/panel.jdev-hub.fr
ln -s /etc/nginx/sites-available/panel.jdev-hub.fr /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d panel.jdev-hub.fr
```

Ouvre `https://panel.jdev-hub.fr`. Conseillé : n'autorise que ton IP dans la config Nginx (lignes `allow` / `deny`).

### Premiers réglages (dans le panneau → Réglages)

- **Applications** : nom affiché, groupe, adresse surveillée (ex. `http://127.0.0.1:3000/api/health` pour Orion Store) et commande de mise à jour (ex. `./deploy.sh`).
- **Dossiers accessibles** : par exemple `/root/orion` et le dossier du site RP.
- **Webhook Discord** du salon où recevoir les alertes, puis **Alertes → Envoyer une alerte de test**.

## Roue de secours : Cockpit

Si le panneau lui-même ne répond plus, Cockpit (outil officiel d'Ubuntu) donne un terminal dans le navigateur :

```bash
apt install -y cockpit && systemctl enable --now cockpit.socket
# puis https://IP-DU-VPS:9090 (identifiants Linux du VPS)
```

## En cas de problème

```bash
pm2 logs orion-panel --lines 50   # journaux du panneau
pm2 restart orion-panel           # le redémarrer
npm run setup                     # refaire mot de passe / 2FA (perdus)
```
