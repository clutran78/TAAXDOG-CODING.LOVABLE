#!/bin/bash

echo "🚀 Setting up TaxReturnPro Database..."

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ .env.local file not found. Please create it first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Push database schema
echo "🗄️ Pushing database schema..."
npx prisma db push

# Seed database with initial data
echo "🌱 Seeding database..."
npx prisma db seed

echo "✅ Database setup complete!"
echo ""
echo "Next steps:"
echo "1. Start the development server: npm run dev"
echo "2. Open http://localhost:3000 in your browser"
echo "3. Create your first account"
echo ""
echo "🎉 Your TaxReturnPro application is ready!"