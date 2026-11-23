# orn_testgate

Ressource à installer sur le **serveur de test** uniquement.

1. Copier le dossier dans `resources/`.
2. Dans `config.lua`, coller `SiteUrl` et `ApiKey` (Admin du site → Serveur de test).
3. `server.cfg` :
   ```cfg
   ensure orn_testgate
   add_ace group.admin orion.testbypass allow
   ```
4. Les joueurs doivent avoir relié leur Discord à FiveM (identifiant `discord:`).
