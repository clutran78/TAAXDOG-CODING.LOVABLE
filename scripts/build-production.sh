#!/bin/bash

echo "Starting production build..."

# Install ALL dependencies (including devDependencies)
echo "Installing all dependencies..."
npm install --production=false

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Build the Next.js application
echo "Building Next.js application..."
npm run build

echo "Build complete!"