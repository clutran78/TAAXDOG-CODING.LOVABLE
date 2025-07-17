# Production Email Setup Guide

## Overview
The authentication system is designed to work with or without a configured email provider. When an email provider is not properly configured, the system will:
- Allow user registration and login without email verification
- Log email content to console in development
- Gracefully handle missing email configuration in production

## Configuration Steps

### 1. DigitalOcean App Platform Setup

Add the following environment variable to your DigitalOcean App:

```bash
SENDGRID_API_KEY=SG.your-actual-sendgrid-api-key-here
```

You can do this through:
- DigitalOcean App Platform Dashboard > Settings > Environment Variables
- Or using the DigitalOcean CLI:
  ```bash
  doctl apps update YOUR-APP-ID --spec .do/app.yaml
  ```

### 2. SendGrid Setup

1. Create a SendGrid account at https://sendgrid.com
2. Generate an API key with "Mail Send" permissions
3. The API key should start with "SG."
4. Add the key to DigitalOcean (see step 1)

### 3. Email Configuration Options

The system supports three email providers:

#### SendGrid (Recommended for Production)
```env
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your-api-key-here
EMAIL_FROM=noreply@taxreturnpro.com.au
```

#### SMTP (Alternative)
```env
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_SECURE=false
```

#### Console (Development Only)
```env
EMAIL_PROVIDER=console
```

## Behavior by Environment

### Development Mode
- Email verification is NOT required
- Emails are logged to console if no provider is configured
- Users can login immediately after registration

### Production Mode
- Email verification is required ONLY if email provider is properly configured
- If no valid email provider is found, users can login without verification
- System checks for valid SendGrid API key format (must start with "SG.")

## Testing Production Configuration

1. Check email provider status:
   ```bash
   curl https://taxreturnpro.com.au/api/auth/email-status
   ```

2. Test with the provided script:
   ```bash
   NODE_ENV=production node test-production-mode.js
   ```

## Troubleshooting

### "Invalid SendGrid API key format"
- Ensure your API key starts with "SG."
- Check that the environment variable is properly set in DigitalOcean

### Users can't receive emails
1. Verify SendGrid API key is valid
2. Check SendGrid dashboard for bounce/spam reports
3. Ensure EMAIL_FROM domain is verified in SendGrid

### Email verification not enforced
- This is expected behavior when no email provider is configured
- Add a valid SendGrid API key to enforce email verification

## Security Considerations

1. Never commit API keys to version control
2. Use DigitalOcean's encrypted environment variables
3. Regularly rotate API keys
4. Monitor SendGrid for unusual activity

## Support

For issues with:
- SendGrid: Check their status page and documentation
- DigitalOcean: Use their support channels
- Application: Check logs in DigitalOcean App Platform dashboard