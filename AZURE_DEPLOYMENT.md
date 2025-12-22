# Azure Deployment Guide - Single App Service with Persistent Storage

## Architecture (Updated per Requirements)

```
Azure App Service (Node.js) - SINGLE DEPLOYMENT
├── Express Backend (API + Socket.IO)
├── React Frontend (Static files served by Express)
└── SQLite Database (/home/data - Azure persistent storage)
```

**Key Benefits:**
- ✅ **Single App Service** - No separate database service needed
- ✅ **Persistent Storage** - Uses Azure App Service `/home/data` mount (persists across restarts)
- ✅ **Cost Effective** - Only one App Service resource (~$13-73/month depending on tier)
- ✅ **Stateless Authentication** - PIN + Username works on any device

## Prerequisites

- Azure subscription
- Azure CLI installed (`az --version`)
- Node.js 18+ installed locally
- Git for deployment

## Step-by-Step Deployment

### 1. Install Azure CLI (if needed)

```bash
# macOS
brew install azure-cli

# Verify installation
az --version
```

### 2. Login to Azure

```bash
az login
```

### 3. Create Resource Group

```bash
az group create \
  --name babe-fight-rg \
  --location eastus
```

### 4. Create App Service Plan

```bash
az appservice plan create \
  --name babe-fight-plan \
  --resource-group babe-fight-rg \
  --location eastus \
  --sku B1 \
  --is-linux
```

### 5. Create Web App

```bash
az webapp create \
  --resource-group babe-fight-rg \
  --plan babe-fight-plan \
  --name babe-fight-app \
  --runtime "NODE:18-lts"
```

### 6. Enable WebSocket Support (Required for Socket.IO)

```bash
az webapp config set \
  --resource-group babe-fight-rg \
  --name babe-fight-app \
  --web-sockets-enabled true
```

### 7. Configure Application Settings

```bash
az webapp config appsettings set \
  --resource-group babe-fight-rg \
  --name babe-fight-app \
  --settings \
    NODE_ENV=production \
    JWT_SECRET="$(openssl rand -base64 32)" \
    PORT=8080 \
    WEBSITES_PORT=8080 \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    WEBSITE_NODE_DEFAULT_VERSION=18-lts
```

### 8. Enable "Always On" (Recommended for Production)

```bash
az webapp config set \
  --resource-group babe-fight-rg \
  --name babe-fight-app \
  --always-on true
```

### 9. Deploy Using Local Git

```bash
# Get Git deployment URL and credentials
az webapp deployment source config-local-git \
  --resource-group babe-fight-rg \
  --name babe-fight-app

# Get deployment credentials
az webapp deployment list-publishing-credentials \
  --resource-group babe-fight-rg \
  --name babe-fight-app \
  --query "{Username:publishingUserName, Password:publishingPassword}" \
  --output table

# Add Azure as git remote
git remote add azure https://<app-name>.scm.azurewebsites.net/<app-name>.git

# Deploy
git add .
git commit -m "Deploy to Azure App Service"
git push azure main:master
```

### 10. Alternative: Deploy Using ZIP

```bash
# Make deploy script executable
chmod +x deploy.sh

# Build the application
./deploy.sh

# Create deployment package
zip -r deploy.zip . -x "*.git*" -x "*node_modules/*" -x "*.env.local"

# Deploy
az webapp deployment source config-zip \
  --resource-group babe-fight-rg \
  --name babe-fight-app \
  --src deploy.zip
```

## Important: Persistent Storage Configuration

Azure App Service provides persistent storage at `/home/data` which survives restarts and redeployments. The application is already configured to use this location.

```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name babe-fight-app \
  --resource-group babe-fight-rg \
  --hostname www.yourdomain.com

# Enable HTTPS
az webapp update \
  --resource-group babe-fight-rg \
  --name babe-fight-app \
  --https-only true
```

## Environment Variables Required

Set these in Azure Portal or CLI:

```bash
NODE_ENV=production
JWT_SECRET=your-strong-secret-key
DATABASE_URL=postgresql://user:pass@host:5432/dbname?sslmode=require
PORT=8080
WEBSITES_PORT=8080
CORS_ORIGIN=https://babe-fight-app.azurewebsites.net
```

## Database Migration from SQLite to PostgreSQL

Install PostgreSQL adapter:

```bash
cd backend
npm install pg
```

Update `backend/src/db/database.js` to use PostgreSQL instead of SQLite for production.

## Monitoring & Troubleshooting

### View Logs

```bash
az webapp log tail \
  --resource-group babe-fight-rg \
  --name babe-fight-app
```

### Enable Application Insights

```bash
az monitor app-insights component create \
  --app babe-fight-insights \
  --location eastus \
  --resource-group babe-fight-rg
**Database Location:** `/home/data/babe-fight.db`
- This directory persists across app restarts and updates
- Automatically backed up if you enable App Service backup
- No additional database service needed

## Environment Variables

Required settings (set via Azure Portal or CLI):

```bash
NODE_ENV=production
JWT_SECRET=<generate-strong-secret>
PORT=8080
WEBSITES_PORT=8080
WEBSITE_NODE_DEFAULT_VERSION=18-lts
```

## Configure Custom Domain (Optional)
- **App Service (B1)**: ~$13/month
- **PostgreSQL Flexible Server (Burstable)**: ~$12/month
- **Total**: ~$25/month

For production with auto-scaling, consider P1V2 tier (~$73/month).

## Important Notes

1. Monitoring & Troubleshooting

### View Application Logs

```bash
az webapp log tail \
  --resource-group babe-fight-rg \
  --n✅ Persistent Storage**: Database stored in `/home/data` persists across restarts
2. **✅ WebSocket Support**: Enabled for Socket.IO real-time features
3. **✅ Single Deployment**: Frontend and backend on same domain (no CORS issues)
4. **✅ Cost Effective**: No separate database service needed
5. **⚠️ Backup**: Enable App Service backup to protect database
6. **⚠️ Scale Limit**: SQLite has limitations for high concurrency (consider PostgreSQL if needed)
7. **✅ Always On**: Enable for production to prevent cold starts

### When to Consider Separate Database

If you experience:
- High concurrent user load (100+ simultaneous players)
- Need for read replicas or geographic distribution
- Database size > 5GB

Then consider migrating to Azure Database for PostgreSQL or Cosmos DB.
```bash
az webapp log tail \
  --resource-group babe-fight-rg \
  --name babe-fight-app \
  --provider application
```

### Check Database File

```bash
# Connect to App Service console
az webapp ssh \
  --resource-group babe-fight-rg \
  --name babe-fight-app

# Once connected, check database
ls -lah /home/data/
## Cleanup Resources

When done testing:

```bash
az group delete --name babe-fight-rg --yes --no-wait
```

## Next Steps

- Set up CI/CD with GitHub Actions
**Single App Service Deployment:**
- **App Service (B1 Basic)**: ~$13/month
  - 1 Core, 1.75 GB RAM
  - 10 GB storage (includes persistent /home directory)
  - Good for small to medium usage
  
- **App Service (P1V2 Production)**: ~$73/month  
  - 1 Core, 3.5 GB RAM
  - Always On, Auto-scaling
  - Better for production workloads

**Total Cost: $13-73/month** (no separate database costs!)

### Scaling Options

```bash
# Scale up to Production tier
az appservice plan update \
  --resource-group babe-fight-rg \
  --name babe-fight-plan \
  --sku P1V2

# Scale out (add instances)
az appservice plan update \
  --resource-group babe-fight-rg \
  --name babe-fight-plan \
  --number-of-workers 2
```