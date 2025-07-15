# SendGrid Quick Setup Reference

## 1. Get Your SendGrid API Key
1. Go to https://sendgrid.com/free/
2. Sign up → Verify email → Complete setup
3. Settings → API Keys → Create API Key
4. Name: "TaxReturnPro Production"
5. Permissions: "Full Access"
6. **COPY THE KEY IMMEDIATELY!** (Format: `SG.xxxxx...`)

## 2. Quick Sender Verification
1. Settings → Sender Authentication → Verify a Single Sender
2. Create New Sender:
   - From Name: `TaxReturnPro`
   - From Email: `noreply@taxreturnpro.com.au`
   - Reply To: `support@taxreturnpro.com.au`
3. Click verification link in email

## 3. Update DigitalOcean
1. Log in: https://cloud.digitalocean.com
2. Apps → taaxdog → Settings
3. App-Level Environment Variables → Edit
4. Update `SENDGRID_API_KEY` with your key (✓ Encrypt)
5. Save → Deploy

## 4. Test It
```bash
# Local test
export EMAIL_PROVIDER=sendgrid
export SENDGRID_API_KEY=SG.your-actual-key-here
npm run test-email your@email.com

# Production test
# Visit https://taxreturnpro.com.au/auth/login
# Click "Forgot password?" and test
```

## 5. Monitor
- SendGrid Dashboard: https://app.sendgrid.com → Activity
- DigitalOcean Logs: Your app → Runtime Logs

## Common Issues
- **401 Error**: Wrong API key
- **403 Error**: Sender not verified
- **No emails**: Check EMAIL_PROVIDER=sendgrid is set

## Support
- SendGrid Status: https://status.sendgrid.com
- SendGrid Docs: https://docs.sendgrid.com