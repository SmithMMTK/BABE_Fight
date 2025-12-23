#!/bin/bash

# BABE Fight - Complete Deployment Script
# This script: commits changes, pushes to GitHub, and deploys to Azure

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get project root (parent of scripts directory)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${GREEN}=== BABE Fight Complete Deployment ===${NC}"
echo ""

# Step 1: Check for uncommitted changes
cd "$PROJECT_ROOT"
if [[ -n $(git status -s) ]]; then
  echo -e "${YELLOW}Step 1: Uncommitted changes detected${NC}"
  git status -s
  echo ""
  
  # Ask for commit message
  read -p "Enter commit message (or press Enter to skip commit): " COMMIT_MSG
  
  if [[ -n "$COMMIT_MSG" ]]; then
    echo -e "${GREEN}Committing changes...${NC}"
    git add -A
    git commit -m "$COMMIT_MSG"
    echo -e "${GREEN}✓ Changes committed${NC}"
  else
    echo -e "${YELLOW}⚠ Skipping commit (changes remain uncommitted)${NC}"
  fi
else
  echo -e "${GREEN}Step 1: No uncommitted changes${NC}"
fi

echo ""

# Step 2: Push to GitHub
echo -e "${GREEN}Step 2: Pushing to GitHub...${NC}"
CURRENT_BRANCH=$(git branch --show-current)
echo "Branch: $CURRENT_BRANCH"

if git push origin "$CURRENT_BRANCH"; then
  echo -e "${GREEN}✓ Pushed to GitHub successfully${NC}"
else
  echo -e "${YELLOW}⚠ Nothing to push or push failed${NC}"
fi

echo ""

# Step 3: Deploy to Azure
echo -e "${GREEN}Step 3: Deploying to Azure Container Apps...${NC}"
echo ""

# Run the update-app.sh script
if [[ -f "$SCRIPT_DIR/update-app.sh" ]]; then
  "$SCRIPT_DIR/update-app.sh"
else
  echo -e "${RED}✗ update-app.sh not found!${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo ""
echo -e "${YELLOW}Summary:${NC}"
echo "  ✓ Code committed and pushed to GitHub"
echo "  ✓ Docker image built and pushed to ACR"
echo "  ✓ Azure Container App updated"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Wait 30-60 seconds for the new revision to become healthy"
echo "  2. Test the application at: https://babe-fight-app.wonderfulground-7b843935.southeastasia.azurecontainerapps.io"
echo "  3. Check version info in hamburger menu to confirm deployment"
echo ""
