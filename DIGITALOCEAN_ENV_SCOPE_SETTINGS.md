# 🎯 DigitalOcean Environment Variable Scope Settings

## ⚠️ **Critical Information**

DigitalOcean App Platform has **3 scope options** for environment variables:

1. **BUILD_TIME** - Only available during build process
2. **RUN_TIME** - Only available when app is running
3. **RUN_AND_BUILD_TIME** - Available during both build and runtime ✅

## 🔧 **Required Scope Settings for Your Variables**

### **Authentication Variables (CRITICAL for Runtime)**

```
NEXTAUTH_SECRET      → RUN_AND_BUILD_TIME ✅
NEXTAUTH_URL         → RUN_AND_BUILD_TIME ✅
```

**Why**: These are needed during build for Next.js optimization AND at runtime
for authentication

### **Database Variables (CRITICAL for Runtime)**

```
DATABASE_URL         → RUN_AND_BUILD_TIME ✅
```

**Why**: Needed during build for Prisma generation AND at runtime for database
connections

### **Email Variables (CRITICAL for Runtime)**

```
SENDGRID_API_KEY     → RUN_TIME ✅
EMAIL_PROVIDER       → RUN_TIME ✅
EMAIL_FROM           → RUN_TIME ✅
```

**Why**: Only needed at runtime for sending emails (not during build)

### **Security Variables (CRITICAL for Runtime)**

```
FIELD_ENCRYPTION_KEY → RUN_TIME ✅
JWT_SECRET           → RUN_AND_BUILD_TIME ✅
```

## 📝 **How to Check/Change Scope in DigitalOcean**

### Step 1: Access Environment Variables

1. Go to: https://cloud.digitalocean.com/apps
2. Click your app → **Settings** → **App-Level Environment Variables**

### Step 2: Check Each Variable

1. **Click "Edit"** on each variable listed above
2. **Look for "Scope" dropdown**
3. **Change to the correct scope** as listed above
4. **Click "Save"**

### Step 3: Visual Example

```
Variable Name: NEXTAUTH_SECRET
Variable Value: [encrypted value]
Scope: RUN_AND_BUILD_TIME ← This is what you need to change!
☑️ Encrypt: [checked]
```

## 🚨 **Default Behavior Warning**

**DigitalOcean's default scope varies**:

- Some variables default to **BUILD_TIME** only
- Some default to **RUN_AND_BUILD_TIME**
- **You must manually verify each one!**

## 🔄 **After Changing Scopes**

1. **Save all changes**
2. **Click "Deploy"** to trigger a new deployment
3. **Wait 5-10 minutes** for deployment to complete
4. **Test login/password reset again**

## ✅ **Quick Verification Checklist**

**Check these variables have the CORRECT scope:**

- [ ] `NEXTAUTH_SECRET` → **RUN_AND_BUILD_TIME**
- [ ] `NEXTAUTH_URL` → **RUN_AND_BUILD_TIME**
- [ ] `DATABASE_URL` → **RUN_AND_BUILD_TIME**
- [ ] `SENDGRID_API_KEY` → **RUN_TIME**
- [ ] `EMAIL_PROVIDER` → **RUN_TIME**
- [ ] `EMAIL_FROM` → **RUN_TIME**
- [ ] `FIELD_ENCRYPTION_KEY` → **RUN_TIME**
- [ ] `JWT_SECRET` → **RUN_AND_BUILD_TIME**

## 🎯 **Why This Fixes Your Issue**

If login/password reset isn't working but build succeeds, it means:

1. **Build-time**: Variables available → Build works ✅
2. **Runtime**: Variables missing → Authentication fails ❌

Setting the correct scope ensures variables are available when your app actually
runs and tries to authenticate users or send emails.

## 📞 **Next Steps**

1. **Check the scope** of each variable above
2. **Change any that are wrong**
3. **Deploy** the app
4. **Test login/password reset** again

This should fix your runtime authentication issues! 🚀
