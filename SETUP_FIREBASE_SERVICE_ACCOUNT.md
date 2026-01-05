# Setup Firebase Service Account

## Step 1: Download Service Account JSON

1. In Firebase Console, go to **⚙️ Settings** → **Project settings** → **Service accounts** tab
2. Click **"Generate new private key"**
3. A JSON file will download (usually named something like `ddrc-18726-xxxxx.json`)

## Step 2: Rename and Move the File

1. **Rename** the downloaded file to: `firebase-service-account.json`
2. **Move/Copy** it to: `ddrc-workspace-admin-web-app/firebase-service-account.json`

   The file should be in the root of the admin-web-app directory, same level as `package.json`

## Step 3: Update .env.local

1. Open `ddrc-workspace-admin-web-app/.env.local`
2. Add these lines:
   ```
   FCM_SERVICE_ACCOUNT_PATH=./firebase-service-account.json
   FCM_PROJECT_ID=ddrc-18726
   ```

3. **Important**: Make sure `firebase-service-account.json` is in `.gitignore` so it's not committed to version control!

## Step 4: Install Dependencies

```bash
cd ddrc-workspace-admin-web-app
npm install jsonwebtoken @types/jsonwebtoken
```

## Step 5: Restart Backend

Restart your backend server after adding the configuration.

## Verify Setup

After setup, when you send a notification from the admin panel, check backend logs for:
- `FCM_V1_PUSH_SENT` - Success!
- `FCM_V1_PUSH_FAILED` - Check error message

## File Structure

```
ddrc-workspace-admin-web-app/
├── firebase-service-account.json  ← Place the service account file here
├── .env.local                     ← Add FCM_SERVICE_ACCOUNT_PATH and FCM_PROJECT_ID
├── package.json
└── ...
```



