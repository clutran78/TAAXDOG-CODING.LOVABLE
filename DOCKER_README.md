# Docker Setup for TAAXDOG Next.js Application

This guide explains how to run the TAAXDOG application using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available for Docker

## Quick Start

### 1. Clone and Setup

```bash
# Clone the repository
git clone <repository-url>
cd TAAXDOG-CODING

# Copy environment variables
cp .env.docker.example .env

# Edit .env file with your actual values
nano .env
```

### 2. Development Environment

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f web

# Run database migrations
./scripts/docker-db-migrate.sh development

# Access the application
# - Next.js App: http://localhost:3000
# - PostgreSQL: localhost:5432
# - Redis: localhost:6379
# - pgAdmin: http://localhost:5050
```

### 3. Production Environment

```bash
# Build and start production environment
docker-compose up -d --build

# Run database migrations
./scripts/docker-db-migrate.sh production

# Access the application
# - Next.js App: http://localhost:3000 (use nginx for HTTPS)
# - Grafana: http://localhost:3001
# - Prometheus: http://localhost:9090
```

## Services Overview

### Core Services

1. **web** (Next.js Application)
   - Port: 3000
   - Environment: NODE_ENV=production
   - Features: SSR, API routes, Prisma ORM

2. **postgres** (PostgreSQL 15)
   - Port: 5432
   - Database: taaxdog_production
   - Persistent volume for data

3. **redis** (Redis 7)
   - Port: 6379
   - Used for: Session storage, caching, rate limiting

### Monitoring Services

4. **nginx** (Reverse Proxy)
   - Ports: 80, 443
   - SSL termination
   - Load balancing
   - Static file serving

5. **prometheus** (Metrics)
   - Port: 9090
   - Collects application metrics

6. **grafana** (Visualization)
   - Port: 3001 (changed from 3000 to avoid conflict)
   - Dashboards for monitoring

## Common Commands

### Container Management

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# Restart a specific service
docker-compose restart web

# View logs
docker-compose logs -f [service-name]

# Execute commands in container
docker-compose exec web sh
```

### Database Operations

```bash
# Run migrations
docker-compose exec web npx prisma migrate deploy

# Create a new migration
docker-compose exec web npx prisma migrate dev --name migration_name

# Access PostgreSQL CLI
docker-compose exec postgres psql -U taaxdog -d taaxdog_production

# Backup database
docker-compose exec postgres pg_dump -U taaxdog taaxdog_production > backup.sql

# Restore database
docker-compose exec -T postgres psql -U taaxdog taaxdog_production < backup.sql
```

### Development Tasks

```bash
# Install new npm package
docker-compose exec web npm install package-name

# Run tests
docker-compose exec web npm test

# Run linter
docker-compose exec web npm run lint

# Generate Prisma client
docker-compose exec web npx prisma generate

# Open Prisma Studio
docker-compose exec web npx prisma studio
```

## Environment Variables

Key environment variables (see `.env.docker.example` for full list):

- `NODE_ENV`: production/development
- `NEXTAUTH_URL`: Full URL of your application
- `NEXTAUTH_SECRET`: Secret for NextAuth.js (min 32 chars)
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `STRIPE_*`: Stripe API keys for payments
- `SENDGRID_API_KEY`: Email service
- AI service keys (Anthropic, OpenRouter, Gemini)

## Troubleshooting

### Port Conflicts

If you get port conflicts:

```bash
# Check what's using the port
lsof -i :3000

# Change ports in docker-compose.yml
# Example: "3001:3000" to map container port 3000 to host port 3001
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres pg_isready -U taaxdog
```

### Build Issues

```bash
# Clean rebuild
docker-compose down
docker system prune -a
docker-compose up -d --build
```

### Memory Issues

If containers crash due to memory:

1. Increase Docker memory allocation in Docker Desktop settings
2. Add memory limits to docker-compose.yml:

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          memory: 1G
```

## Production Deployment

For production deployment:

1. Use proper SSL certificates in `/nginx/ssl/`
2. Set secure passwords in `.env`
3. Enable backup strategies for PostgreSQL
4. Configure monitoring alerts in Grafana
5. Set up log aggregation
6. Use Docker Swarm or Kubernetes for scaling

## Security Notes

- Never commit `.env` files
- Use strong passwords for all services
- Regularly update base images
- Enable firewall rules for exposed ports
- Use read-only volumes where possible
- Run containers as non-root users (already configured)

## Backup and Recovery

### Automated Backups

Create a cron job for regular backups:

```bash
# Add to crontab
0 2 * * * /path/to/backup-script.sh
```

### Manual Backup

```bash
# Backup database
docker-compose exec postgres pg_dump -U taaxdog taaxdog_production | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup uploads
tar -czf uploads_backup_$(date +%Y%m%d_%H%M%S).tar.gz uploads/

# Backup Redis
docker-compose exec redis redis-cli BGSAVE
```

## Monitoring

Access monitoring tools:

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
  - Default login: admin/admin (change immediately)
  - Pre-configured dashboards for Next.js metrics

## Support

For issues or questions:

1. Check application logs: `docker-compose logs web`
2. Check [CLAUDE.md](./CLAUDE.md) for development notes
3. Review PostgreSQL logs: `docker-compose logs postgres`
4. Verify environment variables are set correctly
