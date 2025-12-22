#!/bin/bash

echo "🏌️ BABE Fight - Azure Deployment Script"
echo "========================================"

# Install root dependencies
echo "📦 Installing root dependencies..."
npm install

# Build frontend
echo "🎨 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Install backend dependencies
echo "⚙️ Installing backend dependencies..."
cd backend
npm install
cd ..

echo "✅ Build complete!"
echo "📁 Frontend built to: frontend/dist"
echo "🚀 Ready for deployment"
