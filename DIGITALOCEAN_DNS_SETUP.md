# Adding SendGrid DNS Records in DigitalOcean

## Step-by-Step Guide

### 1. Navigate to DigitalOcean DNS Management

1. **Log in** to DigitalOcean: https://cloud.digitalocean.com
2. **Click "Networking"** in the left sidebar (it might be under "Manage" section)
3. **Find "taxreturnpro.com.au"** in your domains list and click on it
4. You'll see the DNS management page with existing records

### 2. Add the CNAME Records

You need to add 3 CNAME records. For each one:

#### First CNAME Record:
1. Click **"Create new record"** or **"Add record"**
2. Select **"CNAME"** from the dropdown
3. Fill in:
   - **Hostname**: `em3628` (just this, NOT em3628.taxreturnpro.com.au)
   - **Is an alias of**: `u4142010.wl214.sendgrid.net`
   - **TTL**: 3600 (or leave default)
4. Click **"Create record"**

#### Second CNAME Record:
1. Click **"Create new record"** again
2. Select **"CNAME"**
3. Fill in:
   - **Hostname**: `s1._domainkey`
   - **Is an alias of**: `s1.domainkey.u4142010.wl214.sendgrid.net`
   - **TTL**: 3600
4. Click **"Create record"**

#### Third CNAME Record:
1. Click **"Create new record"** again
2. Select **"CNAME"**
3. Fill in:
   - **Hostname**: `s2._domainkey`
   - **Is an alias of**: `s2.domainkey.u4142010.wl214.sendgrid.net`
   - **TTL**: 3600
4. Click **"Create record"**

### 3. Add the TXT Record (DMARC)

1. Click **"Create new record"**
2. Select **"TXT"** from the dropdown
3. Fill in:
   - **Hostname**: `_dmarc`
   - **Value**: `v=DMARC1; p=none;`
   - **TTL**: 3600
4. Click **"Create record"**

## Visual Guide

Here's what each field should look like:

```
CNAME Records:
┌─────────────────┬──────────────────────────────────────────┐
│ Hostname        │ Is an alias of                           │
├─────────────────┼──────────────────────────────────────────┤
│ em3628          │ u4142010.wl214.sendgrid.net              │
│ s1._domainkey   │ s1.domainkey.u4142010.wl214.sendgrid.net │
│ s2._domainkey   │ s2.domainkey.u4142010.wl214.sendgrid.net │
└─────────────────┴──────────────────────────────────────────┘

TXT Record:
┌─────────────────┬──────────────────────┐
│ Hostname        │ Value                │
├─────────────────┼──────────────────────┤
│ _dmarc          │ v=DMARC1; p=none;    │
└─────────────────┴──────────────────────┘
```

## Important Notes

- **DO NOT** include ".taxreturnpro.com.au" in the hostname field - DigitalOcean adds it automatically
- **DO NOT** add a trailing dot (.) to any values
- The records should appear in your DNS list as:
  - `em3628.taxreturnpro.com.au`
  - `s1._domainkey.taxreturnpro.com.au`
  - `s2._domainkey.taxreturnpro.com.au`
  - `_dmarc.taxreturnpro.com.au`

## After Adding Records

1. **Wait 5-10 minutes** for DNS propagation
2. **Go back to SendGrid** dashboard
3. Navigate to **Settings → Sender Authentication**
4. Find your domain and click **"Verify"**
5. You should see green checkmarks next to each record

## Troubleshooting

If verification fails:
- Double-check you didn't include the domain name in the hostname field
- Ensure there are no typos in the long SendGrid values
- Wait up to 1 hour for full propagation
- Check DNS propagation: https://www.whatsmydns.net/

## Quick Checklist

- [ ] Added em3628 CNAME record
- [ ] Added s1._domainkey CNAME record
- [ ] Added s2._domainkey CNAME record
- [ ] Added _dmarc TXT record
- [ ] Waited 10 minutes
- [ ] Clicked "Verify" in SendGrid
- [ ] All records show verified ✓