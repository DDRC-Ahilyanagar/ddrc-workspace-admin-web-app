# Firebase Backend Setup - Step by Step Guide

## 📋 Quick Answer

**No, `google-services.json` cannot be used to generate the service account key.** These are two different files:
- `google-services.json` = Client-side config for mobile app ✅ (you already have this)
- `firebase-service-account.json` = Server-side credentials for backend ⚠️ (you need this)

However, your backend supports **TWO options** - you can use either one!

---

## 🎯 Option 1: Legacy API (Easier - Quick Setup)

This is the **simpler option** - you just need a server key from Firebase Console.

### Steps:

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com
   - Select your project: **ddrc-18726**

2. **Get the Server Key:**
   - Click the **⚙️ Settings** (gear icon) next to "Project Overview"
   - Select **"Project settings"**
   - Go to the **"Cloud Messaging"** tab
   - Under **"Cloud Messaging API (Legacy)"**, you'll see:
     - **Server key** - Copy this value
     - If you don't see it, you may need to enable the Legacy API first

3. **Add to `.env.local`:**
   ```env
   FCM_SERVER_KEY=your_copied_server_key_here
   ```

4. **Restart Backend:**
   ```bash
   cd ddrc-workspace-admin-web-app
   # Stop your server (Ctrl+C) and restart
   npm run dev
   ```

**✅ Done!** This will work immediately.

**Note:** Legacy API is deprecated by Google but still functional. For long-term, use Option 2.

---

## 🎯 Option 2: V1 API (Recommended - Future-Proof)

This is the **recommended approach** by Google. It uses OAuth2 and is more secure.

### Steps:

1. **Go to Firebase Console:**
   - Visit: https://console.firebase.google.com
   - Select your project: **ddrc-18726**

2. **Generate Service Account Key:**
   - Click the **⚙️ Settings** (gear icon) next to "Project Overview"
   - Select **"Project settings"**
   - Go to the **"Service accounts"** tab
   - Click **"Generate new private key"** button
   - A warning dialog will appear - click **"Generate key"**
   - A JSON file will download (e.g., `ddrc-18726-xxxxx.json`)

3. **Save the File:**
   - **Rename** the downloaded file to: `firebase-service-account.json`
   - **Move/Copy** it to: `ddrc-workspace-admin-web-app/firebase-service-account.json`
   - Make sure it's in the same directory as `package.json`

4. **Add to `.env.local`:**
   ```env
   FCM_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   FCM_PROJECT_ID=ddrc-18726
   ```

5. **Restart Backend:**
   ```bash
   cd ddrc-workspace-admin-web-app
   # Stop your server (Ctrl+C) and restart
   npm run dev
   ```

**✅ Done!** This uses the modern V1 API.

---

## 📝 Creating/Updating `.env.local`

The `.env.local` file should be in: `ddrc-workspace-admin-web-app/.env.local`

If it doesn't exist, create it:

```bash
cd ddrc-workspace-admin-web-app
# Create the file (or edit if it exists)
# On Windows PowerShell:
New-Item -Path .env.local -ItemType File
# Or just create it manually in your editor
```

Then add **ONE** of these configurations:

### For Legacy API (Option 1):
```env
FCM_SERVER_KEY=your_server_key_from_firebase_console
```
**Note:** The API key in `google-services.json` is NOT the server key. You must get the server key from Firebase Console → Project Settings → Cloud Messaging.

### For V1 API (Option 2):
```env
FCM_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
FCM_PROJECT_ID=ddrc-18726
```

**Note:** The project ID `ddrc-18726` is already confirmed from your `google-services.json` file! ✅

---

## 🔍 Visual Guide - Where to Find Settings

### For Legacy API (Server Key):
```
Firebase Console
  → ⚙️ Settings (gear icon)
    → Project settings
      → Cloud Messaging tab
        → Cloud Messaging API (Legacy)
          → Server key (copy this)
```

### For V1 API (Service Account):
```
Firebase Console
  → ⚙️ Settings (gear icon)
    → Project settings
      → Service accounts tab
        → Generate new private key (button)
          → Download JSON file
```

---

## ✅ Verification

After setup, test by:

1. **Run your Flutter app** and log in (registers FCM token)
2. **Check backend logs** for:
   - `FCM_LEGACY_PUSH_SENT` (if using Legacy API)
   - `FCM_V1_PUSH_SENT` (if using V1 API)
3. **Send a clarification request** from admin panel
4. **Check if notification appears** on device

---

## 🆘 Troubleshooting

### "FCM_NOT_CONFIGURED" in logs
- Check that `.env.local` exists and has the correct variables
- Make sure you restarted the backend after adding config

### "FCM_SERVICE_ACCOUNT_FILE_ERROR"
- Verify `firebase-service-account.json` exists in `ddrc-workspace-admin-web-app/`
- Check file path in `.env.local` is correct: `./firebase-service-account.json`

### "FCM_OAUTH_TOKEN_ERROR" (V1 API)
- Verify the service account JSON file is valid
- Check that the file wasn't corrupted during download

### Legacy API not showing Server Key
- You may need to enable "Cloud Messaging API (Legacy)" first
- Go to Firebase Console → Project Settings → Cloud Messaging
- Look for "Enable API" or similar option

---

## 📊 Comparison

| Feature | Legacy API | V1 API |
|--------|-----------|--------|
| Setup Difficulty | ⭐ Easy | ⭐⭐ Medium |
| Security | ⚠️ Less secure | ✅ More secure |
| Google Support | ⚠️ Deprecated | ✅ Recommended |
| Configuration | Just server key | Service account JSON |
| Future-proof | ❌ No | ✅ Yes |

**Recommendation:** Use Legacy API for quick setup, migrate to V1 API later.

---

## 🎯 Quick Decision

**Choose Legacy API if:**
- You want to get it working quickly
- You don't mind using deprecated API
- You just need basic push notifications

**Choose V1 API if:**
- You want future-proof solution
- You want better security
- You're building for long-term

---

## 📞 Need Help?

If you're stuck:
1. Check backend logs for specific error messages
2. Verify `.env.local` file exists and has correct format
3. Make sure you restarted the backend after changes
4. Verify Firebase project ID matches: `ddrc-18726`

