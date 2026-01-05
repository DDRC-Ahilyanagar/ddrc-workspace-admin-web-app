# Firebase Configuration - Complete Status Report

## 📋 Overview

This document provides a complete overview of all Firebase-related configurations in the DDRC project.

**Project ID:** `ddrc-18726`  
**Project Number:** `220867514380`  
**Package Name:** `com.utkrranti.ddrcahilyanagar`

---

## ✅ What's Already Configured

### 1. **Flutter Mobile App (Field Officer App)**

#### Firebase Dependencies
- ✅ `firebase_core: ^3.6.0` - Installed
- ✅ `firebase_messaging: ^15.1.3` - Installed
- ✅ `flutter_local_notifications: ^18.0.1` - Installed

#### Android Configuration
- ✅ `google-services.json` exists in:
  - `ddrc-workspace-field-officer-app/google-services.json`
  - `ddrc-workspace-field-officer-app/android/app/google-services.json`
- ✅ Google Services plugin configured:
  - `android/settings.gradle.kts`: Plugin version `4.4.4` declared
  - `android/app/build.gradle.kts`: Plugin applied
- ✅ Firebase dependencies in `build.gradle.kts`:
  - Firebase BoM: `34.7.0`
  - Firebase Messaging
  - Firebase Analytics

#### Code Implementation
- ✅ Firebase initialized in `lib/main.dart`
- ✅ Push notification service implemented (`lib/core/push_notification_service.dart`)
- ✅ Background message handler configured
- ✅ FCM token registration with backend implemented
- ✅ Local notifications for foreground/background messages

### 2. **Backend (Admin Web App)**

#### Dependencies
- ✅ `jsonwebtoken: ^9.0.2` - Installed
- ✅ `@types/jsonwebtoken: ^9.0.7` - Installed

#### Code Implementation
- ✅ FCM service implemented (`lib/fcm.ts`)
- ✅ Supports both V1 API (recommended) and Legacy API (fallback)
- ✅ FCM token registration endpoint (`app/api/register-fcm-token/route.ts`)
- ✅ Push notifications sent from clarification request endpoint
- ✅ Database support for FCM tokens (both `users.fcm_token` column and `fcm_tokens` table)

---

## ⚠️ What Needs to be Configured

### 1. **Backend Environment Variables**

You need to add ONE of the following configurations to `ddrc-workspace-admin-web-app/.env.local`:

#### Option A: V1 API (Recommended) ✅
```env
# Download service account JSON from Firebase Console
# Settings → Service accounts → Generate new private key
FCM_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
FCM_PROJECT_ID=ddrc-18726
```

**Steps:**
1. Go to Firebase Console → Project Settings → Service accounts
2. Click "Generate new private key"
3. Download the JSON file
4. Rename it to `firebase-service-account.json`
5. Place it in `ddrc-workspace-admin-web-app/`
6. Add the environment variables above

#### Option B: Legacy API (Fallback)
```env
# Get from Firebase Console → Project Settings → Cloud Messaging → Server key
FCM_SERVER_KEY=your_server_key_here
```

**Note:** Legacy API is deprecated but still works. V1 API is recommended.

---

## 📁 File Structure

```
ddrc-workspace/
├── ddrc-workspace-field-officer-app/
│   ├── google-services.json ✅ (configured)
│   ├── android/app/google-services.json ✅ (configured)
│   ├── android/app/build.gradle.kts ✅ (Firebase plugin applied)
│   ├── android/settings.gradle.kts ✅ (Google Services plugin declared)
│   ├── lib/
│   │   ├── main.dart ✅ (Firebase initialized)
│   │   └── core/
│   │       └── push_notification_service.dart ✅ (FCM implementation)
│   └── pubspec.yaml ✅ (Firebase dependencies)
│
└── ddrc-workspace-admin-web-app/
    ├── firebase-service-account.json.example ✅ (template)
    ├── firebase-service-account.json ⚠️ (NEEDS TO BE CREATED)
    ├── .env.local ⚠️ (NEEDS FCM CONFIGURATION)
    ├── lib/
    │   └── fcm.ts ✅ (FCM service implementation)
    └── app/api/
        ├── register-fcm-token/
        │   └── route.ts ✅ (Token registration endpoint)
        └── admin/surveys/[id]/request-clarification/
            └── route.ts ✅ (Sends FCM notifications)
```

