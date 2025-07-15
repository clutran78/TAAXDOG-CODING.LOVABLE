# Production Deployment Checklist

## Pre-Deployment Setup

### 1. Gmail App Password (5 minutes)
- [ ] Go to https://myaccount.google.com/apppasswords
- [ ] Enable 2-Step Verification if needed
- [ ] Generate app password for "Mail"
- [ ] Copy the 16-character password

### 2. Generate Security Keys (2 minutes)
```bash
# Generate SECRET_KEY
openssl rand -base64 32

# Generate JWT_SECRET_KEY (run again for different key)
openssl rand -base64 32
```

### 3. Update Local .env File
- [ ] Replace `your-email@gmail.com` with actual Gmail
- [ ] Replace `your-app-specific-password` with app password (4 places)
- [ ] Update SECRET_KEY with generated key
- [ ] Update JWT_SECRET_KEY with generated key

## DigitalOcean Configuration

### 4. Add Environment Variables
Go to DigitalOcean App Platform → Settings → Environment Variables

Add these variables (mark sensitive ones as "Encrypted"):

**Email Variables:**
- [ ] `EMAIL_FROM`: noreply@taxreturnpro.com.au
- [ ] `EMAIL_HOST`: smtp.gmail.com
- [ ] `EMAIL_PORT`: 587
- [ ] `EMAIL_USER`: [Your Gmail] 
- [ ] `EMAIL_PASSWORD`: [App Password] ⚠️ Encrypt
- [ ] `SMTP_HOST`: smtp.gmail.com
- [ ] `SMTP_PORT`: 587
- [ ] `SMTP_USER`: [Your Gmail]
- [ ] `SMTP_PASS`: [App Password] ⚠️ Encrypt
- [ ] `SMTP_SECURE`: false

**Security Variables:**
- [ ] `SECRET_KEY`: [Generated Key] ⚠️ Encrypt
- [ ] `JWT_SECRET_KEY`: [Generated Key] ⚠️ Encrypt
- [ ] `CORS_ORIGINS`: https://taxreturnpro.com.au

### 5. Deploy Application
- [ ] Click "Deploy" in DigitalOcean
- [ ] Wait for deployment to complete (5-10 minutes)

## Post-Deployment Testing

### 6. Test Core Features
- [ ] Create a new user account
- [ ] Login with email/password
- [ ] Test "Forgot Password" - should receive email
- [ ] Reset password using email link

### 7. Test AI Features
- [ ] Login to dashboard
- [ ] Test AI chat for financial questions
- [ ] Ask about tax deductions
- [ ] Test receipt scanning

### 8. Test Banking Integration
- [ ] Connect a test bank account
- [ ] Verify transactions appear

## Troubleshooting

### If Password Reset Emails Don't Send:
1. Check DigitalOcean logs for errors
2. Verify Gmail app password is correct
3. Check if Gmail has blocked the login (check Gmail security alerts)

### If AI Features Don't Work:
1. Check Flask backend is running
2. Verify SECRET_KEY and JWT_SECRET_KEY are set
3. Check CORS_ORIGINS includes your domain

### Common Issues:
- Gmail blocks: Use app password, not regular password
- CORS errors: Ensure CORS_ORIGINS is set correctly
- 500 errors: Check all required env variables are set

## Security Notes
- Never commit .env file to Git
- Always encrypt sensitive values in DigitalOcean
- Rotate keys periodically
- Monitor failed login attempts in logs