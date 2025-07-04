# Security Configuration Guide

## 🚨 CRITICAL SECURITY NOTICE

This repository previously contained exposed credentials that have been removed. **ALL exposed credentials must be rotated immediately**.

## Credential Rotation Checklist

### Immediate Actions Required:

1. **Database Credentials**
   - [ ] Rotate all database passwords in DigitalOcean
   - [ ] Update connection strings in environment variables
   - [ ] Rotate droplet passwords

2. **API Keys**
   - [ ] Regenerate NextAuth secret
   - [ ] Rotate Stripe API keys (both test and live)
   - [ ] Regenerate Anthropic API key
   - [ ] Regenerate OpenRouter API key
   - [ ] Regenerate Gemini API key
   - [ ] Regenerate BASIQ API key

3. **Other Credentials**
   - [ ] Update any webhook secrets
   - [ ] Rotate health check tokens
   - [ ] Update email service passwords

## Setting Up Environment Variables

### Development Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual credentials in `.env`

3. Never commit `.env` to version control

### Production Setup

1. Use DigitalOcean's environment variable management
2. Set all sensitive values as encrypted environment variables
3. Reference them in `app.yaml` using `${VARIABLE_NAME}` syntax

## Security Best Practices

1. **Never hardcode credentials** in source code
2. **Use environment variables** for all sensitive data
3. **Rotate credentials regularly**
4. **Use different credentials** for development and production
5. **Enable 2FA** on all service accounts
6. **Monitor for unauthorized access**
7. **Use least privilege principle** for all API keys

## Files That Should Never Be Committed

- `.env`
- `.env.*` (except `.env.example`)
- `app.yaml` (use `app.yaml.example` instead)
- Any file containing real credentials

## Git History Cleanup

If credentials were previously committed, clean git history:

```bash
# Remove sensitive files from history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env app.yaml production.env" \
  --prune-empty --tag-name-filter cat -- --all

# Force push to remote (coordinate with team)
git push origin --force --all
git push origin --force --tags
```

## Monitoring

1. Set up alerts for:
   - Failed authentication attempts
   - Unusual API usage patterns
   - Database connection failures

2. Regular security audits:
   - Review access logs
   - Check for exposed credentials
   - Validate API key permissions

## Contact

If you discover any security issues, please contact the security team immediately.