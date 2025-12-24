#!/bin/bash

# Helper script to reset Azure SQL Server admin password

RESOURCE_GROUP="babe-fight-rg"
SQL_SERVER="babefight-sql-1766424549"

echo "🔐 Azure SQL Server Password Reset"
echo "=================================="
echo ""
echo "Server: $SQL_SERVER"
echo "Resource Group: $RESOURCE_GROUP"
echo ""
echo "⚠️  WARNING: This will change the password for the SQL Server admin account!"
echo "This may break existing applications if they use hardcoded passwords."
echo ""
read -p "Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Cancelled"
    exit 1
fi

echo ""
echo "Enter new password (must meet SQL Server requirements):"
echo "- At least 8 characters"
echo "- Contains uppercase, lowercase, numbers, and special characters"
echo ""
read -sp "New password: " NEW_PASSWORD
echo ""
read -sp "Confirm password: " CONFIRM_PASSWORD
echo ""
echo ""

if [ "$NEW_PASSWORD" != "$CONFIRM_PASSWORD" ]; then
    echo "❌ Passwords don't match"
    exit 1
fi

if [ ${#NEW_PASSWORD} -lt 8 ]; then
    echo "❌ Password must be at least 8 characters"
    exit 1
fi

echo "Updating SQL Server password..."
az sql server update \
    --resource-group $RESOURCE_GROUP \
    --name $SQL_SERVER \
    --admin-password "$NEW_PASSWORD"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Password updated successfully!"
    echo ""
    echo "⚠️  IMPORTANT: Update the following:"
    echo "1. backend/.env file (if exists)"
    echo "2. Azure Container App environment variables"
    echo ""
    echo "To update Container App:"
    echo "az containerapp update \\"
    echo "  --name babe-fight-app \\"
    echo "  --resource-group $RESOURCE_GROUP \\"
    echo "  --set-env-vars DB_PASSWORD=\"$NEW_PASSWORD\""
    echo ""
    read -p "Update Container App now? (yes/no): " update_app
    
    if [ "$update_app" == "yes" ]; then
        echo "Updating Container App..."
        az containerapp update \
            --name babe-fight-app \
            --resource-group $RESOURCE_GROUP \
            --set-env-vars DB_PASSWORD="$NEW_PASSWORD"
        
        echo ""
        echo "✅ Container App updated!"
    fi
    
    echo ""
    echo "Now run: bash scripts/setup-local-azure-sql.sh"
else
    echo ""
    echo "❌ Failed to update password"
    exit 1
fi
