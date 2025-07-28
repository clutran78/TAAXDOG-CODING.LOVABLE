# Deployment Guide

## Production Deployment
- **Domain**: https://taxreturnpro.com.au
- **Config**: app.yaml
- **Command**: Deploy through DigitalOcean dashboard using app.yaml

## Development/Staging Deployment
- **Domain**: https://dev.taxreturnpro.com.au
- **Config**: app-dev.yaml
- **Command**: Deploy through DigitalOcean dashboard using app-dev.yaml

## Key Differences

### Production (app.yaml)
- NEXTAUTH_URL: https://taxreturnpro.com.au
- COMPLIANCE_TEST_MODE: false
- Primary domain: taxreturnpro.com.au

### Development (app-dev.yaml)
- NEXTAUTH_URL: https://dev.taxreturnpro.com.au
- COMPLIANCE_TEST_MODE: true
- Primary domain: dev.taxreturnpro.com.au

## Important Notes

1. **Domain Configuration**: The NEXTAUTH_URL must match the domain being accessed. If you get a 400 Bad Request error, it's likely because the domain doesn't match the configuration.

2. **Build Command**: Both configurations use the custom build command with polyfills:
   ```
   npm ci && npx prisma generate && npm run build:do
   ```

3. **Environment Variables**: Most environment variables are shared, but URLs and domains differ between environments.

## Troubleshooting

### 400 Bad Request Error
- Check that the domain you're accessing matches the NEXTAUTH_URL in the deployment
- Verify the domain is configured in the DigitalOcean app settings
- Ensure the app.yaml domains section includes the domain you're trying to access

### Build Failures
- Check the build logs in DigitalOcean
- Verify all environment variables are set
- Ensure the database is accessible from the deployment region