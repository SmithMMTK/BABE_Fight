#!/bin/bash
set -e

echo "=== Azure Container Apps Deployment Script ==="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo "Install it with: brew install azure-cli"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Error: Docker is not running${NC}"
    echo "Please start Docker Desktop"
    exit 1
fi

# Variables (modify these as needed)
RESOURCE_GROUP="babe-fight-rg"
LOCATION="southeastasia"
CONTAINER_APP_ENV="babe-fight-env"
CONTAINER_APP_NAME="babe-fight-app"
ACR_NAME="babefightacr$(date +%s)"  # Add timestamp for uniqueness
STORAGE_ACCOUNT="babefightstore$(date +%s)"  # Add timestamp for uniqueness
FILE_SHARE_NAME="sqlitedata"

echo -e "${YELLOW}Configuration:${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "ACR Name: $ACR_NAME"
echo "Storage Account: $STORAGE_ACCOUNT"
echo ""
read -p "Continue with deployment? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Login check
echo -e "${GREEN}Step 1: Checking Azure login...${NC}"
az account show &> /dev/null || az login

# Create resource group
echo -e "${GREEN}Step 2: Creating resource group...${NC}"
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION \
  --tags SecurityControl=Ignore \
  --output none

# Create ACR
echo -e "${GREEN}Step 3: Creating Azure Container Registry...${NC}"
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true \
  --tags SecurityControl=Ignore \
  --output none

# Create Storage Account
echo -e "${GREEN}Step 4: Creating Storage Account for SQLite...${NC}"
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2 \
  --tags SecurityControl=Ignore \
  --output none

STORAGE_KEY=$(az storage account keys list \
  --resource-group $RESOURCE_GROUP \
  --account-name $STORAGE_ACCOUNT \
  --query "[0].value" -o tsv)

az storage share create \
  --name $FILE_SHARE_NAME \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY \
  --quota 1 \
  --output none

# Create Container Apps environment
echo -e "${GREEN}Step 5: Creating Container Apps environment...${NC}"
az containerapp env create \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --tags SecurityControl=Ignore \
  --output none

# Add storage to environment
echo -e "${GREEN}Step 6: Configuring persistent storage...${NC}"
az containerapp env storage set \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --storage-name sqlitestorage \
  --azure-file-account-name $STORAGE_ACCOUNT \
  --azure-file-account-key $STORAGE_KEY \
  --azure-file-share-name $FILE_SHARE_NAME \
  --access-mode ReadWrite \
  --output none

# Build and push Docker image
echo -e "${GREEN}Step 7: Building and pushing Docker image (AMD64 for Azure)...${NC}"
ACR_LOGIN_SERVER=$(az acr show \
  --name $ACR_NAME \
  --query loginServer -o tsv)

az acr login --name $ACR_NAME

# Build for AMD64 architecture (Azure uses x86_64)
echo "Building for linux/amd64 platform..."
docker buildx build --platform linux/amd64 -t $ACR_LOGIN_SERVER/babe-fight:latest --load .
docker push $ACR_LOGIN_SERVER/babe-fight:latest

# Get ACR credentials
ACR_USERNAME=$(az acr credential show \
  --name $ACR_NAME \
  --query username -o tsv)

ACR_PASSWORD=$(az acr credential show \
  --name $ACR_NAME \
  --query "passwords[0].value" -o tsv)

# Deploy container app
echo -e "${GREEN}Step 8: Deploying Container App...${NC}"
az containerapp create \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --environment $CONTAINER_APP_ENV \
  --image $ACR_LOGIN_SERVER/babe-fight:latest \
  --registry-server $ACR_LOGIN_SERVER \
  --registry-username $ACR_USERNAME \
  --registry-password $ACR_PASSWORD \
  --target-port 8080 \
  --ingress external \
  --min-replicas 1 \
  --max-replicas 3 \
  --cpu 0.5 \
  --memory 1.0Gi \
  --env-vars NODE_ENV=production \
  --tags SecurityControl=Ignore \
  --output none

# Create YAML for volume mount
echo -e "${GREEN}Step 9: Configuring volume mount...${NC}"
cat > /tmp/containerapp-update.yaml << EOF
properties:
  template:
    containers:
    - name: $CONTAINER_APP_NAME
      image: $ACR_LOGIN_SERVER/babe-fight:latest
      resources:
        cpu: 0.5
        memory: 1Gi
      volumeMounts:
      - volumeName: sqlite-volume
        mountPath: /app/backend/data
    volumes:
    - name: sqlite-volume
      storageType: AzureFile
      storageName: sqlitestorage
EOF

az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --yaml /tmp/containerapp-update.yaml \
  --output none

# Save deployment info for updates
echo -e "${GREEN}Step 10: Saving deployment configuration...${NC}"
cat > .azure-deployment-info << EOF
RESOURCE_GROUP="$RESOURCE_GROUP"
CONTAINER_APP_NAME="$CONTAINER_APP_NAME"
CONTAINER_APP_ENV="$CONTAINER_APP_ENV"
ACR_NAME="$ACR_NAME"
STORAGE_ACCOUNT="$STORAGE_ACCOUNT"
EOF

# Add to .gitignore
if ! grep -q ".azure-deployment-info" .gitignore 2>/dev/null; then
    echo ".azure-deployment-info" >> .gitignore
fi

# Get app URL
APP_URL=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv)

echo ""
echo -e "${GREEN}=== Deployment Complete! ===${NC}"
echo ""
echo -e "${YELLOW}App URL:${NC} https://$APP_URL"
echo ""
echo -e "${YELLOW}Useful commands:${NC}"
echo "View logs:"
echo "  az containerapp logs show --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --follow"
echo ""
echo "Update app (after code changes):"
echo "  ./update-app.sh"
echo ""
echo "Manual update commands:"
echo "  docker buildx build --platform linux/amd64 -t $ACR_LOGIN_SERVER/babe-fight:latest --load ."
echo "  docker push $ACR_LOGIN_SERVER/babe-fight:latest"
echo "  az containerapp update --name $CONTAINER_APP_NAME --resource-group $RESOURCE_GROUP --image $ACR_LOGIN_SERVER/babe-fight:latest"
echo ""
echo "Delete everything:"
echo "  az group delete --name $RESOURCE_GROUP --yes"
echo ""
