# Azure Container Apps Architecture

## Overview

BABE Fight is deployed as a containerized application on Azure Container Apps, using a monolithic architecture that combines a React frontend, Node.js backend, and SQLite database with persistent storage.

## Architecture Components

### Application Stack
- **Frontend**: React + Vite (built to static files)
- **Backend**: Node.js + Express + Socket.IO
- **Database**: SQLite with Azure File Share persistence
- **Container Runtime**: Node.js 20 Alpine Linux

### Azure Resources

**With SQLite (Current Setup):**
```
┌─────────────────────────────────────────────────────────┐
│                    Resource Group                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Azure Container Registry (ACR)                    │ │
│  │  - Stores Docker images                            │ │
│  │  - Basic SKU                                       │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Storage Account (REQUIRED for SQLite)            │ │
│  │  ├─ Azure File Share (sqlitedata)                 │ │
│  │  └─ Mounted at: /app/backend/data                 │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Container Apps Environment                        │ │
│  │  ├─ Container App (babe-fight-app)                │ │
│  │  │  ├─ Image: ACR/babe-fight:latest               │ │
│  │  │  ├─ Port: 8080                                 │ │
│  │  │  ├─ Replicas: 1-3 (auto-scale)                │ │
│  │  │  ├─ CPU: 0.5 vCPU                              │ │
│  │  │  ├─ Memory: 1GB                                │ │
│  │  │  └─ Volume: sqlitestorage → /app/backend/data │ │
│  │  └─ Ingress: External HTTPS                       │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**With Azure SQL Database (Alternative):**
```
┌─────────────────────────────────────────────────────────┐
│                    Resource Group                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Azure Container Registry (ACR)                    │ │
│  │  - Stores Docker images                            │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Azure SQL Database (REPLACES Storage Account)    │ │
│  │  ├─ Managed database service                      │ │
│  │  ├─ Connection via connection string              │ │
│  │  └─ NO file storage needed                        │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Container Apps Environment                        │ │
│  │  ├─ Container App (babe-fight-app)                │ │
│  │  │  ├─ Image: ACR/babe-fight:latest               │ │
│  │  │  ├─ Port: 8080                                 │ │
│  │  │  ├─ Replicas: 1-3 (auto-scale)                │ │
│  │  │  ├─ CPU: 0.5 vCPU                              │ │
│  │  │  ├─ Memory: 1GB                                │ │
│  │  │  ├─ NO volume mount needed                    │ │
│  │  │  └─ Env: DATABASE_CONNECTION_STRING           │ │
│  │  └─ Ingress: External HTTPS                       │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

> **💡 Note**: Storage Account is **only needed for SQLite**. If you migrate to Azure SQL Database, you can remove the Storage Account entirely, simplifying deployment and reducing costs by ~$1/month.

## Request Flow

```
User Browser (HTTPS)
    ↓
Azure Load Balancer
    ↓
Container App Replica(s) [1-3 instances]
    ├─ Express Server
    │   ├─ REST API Endpoints (/api/games, /api/scores)
    │   ├─ Static File Server (serves React build)
    │   └─ Socket.IO (WebSocket for real-time gameplay)
    │
    └─ SQLite Database
        └─ Azure File Share (persistent across restarts)
```

## Docker Build Strategy

### Multi-Stage Build Process

**Stage 1: Frontend Builder**
```dockerfile
FROM node:20-alpine AS frontend-builder
- Install frontend dependencies
- Build React app with Vite
- Output: /app/frontend/dist (static files)
```

**Stage 2: Production Image**
```dockerfile
FROM node:20-alpine
- Copy backend with production dependencies
- Copy built frontend static files
- Copy Resources (courses.json, turbo-default.json)
- Create /app/backend/data directory for SQLite
- Expose port 8080
- Run as non-root user (node)
```

