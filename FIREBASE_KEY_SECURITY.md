# Firebase Service Account Key Security

## Security Issue Resolved

Firebase service account keys were previously committed to the repository in
plain text. This has been addressed by:

1. **Removed from Git History**: The files have been removed from Git tracking
2. **Added to .gitignore**: Prevents future accidental commits
3. **Secure Storage Setup**: Created utilities for environment variable storage

## Secure Key Management

### For Local Development

1. Keep your `firebase-adminsdk.json` file in the `backend/` directory
2. This file is now ignored by Git and won't be committed

### For Production Deployment

1. **Encode your service account key**:

   ```bash
   python scripts/encode-firebase-key.py backend/firebase-adminsdk.json
   ```

2. **Set the environment variable**:
   - Copy the base64 encoded output
   - Add to your production environment:
     ```
     FIREBASE_SERVICE_ACCOUNT=<base64-encoded-json>
     ```

3. **The application will automatically**:
   - Use the local file in development
   - Decode and use the environment variable in production

### Using the Service Account in Code

```python
from backend.firebase_service_account import get_firebase_service_account

# Get credentials (works in both dev and prod)
credentials = get_firebase_service_account()

# Use with Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials as firebase_credentials

cred = firebase_credentials.Certificate(credentials)
firebase_admin.initialize_app(cred)
```

## Important Security Notes

⚠️ **NEVER commit service account keys to Git** ⚠️ **The exposed keys should be
rotated immediately in Firebase Console** ⚠️ **Always use environment variables
for production secrets**

## Rotating Compromised Keys

Since the keys were exposed in Git history:

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Navigate to Project Settings > Service Accounts
3. Generate new private key
4. Update your local `firebase-adminsdk.json`
5. Re-encode for production using the script
6. Update production environment variables

## Files Affected

- `backend/firebase-adminsdk.json` - Now gitignored
- `config/firebase-adminsdk.json` - Now gitignored
- `.gitignore` - Updated to exclude Firebase keys
- `backend/firebase_service_account.py` - New secure loader
- `scripts/encode-firebase-key.py` - Encoding utility
