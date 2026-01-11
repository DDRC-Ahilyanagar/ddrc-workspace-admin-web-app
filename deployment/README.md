# Fast Deployment Options

The CI/CD pipeline is slow because it builds on GitHub Actions. Here are faster alternatives:

## Option 1: Direct SSH Deployment (Fastest - Recommended) ⚡

### One-liner from your local machine:
```bash
ssh root@194.164.149.38 'cd /var/www/surveys.ddrcnagar.in && git pull origin master && npm ci --omit=dev && npm run build && pm2 restart surveys-ddrc'
```

### Or use the deploy script:
```bash
# Make it executable (on Linux/Mac)
chmod +x deploy-local.sh

# Run it (already configured with correct IP)
./deploy-local.sh
```

**Time: ~2-3 minutes** (vs 10-15 minutes with CI/CD)

---

## Option 2: Server-Side Git Hook (Automatic) 🔄

### Setup once on server:
```bash
# SSH into server
ssh root@194.164.149.38

# Create post-receive hook
cd /var/www/surveys.ddrcnagar.in
cat > .git/hooks/post-receive << 'EOF'
#!/bin/bash
cd /var/www/surveys.ddrcnagar.in
git pull origin master
npm ci --omit=dev --no-audit --no-fund
npm run build
npm run prisma:generate
npm run prisma:migrate deploy || true
mkdir -p storage/logs storage/reports
export NODE_ENV=production
export PORT=3000
pm2 restart surveys-ddrc || pm2 start npm --name "surveys-ddrc" -- start
pm2 save
EOF

chmod +x .git/hooks/post-receive
```

### Then just push from local:
```bash
git push origin master
# Server automatically deploys!
```

**Time: ~2-3 minutes** (automatic after push)

---

## Option 3: GitHub Webhook (Best for Team) 🎣

### Setup webhook endpoint on server:
1. Create a simple webhook listener (Node.js/Python)
2. Configure GitHub webhook to call your server endpoint
3. Server auto-deploys on push

**Time: ~2-3 minutes** (automatic after push)

---

## Option 4: PM2 Ecosystem File (Advanced) 📋

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [{
    name: 'surveys-ddrc',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/surveys.ddrcnagar.in',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }],
  deploy: {
    production: {
      user: 'root',
      host: 'srv868538.hostinger.com',
      ref: 'origin/master',
      repo: 'git@github.com:utkrranti/ddrc-workspace-admin-web-app.git',
      path: '/var/www/surveys.ddrcnagar.in',
      'post-deploy': 'npm ci --omit=dev && npm run build && pm2 restart surveys-ddrc'
    }
  }
}
```

Then deploy with:
```bash
pm2 deploy production
```

---

## Quick Comparison

| Method | Speed | Setup | Best For |
|--------|-------|-------|----------|
| **Direct SSH** | ⚡⚡⚡ Fastest | Easy | Solo dev, quick fixes |
| **Git Hook** | ⚡⚡ Fast | Medium | Solo dev, auto-deploy |
| **Webhook** | ⚡⚡ Fast | Hard | Team, production |
| **PM2 Deploy** | ⚡⚡ Fast | Medium | Advanced users |
| **CI/CD** | ⚡ Slow | Easy | Team, CI checks |

---

## Recommended: Direct SSH One-Liner

For fastest deployment, use this one-liner:

```bash
ssh root@194.164.149.38 'cd /var/www/surveys.ddrcnagar.in && git pull origin master && npm ci --omit=dev --no-audit --no-fund && npm run build && npm run prisma:generate && npm run prisma:migrate deploy || true && pm2 restart surveys-ddrc'
```

**Note:** If using password authentication, you'll be prompted for the password. For faster deployments, consider setting up SSH key authentication.

### Save as Alias

Add this to your `~/.bashrc` or `~/.zshrc`:
```bash
alias deploy-ddrc='ssh root@194.164.149.38 "cd /var/www/surveys.ddrcnagar.in && git pull origin master && npm ci --omit=dev --no-audit --no-fund && npm run build && npm run prisma:generate && npm run prisma:migrate deploy || true && pm2 restart surveys-ddrc"'
```

Then reload and run:
```bash
source ~/.bashrc  # or source ~/.zshrc
deploy-ddrc
```

### Setup SSH Key (Optional - Faster)

To avoid entering password every time:

```bash
# Generate SSH key (if you don't have one)
ssh-keygen -t rsa -b 4096

# Copy key to server (will prompt for password once)
ssh-copy-id root@194.164.149.38

# Now you can SSH without password!
```
