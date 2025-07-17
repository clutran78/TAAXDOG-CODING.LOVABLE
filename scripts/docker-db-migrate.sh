#!/bin/bash

# Docker database migration script for Next.js/Prisma

set -e

echo "🚀 Running database migrations in Docker..."

# Check if docker-compose file exists
if [ ! -f "docker-compose.yml" ] && [ ! -f "docker-compose.dev.yml" ]; then
    echo "❌ Error: docker-compose.yml not found!"
    exit 1
fi

# Determine environment
ENV=${1:-development}
COMPOSE_FILE="docker-compose.yml"

if [ "$ENV" = "development" ]; then
    COMPOSE_FILE="docker-compose.dev.yml"
fi

echo "📋 Using environment: $ENV"
echo "📋 Using compose file: $COMPOSE_FILE"

# Ensure database is running
echo "🔄 Starting database service..."
docker-compose -f $COMPOSE_FILE up -d postgres

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 5

# Run migrations
echo "🔄 Running Prisma migrations..."
docker-compose -f $COMPOSE_FILE run --rm web npx prisma migrate deploy

# Generate Prisma client
echo "🔄 Generating Prisma client..."
docker-compose -f $COMPOSE_FILE run --rm web npx prisma generate

# Seed database (optional)
if [ "$2" = "--seed" ]; then
    echo "🌱 Seeding database..."
    docker-compose -f $COMPOSE_FILE run --rm web npx prisma db seed
fi

echo "✅ Database migration completed successfully!"

# Show current schema
echo "📊 Current database schema:"
docker-compose -f $COMPOSE_FILE run --rm web npx prisma db pull --print