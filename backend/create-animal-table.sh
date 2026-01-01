#!/bin/bash

# Load environment variables
source .env

# Run SQL script
echo "Creating animal_scores table..."
sqlcmd -S "$DB_SERVER" -d "$DB_NAME" -U "$DB_USER" -P "$DB_PASSWORD" -i create-animal-scores-table.sql

echo "Done!"
