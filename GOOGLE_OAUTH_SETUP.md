# Google OAuth Setup Guide for Taaxdog

## Steps to Configure Google OAuth

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Create or Select a Project
- Click on the project dropdown at the top
- Create a new project named "Taaxdog" or select existing

### 3. Enable Google+ API
- Go to "APIs & Services" > "Library"
- Search for "Google+ API"
- Click "Enable"

### 4. Create OAuth 2.0 Credentials
1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure OAuth consent screen first:
   - Choose "External" for user type
   - Fill in required fields:
     - App name: "TaxReturnPro"
     - User support email: support@taxreturnpro.com.au
     - Developer contact: admin@taxreturnpro.com.au
   - Add scopes: email, profile, openid
   - Add test users if in development

### 5. Create OAuth Client ID
1. Application type: "Web application"
2. Name: "Taaxdog Web Client"
3. Authorized JavaScript origins:
   - Development: `http://localhost:3000`
   - Production: `https://taxreturnpro.com.au`
4. Authorized redirect URIs:
   - Development: `http://localhost:3000/api/auth/callback/google`
   - Production: `https://taxreturnpro.com.au/api/auth/callback/google`

### 6. Copy Credentials
After creation, you'll receive:
- Client ID: `[YOUR_CLIENT_ID].apps.googleusercontent.com`
- Client Secret: `[YOUR_CLIENT_SECRET]`

### 7. Update Environment Variables
Add to your `.env.local` file:
```
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

## Development Setup (Optional)

For development without real Google OAuth, you can:

1. Comment out the Google provider in `/lib/auth.ts`
2. Use only email/password authentication
3. Or use mock OAuth credentials (won't actually work but allows testing flow)

## Production Checklist

- [ ] Verify OAuth consent screen is approved
- [ ] Add production domain to authorized origins
- [ ] Add production callback URL to redirect URIs
- [ ] Ensure client secret is kept secure
- [ ] Test login flow in production environment

## Troubleshooting

### Common Issues:

1. **"redirect_uri_mismatch"**
   - Ensure callback URL exactly matches configured redirect URI
   - Check for trailing slashes
   - Verify protocol (http vs https)

2. **"Access blocked"**
   - OAuth consent screen needs to be published
   - For development, add test users

3. **"Invalid client"**
   - Verify client ID and secret are correct
   - Check for extra spaces or line breaks

## Security Notes

- Never commit OAuth credentials to version control
- Use environment variables for all sensitive data
- Rotate client secret if compromised
- Restrict OAuth app access to necessary scopes only