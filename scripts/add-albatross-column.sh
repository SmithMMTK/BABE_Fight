#!/bin/bash

# Migration script to add albatross column to game_scoring_config table
# Run this to update your Azure SQL database schema

set -e

echo "🦩 Add Albatross Column - Database Migration"
echo "============================================="
echo ""

# Check for .env file
if [ ! -f backend/.env ]; then
    echo "❌ Error: backend/.env file not found"
    echo "Please create backend/.env with your database credentials"
    exit 1
fi

# Load environment variables
source backend/.env

if [ -z "$DB_SERVER" ] || [ -z "$DB_NAME" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error: Missing database credentials in backend/.env"
    echo "Required variables: DB_SERVER, DB_NAME, DB_USER, DB_PASSWORD"
    exit 1
fi

echo "📊 Database: $DB_NAME"
echo "🖥️  Server: $DB_SERVER"
echo ""

# Check if sqlcmd is available
if ! command -v sqlcmd &> /dev/null; then
    echo "❌ Error: sqlcmd is not installed"
    echo ""
    echo "Install options:"
    echo "  macOS: brew install mssql-tools18"
    echo "  Linux: https://docs.microsoft.com/en-us/sql/linux/sql-server-linux-setup-tools"
    echo ""
    exit 1
fi

echo "Running migration..."
echo ""

# Run the migration
sqlcmd -S "$DB_SERVER" -d "$DB_NAME" -U "$DB_USER" -P "$DB_PASSWORD" -C \
    -i backend/add-albatross-column.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration completed successfully!"
    echo ""
    echo "Column 'albatross' has been added to 'game_scoring_config' table"
    echo "  - albatross (INT, default: 10)"
    echo ""
else
    echo ""
    echo "❌ Migration failed"
    echo "Please check the error message above"
    exit 1
fi
