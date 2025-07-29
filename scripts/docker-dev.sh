#!/bin/bash

# Docker Development Helper Script
# Simplifies common Docker operations for development

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default environment
ENV_FILE=".env.local"

# Function to print colored output
print_color() {
    color=$1
    message=$2
    echo -e "${color}${message}${NC}"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_color $RED "Docker is not running. Please start Docker first."
        exit 1
    fi
}

# Function to load environment variables
load_env() {
    if [ -f "$ENV_FILE" ]; then
        export $(cat $ENV_FILE | grep -v '^#' | xargs)
        print_color $GREEN "✓ Loaded environment from $ENV_FILE"
    else
        print_color $YELLOW "⚠ No $ENV_FILE found. Using defaults."
    fi
}

# Function to show usage
show_usage() {
    echo "Docker Development Helper"
    echo ""
    echo "Usage: ./scripts/docker-dev.sh [command]"
    echo ""
    echo "Commands:"
    echo "  up              Start all services"
    echo "  down            Stop all services"
    echo "  restart         Restart all services"
    echo "  build           Build/rebuild services"
    echo "  logs [service]  Show logs (optional: specify service)"
    echo "  shell [service] Open shell in service (default: web)"
    echo "  db              Connect to PostgreSQL"
    echo "  db:reset        Reset database"
    echo "  db:migrate      Run Prisma migrations"
    echo "  db:seed         Seed database"
    echo "  redis           Connect to Redis CLI"
    echo "  clean           Clean up volumes and containers"
    echo "  dev             Start in development mode"
    echo "  prod            Start in production mode"
    echo "  test            Run tests in container"
    echo "  mail            Open Mailhog UI"
    echo "  adminer         Open Adminer UI"
    echo ""
}

# Main script logic
check_docker
load_env

case "$1" in
    up)
        print_color $BLUE "Starting services..."
        docker-compose up -d
        print_color $GREEN "✓ Services started"
        print_color $YELLOW "→ Next.js: http://localhost:3000"
        print_color $YELLOW "→ Mailhog: http://localhost:8025 (dev only)"
        print_color $YELLOW "→ Adminer: http://localhost:8080 (dev only)"
        ;;
    
    down)
        print_color $BLUE "Stopping services..."
        docker-compose down
        print_color $GREEN "✓ Services stopped"
        ;;
    
    restart)
        print_color $BLUE "Restarting services..."
        docker-compose restart
        print_color $GREEN "✓ Services restarted"
        ;;
    
    build)
        print_color $BLUE "Building services..."
        docker-compose build --no-cache
        print_color $GREEN "✓ Build complete"
        ;;
    
    logs)
        if [ -z "$2" ]; then
            docker-compose logs -f --tail=100
        else
            docker-compose logs -f --tail=100 $2
        fi
        ;;
    
    shell)
        service=${2:-web}
        print_color $BLUE "Opening shell in $service..."
        docker-compose exec $service sh
        ;;
    
    db)
        print_color $BLUE "Connecting to PostgreSQL..."
        docker-compose exec postgres psql -U ${POSTGRES_USER:-taaxdog} ${POSTGRES_DB:-taaxdog_dev}
        ;;
    
    db:reset)
        print_color $YELLOW "⚠ This will reset your database. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            print_color $BLUE "Resetting database..."
            docker-compose exec web npm run prisma:reset
            print_color $GREEN "✓ Database reset complete"
        fi
        ;;
    
    db:migrate)
        print_color $BLUE "Running migrations..."
        docker-compose exec web npm run prisma:migrate
        print_color $GREEN "✓ Migrations complete"
        ;;
    
    db:seed)
        print_color $BLUE "Seeding database..."
        docker-compose exec web npm run prisma:seed
        print_color $GREEN "✓ Database seeded"
        ;;
    
    redis)
        print_color $BLUE "Connecting to Redis..."
        docker-compose exec redis redis-cli
        ;;
    
    clean)
        print_color $YELLOW "⚠ This will remove all containers and volumes. Continue? (y/N)"
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            print_color $BLUE "Cleaning up..."
            docker-compose down -v --remove-orphans
            docker system prune -f
            print_color $GREEN "✓ Cleanup complete"
        fi
        ;;
    
    dev)
        print_color $BLUE "Starting in development mode..."
        export NODE_ENV=development
        export DEV_MODE=1
        docker-compose --profile development up
        ;;
    
    prod)
        print_color $BLUE "Starting in production mode..."
        export NODE_ENV=production
        unset DEV_MODE
        docker-compose up -d
        ;;
    
    test)
        print_color $BLUE "Running tests..."
        docker-compose exec web npm test
        ;;
    
    mail)
        print_color $BLUE "Opening Mailhog..."
        open http://localhost:8025 || xdg-open http://localhost:8025
        ;;
    
    adminer)
        print_color $BLUE "Opening Adminer..."
        open http://localhost:8080 || xdg-open http://localhost:8080
        ;;
    
    *)
        show_usage
        ;;
esac