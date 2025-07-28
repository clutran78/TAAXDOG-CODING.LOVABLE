# Fix for 400 Bad Request Error on dev.taxreturnpro.com.au

## Root Cause
The 400 Bad Request error is occurring because:
1. You're accessing the app via `dev.taxreturnpro.com.au`
2. But NEXTAUTH_URL is set to `https://taxreturnpro.com.au`
3. NextAuth rejects requests when the domain doesn't match

## Immediate Fix (Do this in DigitalOcean Dashboard)

### Option 1: Update Environment Variables
1. Go to your DigitalOcean App Platform dashboard
2. Click on your app "Taaxdog-coding"
3. Go to Settings → Environment Variables
4. Update these variables:
   - NEXTAUTH_URL: Change from `https://taxreturnpro.com.au` to `https://dev.taxreturnpro.com.au`
   - NEXT_PUBLIC_API_URL: Change from `https://taxreturnpro.com.au` to `https://dev.taxreturnpro.com.au`
5. Click "Save" and then "Deploy" to redeploy with new settings

### Option 2: Access via Production Domain
Simply access the app using: `https://taxreturnpro.com.au`
(This will work immediately without any changes)

## Long-term Solution

### For Development Environment
1. Create a separate app in DigitalOcean using `app-dev.yaml`
2. This will have all the correct settings for dev.taxreturnpro.com.au
3. Deploy command: Upload app-dev.yaml in DigitalOcean dashboard

### For Production Environment
Keep the current app with app.yaml for production use at taxreturnpro.com.au

## Verification Steps
After making changes:
1. Wait for deployment to complete (5-10 minutes)
2. Clear browser cache
3. Access https://dev.taxreturnpro.com.au

## Additional Notes
- The latest code changes (commit 9b1a815) added dev.taxreturnpro.com.au to domains
- But environment variables in DigitalOcean override the code settings
- That's why you need to update them in the dashboard