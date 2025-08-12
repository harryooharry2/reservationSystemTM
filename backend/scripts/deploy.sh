#!/bin/bash

# Backend Deployment Script
set -e

echo "🚀 Starting backend deployment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the backend directory."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm ci

# Check for environment variables
if [ -f ".env.production" ]; then
    echo "✅ Production environment file found"
else
    echo "⚠️  Warning: .env.production not found. Make sure to set environment variables in Render."
fi

# Test the build
echo "🔍 Testing build..."
npm start &
SERVER_PID=$!

# Wait for server to start
sleep 5

# Test health endpoint
echo "🏥 Testing health endpoint..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Stop the test server
kill $SERVER_PID 2>/dev/null || true

echo "✅ Build and health check completed successfully!"
echo "🎉 Backend is ready for deployment!"
echo "📋 Next steps:"
echo "   1. Push to GitHub"
echo "   2. Connect repository to Render"
echo "   3. Set environment variables in Render dashboard"
echo "   4. Deploy!" 