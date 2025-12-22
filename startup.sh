#!/bin/bash

# Azure Web App Startup Script
echo "Starting BABE Fight application..."

# Install backend dependencies
echo "Installing backend dependencies..."
cd /home/site/wwwroot/backend
npm install

# Install frontend dependencies and build
echo "Installing frontend dependencies..."
cd /home/site/wwwroot/frontend
npm install

echo "Building frontend..."
npm run build

# Start backend server
echo "Starting backend server..."
cd /home/site/wwwroot
node backend/src/server.js
