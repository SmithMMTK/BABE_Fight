#!/bin/bash

# Script to recreate Azure SQL Database
# This will delete all data and create a fresh database with correct schema

RESOURCE_GROUP="babe-fight-rg"
SQL_SERVER="babefight-sql-1766424549"
DATABASE_NAME="babefightdb"

echo "⚠️  WARNING: This will DELETE ALL DATA in the database!"
echo "Database: $DATABASE_NAME"
echo "Server: $SQL_SERVER"
echo ""
read -p "Type 'yes' to continue: " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Cancelled"
  exit 1
fi

echo ""
echo "Step 1: Deleting existing database..."
az sql db delete \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name $DATABASE_NAME \
  --yes

if [ $? -eq 0 ]; then
  echo "✅ Database deleted"
else
  echo "❌ Failed to delete database"
  exit 1
fi

echo ""
echo "Step 2: Creating new database..."
az sql db create \
  --resource-group $RESOURCE_GROUP \
  --server $SQL_SERVER \
  --name $DATABASE_NAME \
  --service-objective Basic \
  --backup-storage-redundancy Local \
  --no-wait

echo ""
echo "⏳ Waiting for database creation (this may take 1-2 minutes)..."
sleep 30

# Check if database is ready
for i in {1..12}; do
  STATUS=$(az sql db show \
    --resource-group $RESOURCE_GROUP \
    --server $SQL_SERVER \
    --name $DATABASE_NAME \
    --query "status" -o tsv 2>/dev/null)
  
  if [ "$STATUS" == "Online" ]; then
    echo "✅ Database created successfully"
    break
  fi
  
  echo "⏳ Still creating... ($i/12)"
  sleep 10
done

echo ""
echo "✅ Database recreation complete!"
echo ""
echo "Next steps:"
echo "1. Deploy the app: bash scripts/update-app.sh"
echo "2. The database schema will be initialized automatically on first connection"
