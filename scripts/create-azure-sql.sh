#!/bin/bash
set -e

echo "=== Creating Azure SQL Database for BABE Fight ==="
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Read existing deployment info
if [ ! -f ".azure-deployment-info" ]; then
    echo -e "${RED}Error: Deployment info not found${NC}"
    echo "Please run ./deploy-container-apps.sh first"
    exit 1
fi

source .azure-deployment-info

# SQL Server variables
SQL_SERVER_NAME="babefight-sql-$(date +%s)"
SQL_DB_NAME="babefightdb"
SQL_ADMIN_USER="sqladmin"
SQL_ADMIN_PASSWORD="BabeFight2025!@#$(openssl rand -hex 4)"
LOCATION="southeastasia"

echo -e "${YELLOW}Configuration:${NC}"
echo "Resource Group: $RESOURCE_GROUP"
echo "SQL Server: $SQL_SERVER_NAME"
echo "Database: $SQL_DB_NAME"
echo "Admin User: $SQL_ADMIN_USER"
echo ""
echo -e "${YELLOW}⚠️  Save this password securely:${NC}"
echo -e "${GREEN}Password: $SQL_ADMIN_PASSWORD${NC}"
echo ""
read -p "Continue with SQL Database creation? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
fi

# Create SQL Server
echo -e "${GREEN}Step 1: Creating Azure SQL Server...${NC}"
az sql server create \
  --name $SQL_SERVER_NAME \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --admin-user $SQL_ADMIN_USER \
  --admin-password "$SQL_ADMIN_PASSWORD" \
  --output none

echo "SQL Server created successfully"

# Configure firewall - Allow Azure services
echo -e "${GREEN}Step 2: Configuring firewall rules...${NC}"
az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER_NAME \
  --name AllowAzureServices \
  --start-ip-address 0.0.0.0 \
  --end-ip-address 0.0.0.0 \
  --output none

# Allow your current IP for management
MY_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER_NAME \
  --name AllowMyIP \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP \
  --output none

echo "Firewall rules configured"

# Create SQL Database (Basic tier - lowest DTU)
echo -e "${GREEN}Step 3: Creating SQL Database (Basic tier, 5 DTU)...${NC}"
az sql db create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER_NAME \
  --name $SQL_DB_NAME \
  --service-objective Basic \
  --backup-storage-redundancy Local \
  --output none

echo "SQL Database created successfully"

# Get connection string
SQL_SERVER_FQDN="${SQL_SERVER_NAME}.database.windows.net"
CONNECTION_STRING="Server=tcp:${SQL_SERVER_FQDN},1433;Initial Catalog=${SQL_DB_NAME};Persist Security Info=False;User ID=${SQL_ADMIN_USER};Password=${SQL_ADMIN_PASSWORD};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

# Save SQL info to deployment config
cat >> .azure-deployment-info << EOF
SQL_SERVER_NAME="$SQL_SERVER_NAME"
SQL_DB_NAME="$SQL_DB_NAME"
SQL_ADMIN_USER="$SQL_ADMIN_USER"
SQL_ADMIN_PASSWORD="$SQL_ADMIN_PASSWORD"
SQL_SERVER_FQDN="$SQL_SERVER_FQDN"
EOF

# Create .env file for local development
cat > backend/.env << EOF
# Azure SQL Database Connection
DB_TYPE=mssql
DB_SERVER=$SQL_SERVER_FQDN
DB_NAME=$SQL_DB_NAME
DB_USER=$SQL_ADMIN_USER
DB_PASSWORD=$SQL_ADMIN_PASSWORD
DB_ENCRYPT=true
EOF

echo ""
echo -e "${GREEN}=== Azure SQL Database Created Successfully! ===${NC}"
echo ""
echo -e "${YELLOW}Connection Details:${NC}"
echo "Server: $SQL_SERVER_FQDN"
echo "Database: $SQL_DB_NAME"
echo "Username: $SQL_ADMIN_USER"
echo "Password: $SQL_ADMIN_PASSWORD"
echo ""
echo -e "${YELLOW}Connection String:${NC}"
echo "$CONNECTION_STRING"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update backend code to use mssql"
echo "2. Run: ./update-app.sh"
echo ""
echo -e "${YELLOW}💰 Cost Estimate:${NC}"
echo "Basic tier (5 DTU): ~$5/month (₹150-200/month)"
echo ""
echo -e "${RED}⚠️  IMPORTANT: Save the password above - you cannot retrieve it later!${NC}"
echo ""
