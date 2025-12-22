#!/bin/bash

# BABE Fight - Local Development Startup Script
# This script installs dependencies and runs both backend and frontend servers

set -e  # Exit on any error

echo "======================================"
echo "BABE Fight - Local Development Setup"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js from https://nodejs.org/"
    exit 1
fi

echo -e "${BLUE}Node version: $(node --version)${NC}"
echo -e "${BLUE}NPM version: $(npm --version)${NC}"
echo ""

# Function to install dependencies
install_dependencies() {
    echo -e "${GREEN}Installing dependencies...${NC}"
    echo ""
    
    # Install root dependencies
    echo -e "${BLUE}Installing root dependencies...${NC}"
    npm install
    
    # Install backend dependencies
    echo -e "${BLUE}Installing backend dependencies...${NC}"
    cd backend && npm install && cd ..
    
    # Install frontend dependencies
    echo -e "${BLUE}Installing frontend dependencies...${NC}"
    cd frontend && npm install && cd ..
    
    echo -e "${GREEN}✓ All dependencies installed successfully${NC}"
    echo ""
}

# Check if node_modules exist
NEEDS_INSTALL=false
if [ ! -d "node_modules" ] || [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    NEEDS_INSTALL=true
fi

if [ "$NEEDS_INSTALL" = true ]; then
    echo -e "${BLUE}Dependencies not found. Installing...${NC}"
    install_dependencies
else
    echo -e "${GREEN}✓ Dependencies already installed${NC}"
    echo ""
fi

# Start the application
echo -e "${GREEN}Starting BABE Fight application...${NC}"
echo ""
echo -e "${BLUE}Backend will run on: http://localhost:3000${NC}"
echo -e "${BLUE}Frontend will run on: http://localhost:5173${NC}"
echo ""
echo -e "${BLUE}Press Ctrl+C to stop all servers${NC}"
echo ""

# Run both servers using concurrently
npm run dev