---

## 🔄 How It Works

### 1. **Token Registration Flow**
```
Mobile App (Flutter)
  ↓
1. User logs in
  ↓
2. Firebase.initializeApp() called
  ↓
3. PushNotificationService.initialize()
  ↓
4. Get FCM token from Firebase
  ↓
5. POST /api/register-fcm-token
  ↓
Backend (Next.js)
  ↓
6. Save token to database (users.fcm_token or fcm_tokens table)
```

### 2. **Notification Sending Flow**
```
Admin Panel
  ↓
1. Admin requests clarification for survey
  ↓
2. POST /api/admin/surveys/[id]/request-clarification
  ↓
3. Backend calls sendFCMPushNotification()
  ↓
4. Get FCM token(s) from database
  ↓
5. Send via FCM V1 API (or Legacy API fallback)
  ↓
Firebase Cloud Messaging
  ↓
6. Push notification delivered to device
```

---

## 🧪 Testing Checklist

### Mobile App
- [ ] Run the Flutter app
- [ ] Check console for: `✅ Firebase initialized`
- [ ] Check console for: `✅ Push notifications initialized`
- [ ] Check console for: `🔑 FCM Token: ...`
- [ ] Verify token is registered in backend logs

### Backend
- [ ] Verify `.env.local` has FCM configuration
- [ ] Check if `firebase-service-account.json` exists (for V1 API)
- [ ] Restart backend server after adding config
- [ ] Test sending notification from admin panel
- [ ] Check backend logs for:
  - `FCM_V1_PUSH_SENT` (success)
  - `FCM_V1_PUSH_FAILED` (error)
  - `FCM_LEGACY_PUSH_SENT` (if using Legacy API)

---

## 📚 Documentation Files

1. **`SETUP_FIREBASE_SERVICE_ACCOUNT.md`** - Service account setup guide
2. **`QUICK_FIREBASE_SETUP.md`** - Quick setup guide
3. **`FIREBASE_V1_API_SETUP.md`** (in field-officer-app) - V1 API details
4. **`FIREBASE_FINAL_CHECKLIST.md`** (in field-officer-app) - Final checklist

---

## 🔐 Security Notes

- ✅ `firebase-service-account.json` is in `.gitignore` (won't be committed)
- ✅ `firebase-service-account.json.example` is a template (safe to commit)
- ✅ `.env.local` is in `.gitignore` (won't be committed)
- ⚠️ Never commit real service account keys or server keys to version control

---

## 🚀 Next Steps

1. **Download Service Account Key:**
   - Go to Firebase Console → Project Settings → Service accounts
   - Click "Generate new private key"
   - Save as `firebase-service-account.json` in `ddrc-workspace-admin-web-app/`

2. **Update `.env.local`:**
   ```env
   FCM_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   FCM_PROJECT_ID=ddrc-18726
   ```

3. **Restart Backend:**
   ```bash
   cd ddrc-workspace-admin-web-app
   npm run dev
   ```

4. **Test:**
   - Run Flutter app and log in
   - Verify FCM token is registered
   - Send a clarification request from admin panel
   - Check if notification is received on device

---

## 📊 Current Status Summary

| Component | Status | Notes |
|-----------|--------|-------|
| Firebase Project | ✅ Created | Project ID: ddrc-18726 |
| Android App Registration | ✅ Done | Package: com.utkrranti.ddrcahilyanagar |
| google-services.json | ✅ Configured | Both locations |
| Flutter Dependencies | ✅ Installed | firebase_core, firebase_messaging |
| Android Gradle Config | ✅ Configured | Google Services plugin applied |
| Mobile App Code | ✅ Implemented | Push notification service ready |
| Backend FCM Service | ✅ Implemented | Supports V1 + Legacy API |
| Backend Token Endpoint | ✅ Implemented | /api/register-fcm-token |
| Service Account Key | ⚠️ **MISSING** | Need to download from Firebase |
| Backend .env.local | ⚠️ **MISSING** | Need FCM configuration |

---

## 🎯 Action Required

**You need to:**
1. Download the service account JSON from Firebase Console
2. Save it as `firebase-service-account.json` in the admin-web-app directory
3. Add FCM configuration to `.env.local`
4. Restart the backend server

Once these steps are complete, push notifications will be fully functional! 🎉

