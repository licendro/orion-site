#!/usr/bin/env bash
# Mise à jour du site ET du bot sur le VPS :  cd /root/orion && ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p data

echo "→ Récupération du code"
git pull --ff-only

echo "→ Site : dépendances + construction"
npm ci --no-audit --no-fund
npm run build

echo "→ Redémarrage du site"
if pm2 describe orion >/dev/null 2>&1; then
  pm2 reload orion --update-env
else
  PORT="${PORT:-3000}" pm2 start npm --name orion -- start
fi

if [ -f discord/.env ]; then
  echo "→ Bot : dépendances + redémarrage"
  (cd discord && npm ci --no-audit --no-fund)
  if pm2 describe orion-bot >/dev/null 2>&1; then
    pm2 restart orion-bot --update-env
  else
    (cd discord && pm2 start npm --name orion-bot -- start)
  fi
fi
pm2 save >/dev/null

# Surveillance toutes les 2 minutes (alertes dans le salon 🚨 alertes du Discord)
if ! crontab -l 2>/dev/null | grep -q '/api/monitor'; then
  (crontab -l 2>/dev/null; echo "*/2 * * * * curl -fsS http://127.0.0.1:${PORT:-3000}/api/monitor >/dev/null 2>&1") | crontab -
  echo "→ Surveillance automatique installée"
fi

sleep 4
curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" && echo && echo "✓ Site et bot à jour"
