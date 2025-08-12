#!/bin/bash

# Frontend Deployment Script
set -e

echo "🚀 Starting frontend deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the frontend directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Run type checking
echo "🔍 Running type checks..."
npm run build

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully!"
echo "📁 Build output: dist/"

# Check for environment variables
if [ -f ".env.production" ]; then
    echo "✅ Production environment file found"
else
    echo "⚠️  Warning: .env.production not found. Make sure to set environment variables in Netlify."
fi

echo "🎉 Frontend is ready for deployment!"
echo "📋 Next steps:"
echo "   1. Push to GitHub"
echo "   2. Connect repository to Netlify"
echo "   3. Set environment variables in Netlify dashboard"
echo "   4. Deploy!" 