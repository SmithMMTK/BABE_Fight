# Local Development with Azure SQL

## Why Use Azure SQL Locally?

Using Azure SQL for local development instead of SQLite prevents production deployment issues by:
- Testing the exact same database engine (MSSQL vs SQLite)
- Catching SQL Server-specific constraints and limitations early
- Validating foreign key constraints, CASCADE behaviors, and data types
- Ensuring feature parity between local and production environments

## Prerequisites

1. Azure CLI installed and logged in
2. Access to the Azure SQL Database
3. Your IP address whitelisted in Azure SQL firewall rules

## Setup Steps

### 1. Get Azure SQL Connection Details

```bash
# Get SQL Server name
az sql server show \
  --resource-group babe-fight-rg \
  --name babefight-sql-1766424549 \
  --query "fullyQualifiedDomainName" -o tsv

# Get current firewall rules
az sql server firewall-rule list \
  --resource-group babe-fight-rg \
  --server babefight-sql-1766424549 \
  --output table
```

### 2. Add Your IP to Firewall

```bash
# Get your current public IP
MY_IP=$(curl -s https://api.ipify.org)
echo "Your IP: $MY_IP"

# Add firewall rule for your IP
az sql server firewall-rule create \
  --resource-group babe-fight-rg \
  --server babefight-sql-1766424549 \
  --name "LocalDev-$(whoami)" \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

### 3. Configure Backend Environment

Create `backend/.env` with Azure SQL settings:

```bash
cd backend
cat > .env << 'EOF'
# Azure SQL Database Connection (for local dev matching production)
DB_TYPE=mssql
DB_SERVER=babefight-sql-1766424549.database.windows.net
DB_NAME=babefightdb
DB_USER=sqladmin
DB_PASSWORD=YourPasswordHere
DB_ENCRYPT=true

# Server Configuration
PORT=8080
NODE_ENV=development
EOF
```

**Important**: Get the actual password from:
```bash
# From Azure Portal: SQL Server > Settings > SQL databases
# Or ask team member who has it
```

### 4. Create Separate Development Database (Recommended)

To avoid affecting production data:

```bash
# Create a dev database
az sql db create \
  --resource-group babe-fight-rg \
  --server babefight-sql-1766424549 \
  --name babefightdb-dev \
  --service-objective Basic \
  --backup-storage-redundancy Local
```

Update your `.env`:
```
DB_NAME=babefightdb-dev
```

### 5. Test Connection

```bash
cd backend
npm install
node -e "
require('dotenv').config();
const sql = require('mssql');
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: { encrypt: true }
};
sql.connect(config).then(() => {
  console.log('✅ Connected to Azure SQL successfully!');
  process.exit(0);
}).catch(err => {
  console.error('❌ Connection failed:', err.message);
  process.exit(1);
});
"
```

### 6. Run Local Development Server

```bash
# From project root
bash scripts/run-local.sh
```

The server will:
- Connect to Azure SQL Database
- Initialize schema automatically
- Run on http://localhost:8080 (backend)
- Frontend served on http://localhost:5173 (Vite dev server)

## Development Workflow

### Testing Database Changes

1. **Make schema changes** in `backend/src/db/database-mssql.js`
2. **Test locally** against Azure SQL dev database
3. **Verify** no constraint errors or SQL Server-specific issues
4. **Commit and deploy** with confidence

### Resetting Development Database

```bash
# Drop and recreate dev database
az sql db delete \
  --resource-group babe-fight-rg \
  --server babefight-sql-1766424549 \
  --name babefightdb-dev \
  --yes

az sql db create \
  --resource-group babe-fight-rg \
  --server babefight-sql-1766424549 \
  --name babefightdb-dev \
  --service-objective Basic \
  --backup-storage-redundancy Local
```

## Troubleshooting

### Connection Refused / Timeout

**Cause**: Your IP not whitelisted in firewall

**Solution**:
```bash
MY_IP=$(curl -s https://api.ipify.org)
az sql server firewall-rule create \
  --resource-group babe-fight-rg \
  --server babefight-sql-1766424549 \
  --name "LocalDev-$(whoami)-$(date +%Y%m%d)" \
  --start-ip-address $MY_IP \
  --end-ip-address $MY_IP
```

### Login Failed for User

**Cause**: Wrong password or user doesn't exist

**Solution**: Verify credentials in Azure Portal or reset password:
```bash
az sql server update \
  --resource-group babe-fight-rg \
  --name babefight-sql-1766424549 \
  --admin-password 'NewSecurePassword123!'
```

### Foreign Key Constraint Errors

**Cause**: Circular CASCADE paths detected by SQL Server

**Solution**: This is exactly why we use Azure SQL locally! Fix the schema:
- Use `ON DELETE NO ACTION` instead of `CASCADE`
- Remove foreign keys if circular dependencies exist
- Test the fix locally before deploying

### Database Already Exists Error

**Cause**: Schema initialization script trying to create existing tables

**Solution**: The `IF NOT EXISTS` checks should handle this, but if needed:
```sql
-- Connect to database and manually drop tables
DROP TABLE IF EXISTS game_handicap_h2h;
DROP TABLE IF EXISTS game_turbo;
DROP TABLE IF EXISTS scores;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS games;
```

## Security Best Practices

1. **Never commit** `.env` file with real credentials
2. **Use separate databases** for dev/staging/production
3. **Rotate passwords** regularly
4. **Remove firewall rules** when not actively developing:
   ```bash
   az sql server firewall-rule delete \
     --resource-group babe-fight-rg \
     --server babefight-sql-1766424549 \
     --name "LocalDev-$(whoami)"
   ```

## Benefits of This Setup

✅ **Catch Issues Early**: SQL Server constraint errors appear locally, not in production  
✅ **True Environment Parity**: Same database engine as production  
✅ **Faster Debugging**: Test schema changes without deploying to Azure Container Apps  
✅ **No Surprises**: Foreign key behaviors match production exactly  
✅ **Team Collaboration**: Shared dev database option for testing integrations  

## Alternative: SQLite for Quick Prototyping

If you need SQLite for rapid prototyping:

```bash
# In backend/.env
DB_TYPE=sqlite
# Comment out all DB_SERVER, DB_NAME, etc.
```

But remember: **Always test with Azure SQL before deploying to production!**
