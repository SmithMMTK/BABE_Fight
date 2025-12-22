#!/bin/bash
set -e

echo "=== Updating BABE Fight on Azure Container Apps ==="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker Desktop"
    exit 1
fi

# Read configuration from deployment info file
if [ ! -f ".azure-deployment-info" ]; then
    echo -e "${RED}Error: Deployment info not found${NC}"
    echo "Please run ./deploy-container-apps.sh first"
    exit 1
fi

source .azure-deployment-info

echo -e "${YELLOW}Configuration:${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "Container App: $CONTAINER_APP_NAME"
echo "ACR: $ACR_NAME"
echo ""

# Login to ACR
echo -e "${GREEN}Step 1: Logging in to Azure Container Registry...${NC}"
az acr login --name $ACR_NAME

ACR_LOGIN_SERVER=$(az acr show \
  --name $ACR_NAME \
  --query loginServer -o tsv)

# Build new image with version tag
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
VERSION_TAG="v$TIMESTAMP"

echo -e "${GREEN}Step 2: Building new Docker image (AMD64)...${NC}"
echo "Tags: latest, $VERSION_TAG"
docker buildx build \
  --platform linux/amd64 \
  -t $ACR_LOGIN_SERVER/babe-fight:latest \
  -t $ACR_LOGIN_SERVER/babe-fight:$VERSION_TAG \
  --load .

# Push to ACR
echo -e "${GREEN}Step 3: Pushing to Azure Container Registry...${NC}"
docker push $ACR_LOGIN_SERVER/babe-fight:latest
docker push $ACR_LOGIN_SERVER/babe-fight:$VERSION_TAG

# Update Container App
echo -e "${GREEN}Step 4: Updating Container App...${NC}"

# Read SQL configuration if exists
if [ -f ".azure-deployment-info" ]; then
  source .azure-deployment-info
  
  # Set environment variables if SQL is configured
  if [ ! -z "$SQL_SERVER_FQDN" ]; then
    echo "Configuring Azure SQL Database connection..."
    az containerapp update \
      --name $CONTAINER_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --image $ACR_LOGIN_SERVER/babe-fight:latest \
      --set-env-vars \
        DB_TYPE=mssql \
        DB_SERVER=$SQL_SERVER_FQDN \
        DB_NAME=$SQL_DB_NAME \
        DB_USER=$SQL_ADMIN_USER \
        DB_PASSWORD="$SQL_ADMIN_PASSWORD" \
        DB_ENCRYPT=true \
      --output none
  else
    # No SQL configured, just update image
    az containerapp update \
      --name $CONTAINER_APP_NAME \
      --resource-group $RESOURCE_GROUP \
      --image $ACR_LOGIN_SERVER/babe-fight:latest \
      --output none
  fi
fi

# Get app URL
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

echo ""
echo -e "${GREEN}=== Update Complete! ===${NC}"
echo ""
echo -e "${YELLOW}App URL:${NC} https://$APP_URL"
echo -e "${YELLOW}Version:${NC} $VERSION_TAG"
echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "  az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo ""
echo -e "${YELLOW}Rollback to previous version:${NC}"
echo "  docker images | grep babe-fight  # List available versions"
echo "  az containerapp update --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --image $ACR_LOGIN_SERVER/babe-fight:<VERSION>"
echo ""
