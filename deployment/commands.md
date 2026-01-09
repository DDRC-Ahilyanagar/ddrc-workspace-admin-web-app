ssh user@your_vps_ip
cd /var/www/surveys.ddrcnagar.in

git pull origin main

nvm use 20 || nvm install 20

rm -rf node_modules .next
npm ci

npm run build

npm ci --omit=dev --no-audit --no-fund

mkdir -p storage/logs

npm run prisma:generate
npm run prisma:migrate deploy
npm run prisma:seed || true

export NODE_ENV=production
export PORT=3000

pm2 restart surveys-ddrc || pm2 start npm --name "surveys-ddrc" -- start
pm2 save
