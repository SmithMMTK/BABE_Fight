#!/bin/bash
set -e

echo "=== Custom Oryx Build Script ==="

# Build frontend
echo "Building frontend..."
cd /tmp/8dc2d41ed3f7eae/frontend
npm install
npm run build

# Install backend dependencies
echo "Installing backend dependencies..."
cd /tmp/8dc2d41ed3f7eae/backend
npm install

echo "Build completed successfully"
