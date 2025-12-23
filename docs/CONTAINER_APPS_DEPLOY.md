# Deploy to Azure Container Apps

## Prerequisites
- Azure CLI installed: `brew install azure-cli`
- Docker Desktop running
- Azure subscription

## Step 1: Login to Azure
```bash
az login
az account set --subscription "YOUR_SUBSCRIPTION_NAME_OR_ID"
```

## Step 2: Create Azure Resources
```bash
# Set variables
RESOURCE_GROUP="babe-fight-rg"
LOCATION="southeastasia"
CONTAINER_APP_ENV="babe-fight-env"
CONTAINER_APP_NAME="babe-fight-app"
ACR_NAME="babefightacr"  # must be globally unique, use lowercase only
STORAGE_ACCOUNT="babefightstore"  # must be globally unique
FILE_SHARE_NAME="sqlitedata"

# Create resource group
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Create Azure Container Registry
az acr create \
  --resource-group $RESOURCE_GROUP \
  --name $ACR_NAME \
  --sku Basic \
  --admin-enabled true

# Create Storage Account for SQLite persistence
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Get storage account key
STORAGE_KEY=$(az storage account keys list \
  --resource-group $RESOURCE_GROUP \
  --account-name $STORAGE_ACCOUNT \
  --query "[0].value" -o tsv)

# Create file share for SQLite database
az storage share create \
  --name $FILE_SHARE_NAME \
  --account-name $STORAGE_ACCOUNT \
  --account-key $STORAGE_KEY \
  --quota 1

# Create Container Apps environment
az containerapp env create \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Add storage to Container Apps environment
az containerapp env storage set \
  --name $CONTAINER_APP_ENV \
  --resource-group $RESOURCE_GROUP \
  --storage-name sqlitestorage \
  --azure-file-account-name $STORAGE_ACCOUNT \
  --azure-file-account-key $STORAGE_KEY \
  --azure-file-share-name $FILE_SHARE_NAME \
  --access-mode ReadWrite
```

## Step 3: Build and Push Docker Image
```bash
# Get ACR login server
ACR_LOGIN_SERVER=$(az acr show \
  --name $ACR_NAME \
  --query loginServer -o tsv)

# Login to ACR
az acr login --name $ACR_NAME

# Build and push image (for AMD64 architecture)
# Note: Use buildx for ARM Macs to build AMD64 images
docker buildx build --platform linux/amd64 -t $ACR_LOGIN_SERVER/babe-fight:latest --load .
docker push $ACR_LOGIN_SERVER/babe-fight:latest
```

## Step 4: Deploy Container App
```bash
# Get ACR credentials
ACR_USERNAME=$(az acr credential show \
  --name $ACR_NAME \
  --query username -o tsv)

ACR_PASSWORD=$(az acr credential show \
  --name $ACR_NAME \
  --query "passwords[0].value" -o tsv)

# Create container app with persistent storage
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
  --memory 1.0Gi

# Mount storage volume
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --set-env-vars NODE_ENV=production \
  --cpu 0.5 \
  --memory 1.0Gi
```

## Step 5: Add Volume Mount (Manual - via Azure Portal)
**Azure Portal method (easier):**
1. Go to Azure Portal → Container Apps → Your app
2. Click "Containers" → Select your container
3. Scroll to "Volume mounts"
4. Add volume:
   - **Storage name**: `sqlitestorage`
   - **Mount path**: `/app/backend/data`
5. Save

**OR via Azure CLI:**
```bash
# Create YAML configuration file
cat > containerapp.yaml << 'EOF'
properties:
  configuration:
    ingress:
      external: true
      targetPort: 8080
  template:
    containers:
    - image: <ACR_LOGIN_SERVER>/babe-fight:latest
      name: babe-fight-app
      resources:
        cpu: 0.5
        memory: 1Gi
      volumeMounts:
      - volumeName: sqlite-volume
        mountPath: /app/backend/data
    scale:
      minReplicas: 1
      maxReplicas: 3
    volumes:
    - name: sqlite-volume
      storageType: AzureFile
      storageName: sqlitestorage
EOF

# Apply configuration
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --yaml containerapp.yaml
```

## Step 6: Get App URL
```bash
az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.configuration.ingress.fqdn \
  -o tsv
```

Your app will be available at: `https://<your-app-name>.xxx.azurecontainerapps.io`

## Update Deployment (After Code Changes)
```bash
# Rebuild and push new image (AMD64 for ARM Macs)
docker buildx build --platform linux/amd64 -t $ACR_LOGIN_SERVER/babe-fight:latest --load .
docker push $ACR_LOGIN_SERVER/babe-fight:latest

# Update container app (will pull new image)
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $ACR_LOGIN_SERVER/babe-fight:latest
```

## Monitoring & Logs
```bash
# View logs
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --follow

# View app status
az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query properties.runningStatus
```

## Cost Optimization
```bash
# Scale to zero when not in use
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --min-replicas 0 \
  --max-replicas 3
```

**Note**: With min-replicas=0, app will scale to zero after ~15 minutes of no traffic. First request after scale-to-zero will have ~3-5 second cold start.

## Clean Up
```bash
# Delete everything
az group delete --name $RESOURCE_GROUP --yes
```

## Troubleshooting

### Check container logs
```bash
az containerapp logs show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --tail 100
```

### Test database persistence
1. Create a game in the app
2. Restart the container: `az containerapp revision restart ...`
3. Check if game still exists

### Common Issues
- **Database file permission error**: Make sure volume mount path is `/app/backend/data`
- **App not starting**: Check logs for port binding issues
- **Slow cold start**: Increase min-replicas to 1

## Estimated Monthly Cost
- **Container Apps**: ~$15-25/month (0.5 vCPU, 1GB RAM, 1-3 replicas)
- **Container Registry**: ~$5/month (Basic tier)
- **Storage Account**: ~$1/month (1GB file share)
- **Total**: ~$20-30/month

With scale-to-zero (min-replicas=0): ~$10-15/month if low traffic
