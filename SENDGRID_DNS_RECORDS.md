# SendGrid DNS Records for taxreturnpro.com.au

## DNS Records to Add

Copy these exactly as shown for your DNS provider:

### CNAME Records

| Type  | Host/Name      | Points To/Value                           | TTL       |
| ----- | -------------- | ----------------------------------------- | --------- |
| CNAME | url9172        | sendgrid.net                              | Auto/3600 |
| CNAME | 54320513       | sendgrid.net                              | Auto/3600 |
| CNAME | em3828         | u54320513.wl014.sendgrid.net              | Auto/3600 |
| CNAME | s1.\_domainkey | s1.domainkey.u54320513.wl014.sendgrid.net | Auto/3600 |
| CNAME | s2.\_domainkey | s2.domainkey.u54320513.wl014.sendgrid.net | Auto/3600 |

### TXT Record

| Type | Host/Name | Value             | TTL       |
| ---- | --------- | ----------------- | --------- |
| TXT  | \_dmarc   | v=DMARC1; p=none; | Auto/3600 |

## Important Notes for Different DNS Providers

### Namecheap

- Use only the subdomain part in "Host" field
- Example: Enter `url9172` NOT `url9172.taxreturnpro.com.au`

### GoDaddy

- Similar to Namecheap - use only subdomain
- For root domain records, use `@`

### Cloudflare

- Turn OFF proxy (orange cloud) - make it gray
- Use full subdomain in "Name" field
- Cloudflare automatically appends the domain

### DigitalOcean DNS

- If using DO's DNS, enter only the subdomain
- The domain is automatically appended

## How to Add Records

1. **Log in** to your DNS provider
2. **Find** DNS Management/Advanced DNS/DNS Records
3. **Add** each record one by one
4. **Save** changes

## After Adding Records

1. **Wait** 5-10 minutes for propagation
2. **Return** to SendGrid dashboard
3. **Click** "Verify" on domain authentication page
4. **Check** for green checkmarks

## Verification Checklist

- [ ] url9172 CNAME added
- [ ] 54320513 CNAME added
- [ ] em3828 CNAME added
- [ ] s1.\_domainkey CNAME added
- [ ] s2.\_domainkey CNAME added
- [ ] \_dmarc TXT record added
- [ ] Clicked "Verify" in SendGrid
- [ ] All records show green checkmarks

## Troubleshooting

**If verification fails:**

1. Check you didn't double-add the domain (like
   url9172.taxreturnpro.com.au.taxreturnpro.com.au)
2. Wait longer (up to 48 hours for full propagation)
3. Use a DNS checker: https://mxtoolbox.com/dnscheck.aspx

**Common mistakes:**

- Entering full domain when only subdomain needed
- Forgetting to save changes in DNS provider
- Having Cloudflare proxy enabled (should be DNS-only)
