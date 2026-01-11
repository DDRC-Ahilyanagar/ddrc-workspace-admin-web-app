#!/bin/bash
# Deployment script - builds on server (faster than CI/CD)
# Usage: ./deploy-with-auto-git.sh
#
# This script:
# 1. Pulls latest code from git
# 2. Builds on server (no need to push code first)
# 3. Runs migrations
# 4. Restarts PM2
#
# To run directly via SSH (one-liner):
# ssh root@194.164.149.38 'cd /var/www/surveys.ddrcnagar.in && git config --global --add safe.directory /var/www/surveys.ddrcnagar.in && if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then rm -rf .git && git init && git branch -m master && git remote add origin git@github.com:utkrranti/ddrc-workspace-admin-web-app.git && git fetch origin master && git checkout -B master origin/master; else if ! git remote | grep -q origin; then git remote add origin git@github.com:utkrranti/ddrc-workspace-admin-web-app.git; else git remote set-url origin git@github.com:utkrranti/ddrc-workspace-admin-web-app.git; fi && git fetch origin master && git reset --hard origin/master; fi && rm -rf .next && rm -rf node_modules package-lock.json && npm install && npm run build && npm run prisma:generate || true && npm run prisma:migrate deploy || true && pm2 delete surveys-ddrc || true && pm2 start npm --name surveys-ddrc -- start && pm2 save'

set -e

VPS_HOST="194.164.149.38"
VPS_USER="root"
VPS_PORT="22"

echo "🚀 Starting deployment..."

# Push code to git first (so server can pull it)
git push origin master || echo "⚠️  Git push failed, continuing anyway..."

echo "📥 Deploying on server..."

ssh -p $VPS_PORT $VPS_USER@$VPS_HOST << 'ENDSSH'
set -e
cd /var/www/surveys.ddrcnagar.in

git config --global --add safe.directory /var/www/surveys.ddrcnagar.in

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  rm -rf .git
  git init
  git branch -m master
  git remote add origin git@github.com:utkrranti/ddrc-workspace-admin-web-app.git
  git fetch origin master
  git checkout -B master origin/master
else
  if ! git remote | grep -q origin; then
    git remote add origin git@github.com:utkrranti/ddrc-workspace-admin-web-app.git
  else
    git remote set-url origin git@github.com:utkrranti/ddrc-workspace-admin-web-app.git
  fi
  git fetch origin master
  git reset --hard origin/master
fi

rm -rf .next

rm -rf node_modules package-lock.json
npm install

npm run build

npm run prisma:generate || true
npm run prisma:migrate deploy || true

pm2 delete surveys-ddrc || true
pm2 start npm --name surveys-ddrc -- start
pm2 save
ENDSSH

echo "✅ Deployment complete!"
