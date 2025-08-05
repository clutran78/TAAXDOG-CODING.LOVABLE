# 🚀 DigitalOcean to Supabase Migration Guide

This guide helps you migrate your database from DigitalOcean to Supabase, working around network restrictions.

## 🎯 Migration Strategy

Since DigitalOcean databases block external connections, we'll use your deployed app to export the database, then import it to Supabase.

## 📋 Prerequisites

- ✅ PostgreSQL client tools (already installed)
- ✅ Access to your DigitalOcean app
- 🔲 New Supabase project (create below)

## Step 1: Create Supabase Project

1. **Go to**: https://supabase.com/
2. **Click**: "New Project"
3. **Fill in**:
   - Organization: Your account
   - Project name: `taaxdog-production`
   - Database password: Create a strong password (save this!)
   - Region: Choose closest to your users (e.g., Australia Southeast)
4. **Click**: "Create new project"
5. **Wait**: 2-3 minutes for project setup

## Step 2: Get Supabase Database Credentials

1. **In Supabase dashboard**, go to: Settings → Database
2. **Copy the connection string** under "Connection string" → "Nodejs"
3. **Replace `[YOUR-PASSWORD]`** with the password you created
4. **Save this URL** - you'll need it later

Example format:
```
postgresql://postgres.xxxxxxxxxxxxxxxxxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres
```

## Step 3: Deploy Export Endpoint

The migration scripts are already created. You need to deploy them:

1. **Set environment variable** in DigitalOcean:
   ```
   ADMIN_EXPORT_TOKEN=your-secure-random-token-here
   ALLOW_DB_EXPORT=true
   ```

2. **Deploy your app** with the new export endpoint

## Step 4: Run Migration

1. **Set environment variables locally**:
   ```bash
   export ADMIN_EXPORT_TOKEN="your-secure-random-token-here"
   export SUPABASE_DATABASE_URL="your-supabase-connection-string"
   export NEXTAUTH_URL="https://dev.taxreturnpro.com.au"
   ```

2. **Run the migration script**:
   ```bash
   npx tsx scripts/migrate-to-supabase.ts
   ```

This script will:
- ✅ Download database export from your deployed app
- ✅ Restore it to Supabase
- ✅ Update your local `.env.local` file

## Step 5: Update Production Environment

1. **In DigitalOcean App Platform**:
   - Go to: Settings → App-Level Environment Variables
   - Update `DATABASE_URL` to your Supabase connection string
   - Remove `ALLOW_DB_EXPORT` (security)
   - Keep `ADMIN_EXPORT_TOKEN` for future use

2. **Deploy** your app with the new database URL

## Step 6: Verify Migration

1. **Test locally**:
   ```bash
   npm run dev
   ```

2. **Test functionality**:
   - ✅ User login
   - ✅ Password reset
   - ✅ Data creation/reading
   - ✅ All core features

3. **Test production** after deployment

## 🔧 Alternative Method: Manual Commands

If the automated script doesn't work, use these manual commands:

### Download Export
```bash
curl -H "Authorization: Bearer your-token" \
     -X POST \
     "https://dev.taxreturnpro.com.au/api/admin/export-database" \
     --output digitalocean_backup.dump
```

### Restore to Supabase
```bash
PGPASSWORD="your-supabase-password" pg_restore \
  -h db.xxxxxxxxxxxxxxxxxxxx.supabase.co \
  -p 5432 \
  -U postgres \
  -d postgres \
  -v \
  --no-owner \
  --no-privileges \
  digitalocean_backup.dump
```

## 🚨 Troubleshooting

### Export Download Fails
- ✅ Check `ADMIN_EXPORT_TOKEN` matches in both places
- ✅ Verify app is deployed and running
- ✅ Check `ALLOW_DB_EXPORT=true` in production

### Restore Fails
- ✅ Verify Supabase connection string format
- ✅ Check Supabase project is active
- ✅ Ensure password is correct in connection string

### Permission Errors
- ✅ Use `--no-owner --no-privileges` flags
- ✅ Check Supabase user has necessary permissions

## 🎉 Benefits of Supabase

After migration, you'll have:
- ✅ **Better Performance**: Optimized PostgreSQL
- ✅ **Real-time Features**: Built-in subscriptions
- ✅ **Better Monitoring**: Advanced dashboard
- ✅ **Automatic Backups**: Point-in-time recovery
- ✅ **Global CDN**: Faster worldwide access
- ✅ **Cost Savings**: More predictable pricing

## 🔒 Security Notes

- ✅ Remove `ALLOW_DB_EXPORT` after migration
- ✅ Rotate `ADMIN_EXPORT_TOKEN` periodically
- ✅ Keep Supabase credentials secure
- ✅ Delete dump files after successful migration

## 📞 Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review logs in both DigitalOcean and Supabase
3. Test with a minimal dataset first
4. Ensure all environment variables are correct

Good luck with your migration! 🚀