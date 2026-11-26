#!/usr/bin/env bash
# Crée un fichier swap de 2 Go s'il n'y en a pas (utile sur un VPS avec peu de RAM).
set -e
if swapon --show | grep -q .; then echo "Swap déjà présent :"; swapon --show; exit 0; fi
fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
# Le système n'utilise le swap qu'en dernier recours
sysctl vm.swappiness=10
grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
echo "✓ Swap de 2 Go actif :"; swapon --show
