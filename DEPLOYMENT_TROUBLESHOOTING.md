# 🚨 DigitalOcean Deployment Troubleshooting Guide

## Current Issues Identified

### 1. Build Skipped Issue

**Problem**: DigitalOcean reports "The build was skipped for component 'web'"
**Root Cause**: Likely app spec configuration or branch detection issues

### 2. Authentication Failure

**Problem**: Login credentials accepted but nothing happens **Root Cause**:
Missing/incorrect environment variables

### 3. Password Reset Emails Not Sent

**Problem**: Reset password emails are not being delivered **Root Cause**:
Missing email service configuration (`SENDGRID_API_KEY` or SMTP settings)

## 🔧 IMMEDIATE FIX REQUIRED

### Critical Missing Environment Variables

Your DigitalOcean app is missing several **CRITICAL** environment variables. Add
these immediately:

#### 📧 Email Service (REQUIRED for password reset)

```bash
# Option 1: SendGrid (Recommended)
SENDGRID_API_KEY=SG.your_sendgrid_api_key_here
EMAIL_PROVIDER=sendgrid
EMAIL_FROM=noreply@taxreturnpro.com.au

# Option 2: SMTP (Alternative)
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_specific_password
EMAIL_FROM=noreply@taxreturnpro.com.au
```

#### 🗄️ Database Configuration

```bash
# Change from PRODUCTION_DATABASE_URL to DATABASE_URL
DATABASE_URL=postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require
```

#### 🔐 Security & Authentication

```bash
FIELD_ENCRYPTION_KEY=generate_32_char_hex_key_here
JWT_SECRET=generate_secret_here_same_as_nextauth_secret
```

#### 💳 Stripe Configuration (Update keys)

```bash
STRIPE_PUBLISHABLE_KEY=pk_live_51Re1oyLl1e8i03PEfTJeJ6DBeX1T7gzcXRCPWDzePSJGTwBJZYwECtZbGBcYA3H8tl5gxZUobLY4bYmseontkiBj00s6SiBehE
STRIPE_SECRET_KEY=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
STRIPE_WEBHOOK_SECRET=whsec_z2rEeYEZBAbBjxMvCzfKc8Trs1wlTC9L
```

## 🛠️ Step-by-Step Fix Process

### Step 1: Fix Environment Variables in DigitalOcean

1. **Go to DigitalOcean Dashboard**: https://cloud.digitalocean.com/apps
2. **Select your app** (likely named "taaxdog" or similar)
3. **Navigate to**: Settings → App-Level Environment Variables
4. **Add ALL the missing variables above**
5. **IMPORTANT**: Use "Encrypt" option for sensitive values like API keys

### Step 2: Fix Build Configuration

1. **Check App Spec**:
   - Go to Settings → App Spec
   - Ensure `branch` is set to `main` (not `production`)
   - Verify build command: `npm run build`
   - Verify run command: `npm start`

2. **If using custom app.yaml**, ensure it includes:

```yaml
name: taaxdog
services:
  - name: web
    source_dir: /
    github:
      repo: TaaxDog/TAAXDOG-CODING
      branch: main
      deploy_on_push: true
    build_command: npm install && npx prisma generate && npm run build
    run_command: npm start
    environment_slug: node-js
    instance_count: 1
    instance_size_slug: basic-xxs
```

### Step 3: Generate Missing Security Keys

Run these commands locally to generate secure keys:

```bash
# Generate encryption key (32 characters hex)
openssl rand -hex 32

# Generate JWT secret (base64)
openssl rand -base64 32
```

### Step 4: Email Service Setup

#### Option A: SendGrid (Recommended)

1. Sign up at https://sendgrid.com
2. Create API key with "Mail Send" permissions
3. Add `SENDGRID_API_KEY=SG.your_key_here` to DigitalOcean

#### Option B: Gmail SMTP

1. Enable 2FA on your Gmail account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character password for `SMTP_PASS`

## 🚨 URGENT FIXES SUMMARY

1. **Add `SENDGRID_API_KEY`** → Fixes password reset emails
2. **Change `PRODUCTION_DATABASE_URL` to `DATABASE_URL`** → Fixes database
   connection
3. **Add `EMAIL_FROM` and `EMAIL_PROVIDER`** → Ensures email routing
4. **Generate and add `FIELD_ENCRYPTION_KEY`** → Fixes data encryption
5. **Verify `NEXTAUTH_URL=https://dev.taxreturnpro.com.au`** → Fixes auth
   redirects

## 🔄 Deploy Process

After adding all environment variables:

1. **Force Redeploy**:
   - In DigitalOcean dashboard, click "Deploy"
   - OR push a small change to trigger rebuild

2. **Monitor Logs**:
   - Check Runtime Logs for any remaining errors
   - Look for database connection success
   - Verify email service initialization

## 🧪 Test After Deployment

1. **Test Login**: Should work without hanging
2. **Test Password Reset**: Should send email
3. **Check Logs**: Should show no critical errors

## 📞 If Issues Persist

If problems continue after these fixes:

1. **Check Runtime Logs** in DigitalOcean for specific error messages
2. **Verify Database Connection** - ensure PostgreSQL accepts connections
3. **Test Email Service** - verify API keys are valid
4. **Check Domain DNS** - ensure dev.taxreturnpro.com.au points to DigitalOcean

---

**⚡ Priority**: Fix email configuration first (password reset), then database
URL format, then security keys.
