# DigitalOcean App Platform Deployment Guide

## Important Note

The `app.yaml` file should **NOT** be committed to the repository as it may contain sensitive configuration. Instead, configure your app directly through DigitalOcean's dashboard or CLI.

## Configuration Methods

### Method 1: Using DigitalOcean Dashboard (Recommended)

1. **Access your app** at https://cloud.digitalocean.com/apps
2. **Click on your app** (Taaxdog-coding)
3. **Go to Settings** → **App-Level Environment Variables**
4. **Add/Update environment variables** with the following:
   - Click "Edit" next to each variable
   - For sensitive values, check the "Encrypt" checkbox
   - This will generate an `EV[...]` encrypted value that DigitalOcean uses

### Method 2: Using DigitalOcean CLI

1. **Install doctl** (DigitalOcean CLI):
   ```bash
   brew install doctl  # macOS
   # or download from https://docs.digitalocean.com/reference/doctl/how-to/install/
   ```

2. **Authenticate**:
   ```bash
   doctl auth init
   ```

3. **Get your app ID**:
   ```bash
   doctl apps list
   ```

4. **Update app spec**:
   ```bash
   # Export current spec
   doctl apps spec get YOUR_APP_ID > app-spec.yaml
   
   # Edit the spec file with your environment variables
   # For secrets, use the DigitalOcean dashboard to encrypt them first
   
   # Update the app
   doctl apps update YOUR_APP_ID --spec app-spec.yaml
   ```

## Environment Variables Configuration

### Required Variables

All sensitive values should be encrypted using DigitalOcean's encryption feature:

1. **Authentication**:
   - `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
   - `JWT_SECRET_KEY` - Generate with `openssl rand -base64 32`
   - `GOOGLE_CLIENT_ID` - From Google Cloud Console
   - `GOOGLE_CLIENT_SECRET` - From Google Cloud Console

2. **Database**:
   - `DATABASE_URL` - PostgreSQL connection string
   - `DATABASE_POOLING_URL` - Connection pooler URL

3. **Stripe**:
   - `STRIPE_SECRET_KEY` - From Stripe dashboard
   - `STRIPE_WEBHOOK_SECRET` - From Stripe webhook settings
   - `STRIPE_PUBLISHABLE_KEY` - From Stripe dashboard
   - Price IDs for subscription plans

4. **AI Services**:
   - `ANTHROPIC_API_KEY` - From Anthropic console
   - `OPENROUTER_API_KEY` - From OpenRouter
   - `GEMINI_API_KEY` - From Google AI Studio

5. **Other Services**:
   - `SENDGRID_API_KEY` - From SendGrid
   - `BASIQ_API_KEY` - From Basiq
   - `FIELD_ENCRYPTION_KEY` - Generate with `openssl rand -hex 32`

### Non-Sensitive Variables

These can be set as plain text:

- `NODE_ENV`: "production"
- `PORT`: "3000"
- `NEXTAUTH_URL`: "https://taxreturnpro.com.au"
- `BASIQ_SERVER_URL`: "https://au-api.basiq.io"
- Feature flags (FEATURE_AI_ENABLED, etc.): "true" or "false"

## Build Configuration

Ensure your app spec includes:

```yaml
build_command: npm install --production=false && npx prisma generate && npm run build
run_command: npm start
```

## Deployment Process

1. **Push code to main branch**:
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

2. **DigitalOcean will automatically**:
   - Detect the push (if deploy_on_push is true)
   - Run the build command
   - Deploy the new version

3. **Monitor deployment**:
   - Check the Activity tab in DigitalOcean dashboard
   - View build logs for any errors
   - Ensure all environment variables are properly set

## Troubleshooting

### Common Issues

1. **"Module not found" errors**: 
   - Ensure `npm install --production=false` in build command
   - Check that all dependencies are in package.json

2. **"self is not defined" errors**:
   - Already fixed with polyfills in the codebase
   - Ensure latest code is deployed

3. **Database connection errors**:
   - Verify DATABASE_URL is correctly encrypted and set
   - Check if database allows connections from App Platform

4. **Environment variable issues**:
   - Use DigitalOcean dashboard to verify all variables are set
   - Check if sensitive values are properly encrypted (EV[...] format)
   - Ensure scope is set to RUN_AND_BUILD_TIME for build-time variables

### Viewing Logs

```bash
# Using CLI
doctl apps logs YOUR_APP_ID --type=build  # Build logs
doctl apps logs YOUR_APP_ID --type=run    # Runtime logs

# Or use the dashboard
# Apps → Your App → Runtime Logs / Build Logs
```

## Security Best Practices

1. **Never commit sensitive values** to the repository
2. **Use encrypted environment variables** for all secrets
3. **Rotate keys regularly** and update in DigitalOcean dashboard
4. **Limit access** to your DigitalOcean team members
5. **Use separate keys** for development and production

## Reference

- **Template file**: `app.yaml.template` (for structure reference)
- **DigitalOcean Docs**: https://docs.digitalocean.com/products/app-platform/
- **Support**: Contact DigitalOcean support for platform-specific issues