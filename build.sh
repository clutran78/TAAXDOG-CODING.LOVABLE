#!/bin/bash

# Vercel build script for TAAXDOG
echo "🚀 Starting TAAXDOG build process..."

# Navigate to next-frontend directory
cd next-frontend

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Build the Next.js application
echo "🔨 Building Next.js application..."
npm run build

echo "✅ Build completed successfully!" 