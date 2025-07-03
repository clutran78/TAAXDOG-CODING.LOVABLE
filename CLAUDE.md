# TAAXDOG PROJECT CONFIGURATION

## Project Identity
- Project Name: Taaxdog-coding
- Domain: taxreturnpro.com.au
- Framework: Next.js 14 with TypeScript
- Database: PostgreSQL on DigitalOcean Sydney
- Deployment: DigitalOcean App Platform (Sydney region)

## Infrastructure Details

### Droplets
- Production Droplet: taxreturnpro-droplet (IP: 170.64.206.137)
- Staging Droplet: taxreturnpro-staging-droplet (IP: 170.64.195.235)
- Droplet Password: g!R9QdFXbYk$pH (same for both)

## Database Configuration

### Development Database
DATABASE_URL="postgresql://genesis@localhost:5432/taaxdog_development"

### Production Databases

#### Main Database (Port 25060)
- Username: doadmin
- Password: AVNS___ZoxHp7i5cnz64V8ms
- Host: taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com
- Port: 25060
- Database: defaultdb
- SSL Mode: require

#### Application Database (Port 25061)
- Username: taaxdog-admin
- Password: AVNS_kp_8AWjX2AzlvWOqm_V
- Host: taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com
- Port: 25061
- Database: taaxdog-production
- SSL Mode: require

#### Connection Pool Database (Port 25061)
- Username: taaxdog-admin
- Password: AVNS_kp_8AWjX2AzlvWOqm_V
- Host: taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com
- Port: 25061
- Database: taaxdog-connection-pool
- SSL Mode: require

### Connection Strings

#### Public Connection String
DATABASE_URL="postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require"

#### VPC Connection String
VPC_DATABASE_URL="postgresql://taaxdog-admin:AVNS_kp_8AWjX2AzlvWOqm_V@private-taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com:25060/taaxdog-production?sslmode=require"

#### Database Restore Command
PGPASSWORD=AVNS___ZoxHp7i5cnz64V8ms pg_restore -U doadmin -h taaxdog-production-do-user-23438582-0.d.db.ondigitalocean.com -p 25060 -d defaultdb

## Application Configuration

### Development
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="VqkUiUKy7SweRednCPtXooCmsnpoHc1wdXl5DBDmAR4="
NODE_ENV="development"

### Production
NEXTAUTH_URL="https://taxreturnpro.com.au"
NEXTAUTH_SECRET="VS5+e29Y/yEPy4wnqgDz04gT7PfCRkQR/iUS7tteTUI="
NODE_ENV="production"

## Stripe Configuration (Live Keys)

STRIPE_PUBLISHABLE_KEY="pk_live_51Re1oyLl1e8i03PEfTJeJ6DBeX1T7gzcXRCPWDzePSJGTwBJZYwECtZbGBcYA3H8tl5gxZUobLY4bYmseontkiBj00s6SiBehE"
STRIPE_SECRET_KEY="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"
STRIPE_WEBHOOK_SECRET="whsec_z2rEeYEZBAbBjxMvCzfKc8Trs1wlTC9L"

## AI Provider Keys

ANTHROPIC_API_KEY="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"
OPENROUTER_API_KEY="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"
GEMINI_API_KEY="AIzaSyADSKfEEx1WISywXTw7V1CHqjM72bn7kEY"

## BASIQ Banking Integration

BASIQ_API_KEY="MThmYjA5ZWEtNzRhMi00Nzc5LTk0ZjAtYmRkOTExZDgwMGI4OjhjZjUzZWUzLTYxYm"

## Subscription Pricing (EXACT REQUIREMENTS)

TAAX Smart Plan:
- Trial: 3 days free
- Promotional: $4.99 AUD/month for first 2 months
- Regular: $9.99 AUD/month after promotional period
- GST: 10% included in all prices

TAAX Pro Plan:
- Trial: 7 days free
- Promotional: $10.99 AUD/month for first 2 months
- Regular: $18.99 AUD/month after promotional period
- GST: 10% included in all prices

## Australian Compliance Requirements (NON-NEGOTIABLE)

- ATO compliance for all tax calculations
- GST handling at 10% rate (included in prices)
- Data residency in Australian datacenters only
- Australian Privacy Principles (APPs) compliance
- Australian Consumer Law compliance for subscriptions
- Tax invoice generation meeting ATO standards
- ABN validation and handling
- Australian tax year handling (July 1 - June 30)

## Technical Requirements

- TypeScript strict mode enabled
- Prisma ORM for database operations
- NextAuth.js for authentication
- Tailwind CSS for styling
- Environment-aware configuration (dev/prod)
- Comprehensive error handling and logging
- Performance optimization for Australian users