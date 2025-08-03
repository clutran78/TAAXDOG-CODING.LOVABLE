# 🔍 Runtime Debugging Guide - Login/Password Reset Issues

## 🎯 **Current Status**

- ✅ Database connection working (build time)
- ✅ SendGrid API key configured
- ❌ Login not working (runtime)
- ❌ Password reset not working (runtime)
- ❌ Runtime logs not showing details

## 🕵️ **Step-by-Step Debugging Process**

### **Step 1: Get Proper Runtime Logs**

#### Option A: Real-Time Log Monitoring

1. **Open DigitalOcean Dashboard** in one browser tab
2. **Go to**: Your App → Runtime Logs
3. **Keep this tab open and visible**
4. **In another tab**: Go to https://dev.taxreturnpro.com.au
5. **Try to login** while watching the Runtime Logs tab
6. **Look for any new log entries** that appear during login attempt

#### Option B: Check Different Log Sections

In DigitalOcean, check ALL log sections:

- **Runtime Logs** (main application logs)
- **Build Logs** (we know these work)
- **Deployment Logs**
- **Activity** tab for any deployment issues

### **Step 2: Browser Developer Tools Debugging**

1. **Open Developer Tools** (F12 or Right-click → Inspect)
2. **Go to Console tab**
3. **Go to Network tab**
4. **Try to login**
5. **Look for**:
   - Red errors in Console
   - Failed network requests (they'll be red in Network tab)
   - Any authentication-related errors

### **Step 3: Check Critical Runtime Environment Variables**

The following environment variables are critical at **runtime** (not just build
time):

```bash
# Authentication (CRITICAL)
NEXTAUTH_SECRET
NEXTAUTH_URL

# Database (CRITICAL)
DATABASE_URL

# Email (CRITICAL for password reset)
SENDGRID_API_KEY
EMAIL_PROVIDER
EMAIL_FROM
```

**ACTION**: In DigitalOcean, verify these are set as **RUN_AND_BUILD_TIME** (not
just BUILD_TIME).

### **Step 4: Test Specific Endpoints**

Try these direct API calls to isolate the issue:

#### Test 1: Health Check

Go to: `https://dev.taxreturnpro.com.au/api/health`

- **Expected**: Should return some status info
- **If 500 error**: Runtime environment issue

#### Test 2: NextAuth Configuration

Go to: `https://dev.taxreturnpro.com.au/api/auth/providers`

- **Expected**: Should return available auth providers
- **If error**: NextAuth configuration issue

#### Test 3: Database Connection Test

In browser console, try:

```javascript
fetch('/api/test-db')
  .then((r) => r.json())
  .then(console.log);
```

### **Step 5: Common Runtime Issues & Solutions**

#### Issue A: Environment Variables Not Available at Runtime

**Symptoms**: Build works, runtime fails **Solution**: In DigitalOcean, ensure
all variables are set to **RUN_AND_BUILD_TIME**

#### Issue B: NEXTAUTH_URL Mismatch

**Symptoms**: Login page loads but auth fails **Solution**: Verify
`NEXTAUTH_URL=https://dev.taxreturnpro.com.au` (exact match)

#### Issue C: Database Connection Pool Exhaustion

**Symptoms**: App starts then fails after few requests **Solution**: Check if
`DATABASE_URL` has connection pooling parameters

#### Issue D: Missing NEXTAUTH_SECRET

**Symptoms**: Auth completely broken **Solution**: Ensure `NEXTAUTH_SECRET` is
set and encrypted

### **Step 6: Force Verbose Logging**

Add these temporary environment variables in DigitalOcean to get more logs:

```bash
DEBUG=true
LOG_LEVEL=debug
NEXTAUTH_DEBUG=true
```

### **Step 7: Test Password Reset Specifically**

1. **Go to**: https://dev.taxreturnpro.com.au/forgot-password
2. **Enter email** and submit
3. **Check**:
   - Browser Network tab for API call to `/api/auth/forgot-password`
   - SendGrid Activity dashboard for email sending attempts
   - DigitalOcean Runtime Logs for any email-related errors

## 🚨 **Most Likely Issues**

Based on similar deployments, the most common causes are:

1. **Environment Variable Scope**: Variables set to BUILD_TIME only, not
   RUN_AND_BUILD_TIME
2. **NEXTAUTH_SECRET Missing**: Critical for session handling
3. **Database Connection at Runtime**: Different from build-time connection
4. **CORS Issues**: Browser blocking API calls

## 📞 **Next Steps**

Please try the steps above and share:

1. **Browser Console Errors** (if any)
2. **Network Tab Errors** (if any)
3. **Runtime Logs Output** (even if empty)
4. **Results of API endpoint tests**

This will help us pinpoint the exact issue! 🎯
