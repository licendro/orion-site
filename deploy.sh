#!/usr/bin/env bash
# Mise à jour du site, du bot et de l'API de licences sur le VPS :  cd /root/orion && ./deploy.sh
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

if [ -f licence-api/.env ]; then
  echo "→ API de licences : dépendances + redémarrage"
  (cd licence-api && npm ci --omit=dev --no-audit --no-fund && mkdir -p logs data backups)
  if pm2 describe orion-api >/dev/null 2>&1; then
    pm2 reload orion-api --update-env
  else
    (cd licence-api && pm2 start ecosystem.config.cjs)
  fi
  # Sauvegarde chaque nuit à 4 h 15 (base des licences + base du site), gardée 14 jours
  if ! crontab -l 2>/dev/null | grep -q 'licence-api && node scripts/backup.js'; then
    (crontab -l 2>/dev/null; echo "15 4 * * * cd $(pwd)/licence-api && node scripts/backup.js >> backups/backup.log 2>&1") | crontab -
    echo "→ Sauvegarde nocturne installée"
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
