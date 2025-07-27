# Step-by-Step Setup Guide for TaxReturnPro

This guide will walk you through setting up your app in about 10-15 minutes.

## Step 1: Get Gmail App Password (5 minutes)

### 1.1 Open Gmail Security Settings

- Open your browser and go to: https://myaccount.google.com/security
- Sign in with the Gmail account you want to use for sending emails

### 1.2 Enable 2-Step Verification (if not already enabled)

- Look for "2-Step Verification" in the security section
- If it says "Off", click on it and follow the setup:
  - Click "Get started"
  - Enter your phone number
  - Choose text or call
  - Enter the code you receive
  - Click "Turn on"

### 1.3 Generate App Password

- Go back to Security page: https://myaccount.google.com/security
- In the search box at the top, type "App passwords" and press Enter
- Click on "App passwords" when it appears
- You might need to sign in again
- Under "Select app", choose "Mail"
- Under "Select device", choose "Other (custom name)"
- Type "TaxReturnPro" as the name
- Click "Generate"
- **IMPORTANT**: A 16-character password will appear like: `abcd efgh ijkl mnop`
- Copy this password immediately (you won't see it again)

## Step 2: Generate Security Keys (2 minutes)

### 2.1 Open Terminal

- On Mac: Press `Cmd + Space`, type "Terminal", press Enter
- On Windows: Press `Windows + R`, type "cmd", press Enter

### 2.2 Generate First Key (SECRET_KEY)

Copy and paste this command:

```bash
openssl rand -base64 32
```

Press Enter. You'll see something like:

```
Fk3Rz8Jb9Qa2Wx5Cv6Nm1Po4Iu7Yt0Re3Ws2Xd5Fg8H=
```

Copy this entire line (this is your SECRET_KEY)

### 2.3 Generate Second Key (JWT_SECRET_KEY)

Run the same command again:

```bash
openssl rand -base64 32
```

You'll get a different key like:

```
Lm9Kn8Jh7Gf6Ds5Az4Sx3Dc2Vb1Nm0Po9Iu8Yt7Re6W=
```

Copy this entire line (this is your JWT_SECRET_KEY)

## Step 3: Update Your .env File (3 minutes)

### 3.1 Open the .env file

- In your code editor (VS Code), open the file: `.env`
- Or navigate to your project folder and open `.env` with any text editor

### 3.2 Replace Email Settings

Find these lines:

```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password
```

Replace with your actual values:

```
EMAIL_USER=youractual@gmail.com
EMAIL_PASSWORD=abcdefghijklmnop
```

(Use the 16-character app password WITHOUT spaces)

### 3.3 Update SMTP Settings

Find these lines:

```
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
```

Replace with the SAME values:

```
SMTP_USER=youractual@gmail.com
SMTP_PASS=abcdefghijklmnop
```

### 3.4 Update Security Keys

Find these lines:

```
SECRET_KEY=dev-secret-key-change-in-production
JWT_SECRET_KEY=dev-jwt-secret-change-in-production
```

Replace with your generated keys:

```
SECRET_KEY=Fk3Rz8Jb9Qa2Wx5Cv6Nm1Po4Iu7Yt0Re3Ws2Xd5Fg8H=
JWT_SECRET_KEY=Lm9Kn8Jh7Gf6Ds5Az4Sx3Dc2Vb1Nm0Po9Iu8Yt7Re6W=
```

### 3.5 Save the File

- Press `Ctrl+S` (Windows) or `Cmd+S` (Mac) to save

## Step 4: Add to DigitalOcean (5 minutes)

### 4.1 Open DigitalOcean

- Go to: https://cloud.digitalocean.com/apps
- Click on your app "taaxdog"

### 4.2 Navigate to Environment Variables

- Click on "Settings" tab
- Scroll down to "App-Level Environment Variables"
- Click "Edit" or "Manage Environment Variables"

### 4.3 Add Email Variables

Click "+ Add Variable" for each of these:

1. **EMAIL_FROM**
   - Key: `EMAIL_FROM`
   - Value: `noreply@taxreturnpro.com.au`
   - ☐ Encrypt (don't check)

2. **EMAIL_HOST**
   - Key: `EMAIL_HOST`
   - Value: `smtp.gmail.com`
   - ☐ Encrypt (don't check)

3. **EMAIL_PORT**
   - Key: `EMAIL_PORT`
   - Value: `587`
   - ☐ Encrypt (don't check)

4. **EMAIL_USER**
   - Key: `EMAIL_USER`
   - Value: `youractual@gmail.com`
   - ☑ Encrypt (CHECK this box)

5. **EMAIL_PASSWORD**
   - Key: `EMAIL_PASSWORD`
   - Value: `abcdefghijklmnop` (your 16-char password without spaces)
   - ☑ Encrypt (CHECK this box)

6. **SMTP_HOST**
   - Key: `SMTP_HOST`
   - Value: `smtp.gmail.com`
   - ☐ Encrypt (don't check)

7. **SMTP_PORT**
   - Key: `SMTP_PORT`
   - Value: `587`
   - ☐ Encrypt (don't check)

8. **SMTP_USER**
   - Key: `SMTP_USER`
   - Value: `youractual@gmail.com`
   - ☑ Encrypt (CHECK this box)

9. **SMTP_PASS**
   - Key: `SMTP_PASS`
   - Value: `abcdefghijklmnop` (same password)
   - ☑ Encrypt (CHECK this box)

10. **SMTP_SECURE**
    - Key: `SMTP_SECURE`
    - Value: `false`
    - ☐ Encrypt (don't check)

### 4.4 Add Security Variables

11. **SECRET_KEY**
    - Key: `SECRET_KEY`
    - Value: `Fk3Rz8Jb9Qa2Wx5Cv6Nm1Po4Iu7Yt0Re3Ws2Xd5Fg8H=` (your generated key)
    - ☑ Encrypt (CHECK this box)

12. **JWT_SECRET_KEY**
    - Key: `JWT_SECRET_KEY`
    - Value: `Lm9Kn8Jh7Gf6Ds5Az4Sx3Dc2Vb1Nm0Po9Iu8Yt7Re6W=` (your generated key)
    - ☑ Encrypt (CHECK this box)

13. **CORS_ORIGINS**
    - Key: `CORS_ORIGINS`
    - Value: `https://taxreturnpro.com.au`
    - ☐ Encrypt (don't check)

### 4.5 Save and Deploy

- Click "Save" at the bottom
- Click "Deploy" button
- Wait 5-10 minutes for deployment to complete

## Step 5: Test Everything (5 minutes)

### 5.1 Test Password Reset

1. Go to https://taxreturnpro.com.au/auth/login
2. Click "Forgot Password?"
3. Enter an email address
4. Check your email - you should receive a reset link
5. If you don't get an email within 2 minutes, check spam folder

### 5.2 Test User Registration

1. Go to https://taxreturnpro.com.au/auth/register
2. Create a new account
3. Login with your credentials

### 5.3 Test AI Features

1. After logging in, go to the dashboard
2. Try asking the AI: "What tax deductions can I claim?"
3. The AI should respond with financial advice

## Troubleshooting

### If emails don't send:

1. Check Gmail security alerts (you might need to approve the app)
2. Make sure you used the app password, not your regular Gmail password
3. Check DigitalOcean logs: Apps → your app → Runtime Logs

### If AI doesn't work:

1. Make sure all 13 environment variables are added
2. Check that SECRET_KEY and JWT_SECRET_KEY are different values
3. Verify CORS_ORIGINS is exactly: `https://taxreturnpro.com.au`

### Common Mistakes:

- Using Gmail password instead of app password
- Including spaces in the app password
- Not encrypting sensitive variables in DigitalOcean
- Using http instead of https in CORS_ORIGINS

## Success Checklist

- ✅ Users can create accounts
- ✅ Users can reset passwords via email
- ✅ AI chat responds to financial questions
- ✅ Banking connections work
- ✅ Receipt scanning works

Congratulations! Your app is now fully configured with all features working.
