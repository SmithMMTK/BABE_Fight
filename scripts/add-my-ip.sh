#!/bin/bash

# Script to detect current IP and add to Azure SQL Firewall
# Usage: ./scripts/add-my-ip.sh

set -e

# Configuration
RESOURCE_GROUP="01-babe-fight"
SQL_SERVER="babefight-sql-1766476411"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Detecting current public IP address..."

# Get current public IP
CURRENT_IP=$(curl -s https://api.ipify.org)

if [ -z "$CURRENT_IP" ]; then
    echo -e "${RED}❌ Failed to detect IP address${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Current IP: $CURRENT_IP${NC}"

# Generate rule name with timestamp
RULE_NAME="dev-ip-$(date +%Y%m%d-%H%M%S)"

echo "🔧 Adding firewall rule: $RULE_NAME"

# Add firewall rule
az sql server firewall-rule create \
    --resource-group "$RESOURCE_GROUP" \
    --server "$SQL_SERVER" \
    --name "$RULE_NAME" \
    --start-ip-address "$CURRENT_IP" \
    --end-ip-address "$CURRENT_IP" \
    --output table

echo -e "${GREEN}✅ Firewall rule added successfully${NC}"
echo ""
echo "📋 Current firewall rules:"
az sql server firewall-rule list \
    --resource-group "$RESOURCE_GROUP" \
    --server "$SQL_SERVER" \
    --output table

echo ""
echo -e "${YELLOW}💡 Note: Old dev-ip rules can be cleaned up manually if needed${NC}"
