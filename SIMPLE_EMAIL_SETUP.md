# Simple Email Setup for Password Reset

## Quick Setup (5 minutes)

### Step 1: Get a Gmail App Password
1. Go to https://myaccount.google.com/security
2. Turn on 2-Step Verification (if not already on)
3. Search for "App passwords" in the search box
4. Click "App passwords"
5. Select "Mail" and "Other (custom name)"
6. Name it "TaxReturnPro"
7. Copy the 16-character password shown

### Step 2: Update Your .env File
Replace these lines in your `.env` file:
```
EMAIL_USER=your-actual-gmail@gmail.com
EMAIL_PASSWORD=xxxx-xxxx-xxxx-xxxx
```
(Put the 16-character password without spaces)

### Step 3: Update DigitalOcean (For Production)
Add these same values as environment variables in DigitalOcean App Platform.

## That's It!

Now users can:
- Create accounts ✅
- Login with email/password ✅
- Reset forgotten passwords ✅
- Connect bank accounts ✅

## Alternative: No Email Setup

If you don't want to set up email at all:
- Everything still works except password reset
- Users would need to contact you to reset passwords
- Just leave the EMAIL_USER and EMAIL_PASSWORD as placeholders

## Note
- You do NOT need Flask backend configuration for basic functionality
- The SECRET_KEY and JWT_SECRET_KEY in .env are only for the Python backend (AI features)
- Core features (login, signup, banking) work without them