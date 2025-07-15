#!/bin/bash
# Production build script for DigitalOcean

echo "🚀 Starting production build..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install --production=false

# Generate Prisma client with error handling
echo "🔧 Generating Prisma client..."
if npx prisma generate; then
    echo "✅ Prisma client generated successfully"
else
    echo "⚠️  Prisma generation failed, continuing anyway..."
fi

# Build Next.js
echo "🏗️  Building Next.js application..."
npm run build

echo "✅ Build completed!"