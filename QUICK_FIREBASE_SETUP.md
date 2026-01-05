# Quick Firebase Setup Guide

## What You Need to Do:

### 1. Download Service Account JSON from Firebase

1. Go to Firebase Console → Your Project → ⚙️ Settings → **Service accounts** tab
2. Click **"Generate new private key"**
3. A JSON file will download (e.g., `ddrc-18726-xxxxx.json`)

### 2. Rename and Place the File

1. **Rename** the downloaded file to: `firebase-service-account.json`
2. **Copy/Move** it to: `ddrc-workspace-admin-web-app/firebase-service-account.json`

   (Same directory as `package.json`)

### 3. Update .env.local

Open `ddrc-workspace-admin-web-app/.env.local` and add:

```env
FCM_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
FCM_PROJECT_ID=ddrc-18726
```

### 4. Install Dependencies

```bash
cd ddrc-workspace-admin-web-app
npm install jsonwebtoken @types/jsonwebtoken
```

### 5. Restart Backend

Restart your Next.js backend server.

## That's It!

After these steps, notifications will work using the V1 API (recommended by Google).

## Test It:

1. Run the Flutter app and log in (registers FCM token)
2. Send a clarification request from admin panel
3. Notification should appear on device! 🔔



