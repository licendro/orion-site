# Module de licences pour orn_lib

Copie le dossier `licence/` dans `orn_lib/`, puis ajoute dans le `fxmanifest.lua` de **orn_lib** :

```lua
lua54 'yes'

server_scripts {
  'licence/config.lua',
  'licence/crypto.lua',
  'licence/server.lua',
  -- … le reste de orn_lib
}

-- Fichiers que les scripts Orion incluent avec @orn_lib/…
files { 'licence/gate_server.lua', 'licence/gate_client.lua' }
```

Dans `licence/config.lua`, colle la **clé publique** donnée par `npm run keygen` (API).

## Dans chaque script Orion

`fxmanifest.lua` :

```lua
lua54 'yes'
version '1.2.0'              -- comparée à la dernière version publiée
orion_script 'orn_garage'    -- nom du script dans l'API (Admin → Licences → Scripts)
dependency 'orn_lib'

server_scripts { '@orn_lib/licence/gate_server.lua', 'server/*.lua' }
client_scripts { '@orn_lib/licence/gate_client.lua', 'client/*.lua' }
escrow_ignore { 'config.lua' }
```

Dans le code, tout le démarrage passe dans `OrionLicence.Ready` (serveur et client) :

```lua
OrionLicence.Ready(function()
  -- enregistrer les events, callbacks, threads, commandes…
end)
```

## Côté client (server.cfg)

```cfg
ensure orn_lib
set orn_licence_orn_garage "ORN-XXXXX-XXXXX-XXXXX-XXXXX"
ensure orn_garage
```

La clé se trouve dans **jdev-hub.fr/compte → Mes licences**. La licence se lie à l'IP du serveur au premier démarrage ; le client peut la changer lui-même une fois tous les 7 jours.

## Ce que fait le module

| Situation | Résultat |
|---|---|
| Licence valide | `Licence valide` en vert, le script démarre |
| Mise à jour disponible | Message jaune avec le lien du changelog |
| Licence inconnue, révoquée, suspendue, autre serveur | Message rouge clair, **seul ce script** ne démarre pas |
| API injoignable | Dernier résultat valide accepté **72 h**, puis le script ne démarre plus |
| Réponse falsifiée (signature Ed25519 invalide) | Ignorée, traitée comme « API injoignable » |
| Révocation pendant que le serveur tourne | Message rouge à la revérification (toutes les 6 h), le script ne redémarrera pas |

Garanties : aucun code distant n'est exécuté (l'API renvoie uniquement des données signées), tout est protégé par `pcall` pour ne jamais faire planter le serveur, aucune porte dérobée.

⚠ La vérification est aussi solide que la protection du code : garde `gate_server.lua`/`gate_client.lua` **et** les appels `OrionLicence.Ready` dans des fichiers escrowés (Cfx.re). Escrowe aussi orn_lib (sauf `licence/config.lua` si tu veux), sinon un client pourrait modifier la vérification.
