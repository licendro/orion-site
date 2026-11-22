#!/usr/bin/env bash
# Mise à jour du site sur le VPS :  cd /root/orion && ./deploy.sh
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Récupération du code"
git pull --ff-only

echo "→ Installation des dépendances"
npm ci --no-audit --no-fund

echo "→ Construction"
npm run build

echo "→ Redémarrage"
if pm2 describe orion >/dev/null 2>&1; then
  pm2 reload orion --update-env
else
  PORT="${PORT:-3000}" pm2 start npm --name orion -- start
fi
pm2 save >/dev/null

sleep 3
curl -fsS "http://127.0.0.1:${PORT:-3000}/api/health" && echo && echo "✓ Site à jour"
