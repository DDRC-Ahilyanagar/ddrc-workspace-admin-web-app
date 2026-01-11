# Quick Deployment Guide

## ⚠️ Important: Server Directory is NOT a Git Repository

The server directory `/var/www/surveys.ddrcnagar.in` is not a git repository. Use one of these methods:

---

## Method 1: Auto-Initialize Git + Deploy ⚡ FASTEST & EASIEST

This command automatically initializes git if needed, then pulls and deploys:

```bash
ssh root@194.164.149.38 'cd /var/www/surveys.ddrcnagar.in && if [ ! -d .git ]; then git init && git remote add origin https://github.com/utkrranti/ddrc-workspace-admin-web-app.git && git fetch origin master && git reset --hard origin/master; else git pull origin master; fi && npm ci --omit=dev --no-audit --no-fund && npm run build && npm run prisma:generate && npm run prisma:migrate deploy || true && pm2 restart surveys-ddrc'
```

**Password:** `Uegshle@1989!`

**What it does:**
1. ✅ Checks if git exists, initializes if needed
2. ✅ Pulls latest code
3. ✅ Installs dependencies
4. ✅ Builds the app
5. ✅ Runs migrations
6. ✅ Restarts PM2

**Time: ~2-3 minutes**

---

## Method 1b: Using the Deploy Script (Cleaner)

Or use the script I created:

```bash
# Make executable (on Linux/Mac)
chmod +x deploy-with-auto-git.sh

# Run it
./deploy-with-auto-git.sh
```

**Time: ~2-3 minutes**

---

## Method 2: Use CI/CD (Automatic) 🤖

Just push to master branch - CI/CD will automatically:
1. Build the app
2. Upload files via SCP
3. Install dependencies
4. Run migrations
5. Restart PM2

```bash
git push origin master
```

**Time: ~10-15 minutes** (but fully automatic)

---

## Method 3: Manual Upload with rsync (If Git Not Available)

If you can't use git, upload files manually:

```bash
# Build locally first
npm run build

# Upload files to server
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude '.next/cache' \
  -e "ssh -p 22" \
  ./ \
  root@194.164.149.38:/var/www/surveys.ddrcnagar.in/

# Then deploy on server
ssh root@194.164.149.38 'cd /var/www/surveys.ddrcnagar.in && npm ci --omit=dev --no-audit --no-fund && npm run prisma:generate && npm run prisma:migrate deploy || true && pm2 restart surveys-ddrc'
```

---

## Even Faster: Setup SSH Key (One-Time)

To avoid entering password every time:

```bash
# 1. Generate SSH key (if you don't have one)
ssh-keygen -t rsa -b 4096
# Press Enter to accept default location

# 2. Copy key to server (enter password once)
ssh-copy-id root@194.164.149.38
# Enter password: Uegshle@1989!

# 3. Now you can deploy without password!
ssh root@194.164.149.38 'cd /var/www/surveys.ddrcnagar.in && git pull origin master && npm ci --omit=dev --no-audit --no-fund && npm run build && npm run prisma:generate && npm run prisma:migrate deploy || true && pm2 restart surveys-ddrc'
```

---

## Save as Alias (Recommended)

Add to `~/.bashrc` or `~/.zshrc`:

```bash
alias deploy-ddrc='ssh root@194.164.149.38 "cd /var/www/surveys.ddrcnagar.in && git pull origin master && npm ci --omit=dev --no-audit --no-fund && npm run build && npm run prisma:generate && npm run prisma:migrate deploy || true && pm2 restart surveys-ddrc"'
```

Then:
```bash
source ~/.bashrc  # or source ~/.zshrc
deploy-ddrc
```

---

## What the Command Does

1. ✅ Pulls latest code from Git
2. ✅ Installs production dependencies
3. ✅ Builds the Next.js app
4. ✅ Generates Prisma client
5. ✅ Runs database migrations
6. ✅ Restarts PM2 process

**Total time: ~2-3 minutes** (much faster than CI/CD!)
