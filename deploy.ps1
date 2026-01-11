# PowerShell Deployment Script
# Usage: .\deploy.ps1

$VPS_HOST = "194.164.149.38"
$VPS_USER = "root"
$VPS_PORT = "22"

Write-Host "🚀 Starting deployment..." -ForegroundColor Green

# Push code to git first
Write-Host "📤 Pushing code to repository..." -ForegroundColor Yellow
git push origin master
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Git push failed, continuing anyway..." -ForegroundColor Yellow
}

Write-Host "📥 Deploying on server..." -ForegroundColor Yellow

# Single-line SSH command with progress messages (no emojis - bash compatible)
$sshCommand = 'cd /var/www/surveys.ddrcnagar.in && echo "[1/8] Configuring git..." && git config --global --add safe.directory /var/www/surveys.ddrcnagar.in && if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo "[2/8] Initializing git repo..." && rm -rf .git && git init && git branch -m master && git remote add origin git@github.com:utkrranti/ddrc-workspace-admin-web-app.git && git fetch origin master && git checkout -B master origin/master; else if ! git remote | grep -q origin; then git remote add origin git@github.com:utkrranti/ddrc-workspace-admin-web-app.git; else git remote set-url origin git@github.com:utkrranti/ddrc-workspace-admin-web-app.git; fi && echo "[2/8] Pulling latest code..." && git fetch origin master && git reset --hard origin/master; fi && echo "[3/8] Cleaning old files..." && rm -rf .next && rm -rf node_modules package-lock.json && echo "[4/8] Installing dependencies (this may take 2-5 minutes)..." && npm install && echo "[5/8] Building application..." && npm run build && echo "[6/8] Running database migrations..." && npm run prisma:generate || true && npm run prisma:migrate deploy || true && echo "[7/8] Restarting application..." && pm2 delete surveys-ddrc || true && pm2 start npm --name surveys-ddrc -- start && pm2 save && echo "[8/8] Server deployment complete!"'

# Execute SSH command
ssh -p $VPS_PORT "${VPS_USER}@${VPS_HOST}" $sshCommand

Write-Host "✅ Deployment complete!" -ForegroundColor Green
