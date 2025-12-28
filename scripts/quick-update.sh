#!/bin/bash
set -e

# Quick Update Script - For incremental changes
# Resource Group และ Resources ที่ใช้งานอยู่

RG_NAME="01-babe-fight"
ACR_NAME="babefightacr1766476411"
APP_NAME="babe-fight-app"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
VERSION="v${TIMESTAMP}"
COMMIT_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "local")

echo "=== Quick Update BABE Fight ==="
echo "Resource Group: $RG_NAME"
echo "Container App: $APP_NAME"
echo "Version: $VERSION"
echo "Commit: $COMMIT_HASH"
echo ""

# 1. Login to ACR
echo ""
echo "1. Logging in to Azure Container Registry..."
az acr login --name $ACR_NAME

# 2. Build and push new Docker image
echo ""
echo "2. Building and pushing Docker image..."

# Read version from version.config.json
APP_VERSION=$(grep -o '"version": "[^"]*"' version.config.json | cut -d'"' -f4)
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

docker buildx build \
  --platform linux/amd64 \
  -t ${ACR_NAME}.azurecr.io/babe-fight:latest \
  -t ${ACR_NAME}.azurecr.io/babe-fight:${VERSION} \
  --build-arg APP_VERSION="${APP_VERSION}" \
  --build-arg GIT_COMMIT="${COMMIT_HASH}" \
  --build-arg BUILD_TIME="${BUILD_TIME}" \
  --push \
  .

# 3. Update Container App with new image
echo ""
echo "3. Updating Container App..."
az containerapp update \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --image ${ACR_NAME}.azurecr.io/babe-fight:${VERSION}

# 4. Get app URL
APP_URL=$(az containerapp show \
  --name $APP_NAME \
  --resource-group $RG_NAME \
  --query properties.configuration.ingress.fqdn -o tsv)

echo ""
echo "=== Update Complete! ==="
echo ""
echo "App URL: https://$APP_URL"
echo "Version: $VERSION"
echo "Commit: $COMMIT_HASH"
echo ""
echo "View logs:"
echo "  az containerapp logs show --name $APP_NAME --resource-group $RG_NAME --follow"
