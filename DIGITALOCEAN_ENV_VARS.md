# DigitalOcean Environment Variables to Add

The following environment variables need to be added to your DigitalOcean App
Platform configuration:

## Email Configuration (Required for password reset functionality)

- `EMAIL_FROM`: noreply@taxreturnpro.com.au
- `EMAIL_HOST`: smtp.gmail.com
- `EMAIL_PORT`: 587
- `EMAIL_USER`: [Your Gmail address - e.g., noreply@yourdomain.com]
- `EMAIL_PASSWORD`: [Your Gmail app-specific password - NOT your regular
  password]

## Flask Backend Configuration (If using Flask backend)

- `SECRET_KEY`: [Generate a secure secret key for production]
- `JWT_SECRET_KEY`: [Generate a secure JWT secret for production]
- `CORS_ORIGINS`: https://taxreturnpro.com.au

## How to Add These Variables

1. Go to your DigitalOcean App Platform dashboard
2. Select your app "taaxdog"
3. Go to Settings → App-Level Environment Variables
4. Add each variable with the appropriate scope (RUN_AND_BUILD_TIME)
5. For sensitive values like passwords and keys, use the "Encrypt" option

## Gmail App Password Setup

1. Go to your Google Account settings (myaccount.google.com)
2. Navigate to Security → 2-Step Verification (must be enabled)
3. At the bottom, click "App passwords"
4. Select "Mail" as the app and your device
5. Copy the generated 16-character password
6. Use this password for `EMAIL_PASSWORD` (without spaces)

## Important Notes

- The app now uses PostgreSQL (database connection already configured)
- No Firebase configuration needed - the app has been migrated to PostgreSQL
- Generate strong, unique secrets for production use (use
  `openssl rand -base64 32`)
- For production, consider using email services like SendGrid or AWS SES instead
  of Gmail
- CORS_ORIGINS should only include your production domain for security

After adding these variables, redeploy your application for the changes to take
effect.
