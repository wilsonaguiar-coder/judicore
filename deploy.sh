#!/bin/bash
# Deploy completo — SEMPRE nesta ordem para evitar usar dist/ desatualizado de packages/ai
set -e
cd /opt/judicore

echo '=== git pull ==='
git pull

echo '=== build packages/ai (dist/) ==='
pnpm --filter @judicore/ai build

echo '=== build apps/web (Next.js) ==='
pnpm --filter @judicore/web build

echo '=== pm2 restart judicore-web ==='
pm2 restart 8

echo '=== done ==='
pm2 status