### Platform Considerations
- Built for **linux/amd64** architecture (Azure's platform)
- Uses Docker Buildx for cross-platform builds from ARM Macs
- Single container serves both API and frontend

## Deployment Process

### Initial Deployment

1. **Resource Provisioning** ([deploy-container-apps.sh](deploy-container-apps.sh))
   ```bash
   ./deploy-container-apps.sh
   ```
   - Creates Resource Group
   - Creates Azure Container Registry
   - Creates Storage Account + File Share
   - Creates Container Apps Environment
   - Configures persistent storage mount

2. **Image Build & Push**
   ```bash
   docker buildx build --platform linux/amd64 -t <acr>.azurecr.io/babe-fight:latest --load .
   docker push <acr>.azurecr.io/babe-fight:latest
   ```

3. **Container App Deployment**
   - Pulls image from ACR
   - Configures ingress (external HTTPS)
   - Mounts Azure File Share to `/app/backend/data`
   - Sets environment variables (`NODE_ENV=production`)
   - Starts with 1 replica, auto-scales to 3

### Update Deployment

After code changes:
```bash
./update-app.sh
```

**Update Flow:**
1. Rebuild Docker image for AMD64
2. Push new image to ACR (same tag: `latest`)
3. Trigger Container App update
4. Azure pulls new image and performs rolling update
5. Zero-downtime deployment (old replicas stay until new ones are healthy)

## Data Persistence

### SQLite Database Strategy

**Challenge**: Container Apps are ephemeral (containers restart/update)

**Solution**: Azure File Share mounted as volume

```
Container: /app/backend/data
              ↓ (mounted)
Azure File Share: sqlitedata
              ↓ (persists)
SQLite file: database.db
```

**Benefits:**
- Database survives container restarts
- Database survives deployments/updates
- Shared across replicas (but see limitations below)

**Limitations:**
- SQLite + multiple replicas = potential lock contention
- Azure File Share has higher latency than local disk
- Not ideal for high-concurrency write scenarios

## Scaling Configuration

### Auto-Scaling Rules

**Current Configuration:**
- **Min Replicas**: 1 (always-on)
- **Max Replicas**: 3 (scales under load)
- **Scale Triggers**: HTTP traffic, CPU/memory metrics

**Cost Optimization Option:**
```bash
az containerapp update --min-replicas 0 --max-replicas 3
```
- Scales to zero after ~15 minutes idle
- Cold start: 3-5 seconds on first request
- Reduces cost by ~50% for low-traffic periods

### Resource Allocation Per Replica
- **CPU**: 0.5 vCPU
- **Memory**: 1GB RAM
- **Storage**: Shared Azure File Share

## Monitoring & Operations

### View Logs
```bash
az containerapp logs show \
  --name babe-fight-app \
  --resource-group babe-fight-rg \
  --follow
```

### Check Status
```bash
az containerapp show \
  --name babe-fight-app \
  --resource-group babe-fight-rg \
  --query properties.runningStatus
```

### Get Application URL
```bash
az containerapp show \
  --name babe-fight-app \
  --resource-group babe-fight-rg \
  --query properties.configuration.ingress.fqdn
```

Output: `https://babe-fight-app.xxx.azurecontainerapps.io`

## Cost Breakdown

### Estimated Monthly Costs

**With SQLite + Storage Account:**

*Always-On (min-replicas=1):*
- Container Apps: ~$15-25/month
- Container Registry (Basic): ~$5/month
- Storage Account (1GB File Share): ~$1/month
- **Total**: ~$20-30/month

*Scale-to-Zero (min-replicas=0):*
- Container Apps: ~$5-10/month (usage-based)
- Container Registry: ~$5/month
- Storage Account: ~$1/month
- **Total**: ~$10-15/month

**With Azure SQL Database (Alternative):**

*Always-On (min-replicas=1):*
- Container Apps: ~$15-25/month
- Container Registry (Basic): ~$5/month
- Azure SQL (Basic tier): ~$5/month
- **Total**: ~$25-35/month

*Benefits of Azure SQL:*
- ✅ Supports multiple replicas (no SQLite lock issues)
- ✅ Automatic backups included
- ✅ Better performance for concurrent users
- ✅ No volume mount complexity
- ✅ Point-in-time restore capability

## Network Configuration

### Ingress
- **Type**: External (public internet)
- **Protocol**: HTTPS (TLS termination by Azure)
- **Port**: 8080 (internal container port)
- **URL**: Auto-generated FQDN by Azure

### WebSocket Support
- Socket.IO works natively with Container Apps
- Sticky sessions enabled by default
- WebSocket upgrade handled automatically

## Security Considerations

### Container Security
- Runs as non-root user (`node`)
- Minimal Alpine Linux base image
- Production dependencies only

### Network Security
- HTTPS enforced by Azure (automatic TLS)
- No SSH/shell access to containers
- Private ACR access (credentials managed)

### Data Security
- Azure File Share encrypted at rest
- Storage account key stored in Container Apps environment
- No database credentials exposed (SQLite is file-based)

## Known Limitations & Considerations

### 1. SQLite + Multiple Replicas
**Issue**: SQLite doesn't handle concurrent writes well across multiple instances

**Current Risk**: With max-replicas=3, database lock contention possible under high load

**Solutions**:
- **Option A**: Set `max-replicas: 1` (single instance)
- **Option B**: Migrate to Azure SQL Database or PostgreSQL Flexible Server
- **Option C**: Implement connection pooling + write queue

### 2. Azure File Share Performance
**Issue**: Network-attached storage slower than local disk

**Impact**: Database operations ~10-50ms slower than local SQLite

**Mitigation**: Acceptable for this use case (game scoring, not high-frequency trading)

### 3. Cold Start Latency
**Issue**: With min-replicas=0, first request has 3-5 second delay

**Impact**: Poor UX for first user after idle period

**Mitigation**: Keep min-replicas=1 for consistent performance

## Migration Paths

### Future Scalability Options

If the application grows beyond current setup:

1. **Migrate to Azure SQL Database** (Recommended)
   - Replace SQLite with Azure SQL Database
   - **Remove Storage Account** (no longer needed)
   - Update backend to use connection string
   - Benefits: 
     - Better concurrency (supports multiple replicas)
     - Automatic backups and point-in-time restore
     - Better performance and scalability
     - Simpler deployment (no volume mounts)
   - Setup: Run `../scripts/create-azure-sql.sh`
   - Cost: +$5-15/month (Basic tier), -$1/month (remove storage)

2. **Separate Frontend & Backend**
   - Frontend → Azure Static Web Apps
   - Backend → Container Apps
   - Benefits: Better caching, CDN for frontend

3. **Azure Kubernetes Service (AKS)**
   - For complex microservices architecture
   - Benefits: More control, service mesh, advanced scaling

## Troubleshooting

### Common Issues

**Problem**: Container won't start
```bash
# Check logs for errors
az containerapp logs show --name babe-fight-app --resource-group babe-fight-rg --tail 100
```

**Problem**: Database not persisting
```bash
# Verify volume mount
az containerapp show --name babe-fight-app --resource-group babe-fight-rg \
  --query properties.template.volumes
```

**Problem**: App unreachable
```bash
# Check ingress configuration
az containerapp show --name babe-fight-app --resource-group babe-fight-rg \
  --query properties.configuration.ingress
```

## Deployment Configuration Files

Key files in the repository:

- **[../Dockerfile](../Dockerfile)**: Multi-stage build configuration
- **[../scripts/deploy-container-apps.sh](../scripts/deploy-container-apps.sh)**: Full deployment automation (SQLite + Storage Account)
- **[../scripts/update-app.sh](../scripts/update-app.sh)**: Quick update script for code changes
- **[CONTAINER_APPS_DEPLOY.md](CONTAINER_APPS_DEPLOY.md)**: Step-by-step deployment guide
- **[../scripts/setup-docker-buildx.sh](../scripts/setup-docker-buildx.sh)**: Configure Docker for cross-platform builds
- **[../scripts/create-azure-sql.sh](../scripts/create-azure-sql.sh)**: Migrate to Azure SQL Database (removes need for Storage Account)

## Quick Reference Commands

### Deploy from scratch
```bash
./deploy-container-apps.sh
```

### Update after code changes
```bash
./update-app.sh
```

### Manual update
```bash
docker buildx build --platform linux/amd64 -t <acr>.azurecr.io/babe-fight:latest --load .
docker push <acr>.azurecr.io/babe-fight:latest
az containerapp update --name babe-fight-app --resource-group babe-fight-rg \
  --image <acr>.azurecr.io/babe-fight:latest
```

### Cleanup
```bash
az group delete --name babe-fight-rg --yes
```

---

**Last Updated**: December 23, 2025  
**Azure Region**: Southeast Asia  
**Container Apps Tier**: Consumption
