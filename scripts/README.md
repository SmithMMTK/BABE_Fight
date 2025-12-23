# Deployment and Utility Scripts

This folder contains all scripts for deployment, development, and database management.

## Azure Container Apps Deployment

### 🚀 Initial Deployment
```bash
./deploy-container-apps.sh
```
Complete end-to-end deployment to Azure Container Apps:
- Creates resource group, ACR, storage account
- Builds and pushes Docker image
- Deploys container app with persistent storage
- Saves deployment configuration

### 🔄 Update Existing Deployment
```bash
./update-app.sh
```
Quick update after code changes:
- Rebuilds Docker image
- Pushes to existing ACR
- Updates container app (zero-downtime rolling update)

## Database Setup

### 🗄️ Azure SQL Database
```bash
./create-azure-sql.sh
```
Alternative to SQLite - creates Azure SQL Database:
- Provisions Azure SQL Server
- Creates database
- Configures firewall rules
- Outputs connection string

**Note**: Requires backend code changes to use SQL instead of SQLite

## Development

### 💻 Local Development
```bash
./run-local.sh
```
Starts the application locally:
- Runs backend server
- Serves frontend (if built)
- Uses local SQLite database

### 🐳 Docker Buildx Setup
```bash
./setup-docker-buildx.sh
```
Configures Docker for cross-platform builds:
- Creates buildx builder instance
- Enables AMD64 builds on ARM Macs
- Required before deploying to Azure

## Prerequisites

All scripts require:
- **Azure CLI**: `brew install azure-cli`
- **Docker Desktop**: Running and authenticated
- **Azure Subscription**: Valid subscription with permissions

## Script Details

| Script | Purpose | When to Use |
|--------|---------|-------------|
| `deploy-container-apps.sh` | Full Azure deployment | First time setup |
| `update-app.sh` | Update deployed app | After code changes |
| `create-azure-sql.sh` | Setup Azure SQL | Replace SQLite with managed DB |
| `run-local.sh` | Local development | Testing locally |
| `setup-docker-buildx.sh` | Docker configuration | Before first deployment (ARM Macs) |

## Configuration Files

After running `deploy-container-apps.sh`, a `.azure-deployment-info` file is created in the project root with deployment details:
```bash
RESOURCE_GROUP="babe-fight-rg"
CONTAINER_APP_NAME="babe-fight-app"
ACR_NAME="babefightacr..."
```

This file is used by `update-app.sh` for quick updates.

## Documentation

See [../docs/AZURE_ARCHITECTURE.md](../docs/AZURE_ARCHITECTURE.md) for complete architecture documentation.
