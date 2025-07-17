# Firebase to PostgreSQL Migration Guide

## Overview
This guide documents the process of migrating user authentication from Firebase to PostgreSQL for the TAAXDOG application.

## Migration Components

### 1. Database Schema
The PostgreSQL database already contains comprehensive user tables with Australian compliance fields:
- Users table with email, password hash, verification status
- Sessions table for JWT-based authentication
- Audit logs for security tracking

### 2. Migration Scripts

#### `scripts/migrate-firebase-users.ts`
Main migration script that:
- Connects to Firebase Admin SDK
- Fetches all Firebase users
- Creates corresponding PostgreSQL users
- Generates temporary passwords and reset tokens
- Logs migration results

#### `scripts/send-password-reset-emails.ts`
Email campaign script that:
- Finds all migrated users with reset tokens
- Sends password reset emails
- Implements rate limiting
- Tracks email delivery status

#### `scripts/check-migration-status.ts`
Status monitoring script that:
- Shows total users migrated
- Displays verification status
- Reports login activity
- Identifies any migration errors

## Migration Process

### Prerequisites

1. Set up Firebase service account:
   ```bash
   # Add to .env file:
   FIREBASE_SERVICE_ACCOUNT_PATH=/path/to/serviceAccount.json
   FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
   ```

2. Ensure PostgreSQL connection:
   ```bash
   npm run test-db
   ```

### Step 1: Run Migration
```bash
npx ts-node scripts/migrate-firebase-users.ts
```

Expected output:
```
🚀 Starting Firebase to PostgreSQL user migration...
📱 Initializing Firebase Admin SDK...
✅ Firebase Admin initialized
🔍 Fetching users from Firebase...
✅ Found X users in Firebase
🔄 Starting migration...
```

### Step 2: Check Migration Status
```bash
npx ts-node scripts/check-migration-status.ts
```

### Step 3: Send Password Reset Emails
```bash
npx ts-node scripts/send-password-reset-emails.ts
```

## Important Notes

### Password Handling
- Firebase password hashes cannot be migrated directly
- All migrated users receive temporary passwords
- Users must reset passwords via email link
- Reset tokens valid for 7 days

### User Data Mapping
| Firebase Field | PostgreSQL Field | Notes |
|---------------|------------------|-------|
| uid | - | Not migrated, new UUID generated |
| email | email | Converted to lowercase |
| displayName | name | Defaults to email prefix if null |
| photoURL | image | Optional field |
| phoneNumber | phone | Optional field |
| emailVerified | emailVerified | Timestamp if verified |
| metadata.creationTime | createdAt | Preserved from Firebase |
| metadata.lastSignInTime | lastLoginAt | Preserved if available |

### Post-Migration Tasks

1. **Monitor Login Activity**
   - Check audit logs for successful logins
   - Track password reset completions
   - Identify users having issues

2. **Update Application Code**
   - Remove Firebase SDK dependencies
   - Update environment variables
   - Deploy PostgreSQL-based auth

3. **Communication**
   - Notify users about password reset requirement
   - Provide support documentation
   - Monitor support channels

### Rollback Plan

If issues arise:
1. Keep Firebase auth active during migration
2. Update frontend to use Firebase endpoints
3. Investigate and fix PostgreSQL issues
4. Re-run migration with fixes

### Security Considerations

- All passwords are hashed with bcrypt (12 rounds)
- Reset tokens are cryptographically random
- Audit logs track all migration activities
- Email verification status preserved
- Rate limiting on password reset emails

## Troubleshooting

### Common Issues

1. **Firebase initialization fails**
   - Check service account path
   - Verify Firebase project ID
   - Ensure proper permissions

2. **Email sending fails**
   - Verify SMTP configuration
   - Check email service limits
   - Review email templates

3. **Duplicate users**
   - Script skips existing emails
   - Check for case sensitivity issues
   - Review audit logs

### Support Scripts

```bash
# Check specific user
npx ts-node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.user.findUnique({ where: { email: 'user@example.com' } })
  .then(console.log)
  .finally(() => prisma.\$disconnect());
"

# Count migration logs
npx ts-node -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
prisma.auditLog.count({ 
  where: { 
    event: 'REGISTER',
    metadata: { path: ['source'], equals: 'firebase_migration' }
  }
}).then(count => console.log('Migrated users:', count))
  .finally(() => prisma.\$disconnect());
"
```

## Completion Checklist

- [ ] Firebase service account configured
- [ ] Migration script executed successfully
- [ ] Status check shows expected user count
- [ ] Password reset emails sent
- [ ] Test user can login with new password
- [ ] Frontend updated to use PostgreSQL auth
- [ ] Firebase auth disabled
- [ ] Monitoring in place