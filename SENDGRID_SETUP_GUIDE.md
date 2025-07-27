# SendGrid Email Configuration Guide for TaxReturnPro

## Overview

This guide will help you set up SendGrid as your email provider for
TaxReturnPro. SendGrid offers better deliverability, detailed analytics, and
easier configuration compared to traditional SMTP services.

## Prerequisites

- A SendGrid account (sign up at https://sendgrid.com)
- Access to your domain's DNS settings
- Access to DigitalOcean App Platform

## Step 1: Create SendGrid Account and API Key

1. **Sign up for SendGrid**
   - Go to https://sendgrid.com/free/
   - Create an account (free tier includes 100 emails/day)

2. **Complete SendGrid Setup**
   - Verify your email address
   - Complete the account setup wizard

3. **Generate API Key**
   - Go to Settings → API Keys
   - Click "Create API Key"
   - Give it a name: "TaxReturnPro Production"
   - Select "Full Access" permissions
   - Click "Create & View"
   - **IMPORTANT**: Copy the API key immediately (you won't see it again)

## Step 2: Configure Sender Authentication

### Option A: Domain Authentication (Recommended)

This proves you own the domain and improves deliverability.

1. **Start Domain Authentication**
   - Go to Settings → Sender Authentication
   - Click "Authenticate Your Domain"
   - Enter your domain: `taxreturnpro.com.au`
   - Choose your DNS provider
   - Select "No" for branding links

2. **Add DNS Records** SendGrid will provide several DNS records. Add these to
   your domain:

   ```
   Type: CNAME
   Name: em1234.taxreturnpro.com.au
   Value: u1234567.wl123.sendgrid.net

   Type: CNAME
   Name: s1._domainkey.taxreturnpro.com.au
   Value: s1.domainkey.u1234567.wl123.sendgrid.net

   Type: CNAME
   Name: s2._domainkey.taxreturnpro.com.au
   Value: s2.domainkey.u1234567.wl123.sendgrid.net
   ```

3. **Verify Domain**
   - After adding DNS records, click "Verify"
   - DNS propagation may take up to 48 hours

### Option B: Single Sender Verification (Quick Start)

Use this to start sending emails immediately while setting up domain
authentication.

1. Go to Settings → Sender Authentication → Single Sender Verification
2. Click "Create New Sender"
3. Fill in:
   - From Name: `TaxReturnPro`
   - From Email: `noreply@taxreturnpro.com.au`
   - Reply To: `support@taxreturnpro.com.au`
   - Company Address: Your business address
4. Click "Create"
5. Verify the email sent to noreply@taxreturnpro.com.au

## Step 3: Configure DigitalOcean Environment Variables

### Via Web Console:

1. Log in to DigitalOcean
2. Go to Apps → taaxdog → Settings
3. Click "Edit" on Environment Variables
4. Update/Add these variables:
   - `EMAIL_PROVIDER` = `sendgrid`
   - `SENDGRID_API_KEY` = `your-sendgrid-api-key` (mark as encrypted)
   - `EMAIL_FROM` = `noreply@taxreturnpro.com.au`
5. Remove old SMTP variables (optional)
6. Save and Deploy

### Via Git (Already configured):

The `digitalocean-app-spec.yaml` has been updated. Just replace
`YOUR_SENDGRID_API_KEY` with your actual key:

```bash
# Edit the file
nano digitalocean-app-spec.yaml

# Find and replace YOUR_SENDGRID_API_KEY

# Commit and push
git add digitalocean-app-spec.yaml
git commit -m "Configure SendGrid email provider"
git push origin main
```

## Step 4: Test Email Functionality

1. **Test in Development**

   ```bash
   # Set environment variables
   export EMAIL_PROVIDER=sendgrid
   export SENDGRID_API_KEY=your-api-key
   export EMAIL_FROM=noreply@taxreturnpro.com.au

   # Run development server
   npm run dev
   ```

2. **Test Password Reset**
   - Go to /auth/login
   - Click "Forgot password?"
   - Enter an email address
   - Check inbox

3. **Monitor SendGrid Dashboard**
   - Go to SendGrid Activity Feed
   - You should see the email activity
   - Check for any bounces or blocks

## Step 5: Configure Email Templates (Optional)

SendGrid supports dynamic templates for consistent branding:

1. Go to Email API → Dynamic Templates
2. Create a new template
3. Design your email template
4. Get the template ID
5. Update the code to use template IDs (future enhancement)

## Troubleshooting

### Email not sending:

1. Check SendGrid Activity feed for errors
2. Verify API key is correct
3. Check sender authentication status
4. Review DigitalOcean logs

### Common SendGrid Errors:

- **401**: Invalid API key
- **403**: Sender not verified
- **413**: Email too large (limit 30MB)
- **429**: Rate limit exceeded

### Checking Logs in DigitalOcean:

```bash
# Via CLI
doctl apps logs <APP_ID> --type=run

# Or check Runtime Logs in web console
```

## SendGrid Best Practices

1. **Warm up your IP**: Start with low volume and gradually increase
2. **Monitor your sender reputation**: Check SendGrid's dashboard regularly
3. **Handle bounces**: Implement webhook handlers for bounce management
4. **Use categories**: Tag emails for better analytics
5. **Implement unsubscribe**: Required by law in many jurisdictions

## Fallback to SMTP

The email system supports fallback to SMTP. To use Gmail SMTP instead:

1. Set `EMAIL_PROVIDER` to `smtp` or remove it
2. Configure SMTP variables:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = your Gmail address
   - `SMTP_PASS` = Gmail app password
   - `SMTP_SECURE` = `false`

## Cost Considerations

- **Free tier**: 100 emails/day forever
- **Essentials**: $19.95/month for 50,000 emails
- **Pro**: $89.95/month for 100,000 emails + advanced features

## Security Notes

1. **API Key Security**:
   - Never commit API keys to git
   - Always use environment variables
   - Rotate keys periodically

2. **Domain Security**:
   - Implement SPF, DKIM, and DMARC
   - Monitor for spoofing attempts

3. **Email Content**:
   - Never send sensitive data in emails
   - Use secure links with tokens for password resets

## Support Resources

- SendGrid Documentation: https://docs.sendgrid.com
- Status Page: https://status.sendgrid.com
- Support: https://support.sendgrid.com

## Next Steps

1. Set up webhook endpoints for tracking email events
2. Implement email analytics dashboard
3. Create branded email templates
4. Set up IP warming schedule
5. Configure suppression lists
