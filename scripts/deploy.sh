#!/bin/bash

echo "🚀 Deploying TaxReturnPro to DigitalOcean..."

# Check if environment is production
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️ Warning: NODE_ENV is not set to production"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install dependencies
echo "📦 Installing production dependencies..."
npm ci --only=production

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄️ Running database migrations..."
npx prisma migrate deploy

# Build the application
echo "🏗️ Building application..."
npm run build

# Run tests
echo "🧪 Running tests..."
npm test

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
else
    echo "❌ Build failed!"
    exit 1
fi

# Start the application
echo "🎉 Starting TaxReturnPro..."
npm start

echo "✅ Deployment complete!"
echo "Application is running on port 3000"