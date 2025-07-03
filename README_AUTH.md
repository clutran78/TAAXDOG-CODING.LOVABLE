# Taaxdog Authentication System

This is a complete authentication system for Taaxdog-coding with NextAuth.js integration, built with Australian compliance requirements.

## Features

### 1. Authentication Methods
- **Email/Password Authentication**: Custom credentials provider with bcrypt password hashing
- **Google OAuth**: Social login integration
- **Session Management**: JWT-based sessions with 30-day expiration

### 2. Security Features
- **Password Requirements**: Minimum 12 characters with uppercase, lowercase, numbers, and special characters
- **Account Lockout**: Automatic lockout after 5 failed login attempts (30 minutes)
- **Rate Limiting**: 
  - Registration: 5 attempts per minute per IP
  - General API: 100 requests per minute per IP
- **CSRF Protection**: For sensitive API endpoints
- **Security Headers**: HSTS, XSS protection, CSP, and more
- **Audit Logging**: Comprehensive logging of all authentication events

### 3. Australian Compliance
- **Tax Residency Status**: Captures resident/non-resident/temporary resident status
- **ABN Support**: Optional Australian Business Number field with validation
- **TFN Support**: Tax File Number field (encrypted storage)
- **GST Compliance**: Built for Australian tax requirements
- **Data Residency**: Designed for Australian data center deployment

### 4. Role-Based Access Control (RBAC)
- **User Roles**: USER, ACCOUNTANT, SUPPORT, ADMIN
- **Role Hierarchy**: Permission inheritance system
- **Protected Routes**: Automatic route protection based on roles

## File Structure

```
/lib
  /auth.ts                    # NextAuth configuration and auth helpers
  /prisma.ts                  # Prisma client singleton
  /middleware
    /auth.ts                  # Authentication middleware and RBAC

/pages
  /api
    /auth
      /[...nextauth].ts       # NextAuth API route
      /register.ts            # User registration endpoint
      /change-password.ts     # Password change endpoint
  /auth
    /login.tsx                # Custom login page
    /register.tsx             # Custom registration page
    /welcome.tsx              # Welcome page for new users
    /error.tsx                # Authentication error page
  /_app.tsx                   # App wrapper with SessionProvider

/prisma
  /schema.prisma              # Database schema with auth models

/types
  /next-auth.d.ts            # TypeScript declarations for NextAuth

/middleware.ts                # Next.js middleware for route protection
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Environment Variables
Create a `.env.local` file with:

```env
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### 3. Generate Prisma Client
```bash
npx prisma generate
```

### 4. Run Database Migrations
```bash
npx prisma migrate dev --name init
```

### 5. Start Development Server
```bash
npm run dev
```

## Database Schema

The authentication system uses the following main tables:

- **users**: User accounts with Australian-specific fields
- **accounts**: OAuth provider accounts
- **sessions**: Active user sessions
- **verification_tokens**: Email verification tokens
- **audit_logs**: Authentication event logs

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/change-password` - Change user password
- `/api/auth/*` - NextAuth endpoints (signin, signout, session, etc.)

### Protected Routes
- `/dashboard` - Requires authentication
- `/profile` - Requires authentication
- `/admin/*` - Requires ADMIN role
- `/support/*` - Requires SUPPORT role
- `/accountant/*` - Requires ACCOUNTANT role

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files
2. **NEXTAUTH_SECRET**: Use a strong, random secret in production
3. **Database**: Use SSL connections in production
4. **HTTPS**: Always use HTTPS in production
5. **Rate Limiting**: Consider using Redis for distributed rate limiting
6. **Monitoring**: Monitor audit logs for suspicious activity

## Testing

To test the authentication flow:

1. Navigate to `/auth/register` to create an account
2. Try logging in at `/auth/login`
3. Test Google OAuth if configured
4. Verify rate limiting by making multiple requests
5. Check audit logs in the database

## Production Deployment

For production deployment:

1. Use production database URL
2. Set `NEXTAUTH_URL` to your production domain
3. Generate a strong `NEXTAUTH_SECRET`
4. Configure Google OAuth with production redirect URLs
5. Enable SSL on database connections
6. Set up monitoring for audit logs
7. Configure backup strategies for user data