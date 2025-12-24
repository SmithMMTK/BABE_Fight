# 🚀 Development Environment Quick Reference

## **ALWAYS Use Azure SQL for New Features!**

### Why?
- ✅ Catch SQL Server constraint errors **before** production
- ✅ Foreign key CASCADE behaviors differ between SQLite and MSSQL
- ✅ Data type differences (VARCHAR vs NVARCHAR, etc.)
- ✅ No deployment surprises!

---

## Setup (One-Time)

```bash
# Configure local environment to use Azure SQL
bash scripts/setup-local-azure-sql.sh
```

This will:
1. Create a development database (`babefightdb-dev`)
2. Add your IP to firewall rules
3. Create `backend/.env` with Azure SQL connection
4. Test the connection

---

## Daily Development Workflow

### 1. Start Development Server

```bash
bash scripts/run-local.sh
```

**Check the console output:**
- ✅ `💾 Database: MSSQL (babefightdb-dev)` = Good!
- ⚠️ `💾 Database: SQLITE (local SQLite)` = Warning, test with Azure SQL later!

### 2. Develop Your Feature

- Make code changes
- Test locally against **Azure SQL**
- Database schema changes? Test them locally first!

### 3. Test Schema Changes

If you modified `backend/src/db/database-mssql.js`:

```bash
# Restart server to reinitialize schema
# Check console for errors
```

Common Azure SQL gotchas:
- ❌ Circular CASCADE paths not allowed
- ❌ Use `ON DELETE NO ACTION` for complex FK relationships
- ❌ `VARCHAR` vs `NVARCHAR` matters
- ❌ `AUTOINCREMENT` → `IDENTITY(1,1)`

### 4. Deploy When Ready

```bash
# Commit changes
git add -A
git commit -m "feat: Your feature description"
git push origin feature/your-branch

# Deploy to Azure
bash scripts/update-app.sh
```

---

## Troubleshooting

### "Connection refused" or timeout

Your IP changed (WiFi, VPN, etc.):

```bash
# Update firewall rule
bash scripts/setup-local-azure-sql.sh
```

### "Foreign KEY constraint... circular cascade paths"

Fix in `backend/src/db/database-mssql.js`:
- Change `ON DELETE CASCADE` → `ON DELETE NO ACTION`
- Or remove foreign keys if not critical

**Then test locally!**

### Reset Development Database

```bash
bash scripts/recreate-azure-database.sh
# Choose option 1 for dev database
```

### Switch Back to SQLite (temporary)

Edit `backend/.env`:
```bash
DB_TYPE=sqlite
# Comment out DB_SERVER, DB_NAME, etc.
```

Restart server. But remember: **Test with Azure SQL before deploying!**

---

## Key Files

| File | Purpose |
|------|---------|
| `backend/.env` | Database connection config (NOT in git) |
| `backend/src/db/database-mssql.js` | Azure SQL schema |
| `backend/src/db/database.js` | SQLite schema |
| `scripts/setup-local-azure-sql.sh` | One-time setup |
| `scripts/update-app.sh` | Deploy to production |

---

## Best Practices

### ✅ DO:
- Use Azure SQL locally for feature development
- Test schema changes locally before deploying
- Use separate dev database (`babefightdb-dev`)
- Check server console for database type on startup

### ❌ DON'T:
- Deploy schema changes without local Azure SQL testing
- Use production database (`babefightdb`) for local dev
- Commit `backend/.env` to git
- Rely on SQLite for final testing

---

## Emergency: Rollback Production Deployment

If deployment fails in production:

```bash
# List recent versions
docker images | grep babe-fight

# Rollback to previous version
az containerapp update \
  --name babe-fight-app \
  --resource-group babe-fight-rg \
  --image babefightacr1766423153.azurecr.io/babe-fight:v20251223-HHMMSS
```

---

## Need Help?

📚 Detailed documentation: `docs/setup/LOCAL_AZURE_SQL_SETUP.md`

Common commands:
```bash
# View firewall rules
az sql server firewall-rule list \
  --resource-group babe-fight-rg \
  --server babefight-sql-1766424549 \
  --output table

# View databases
az sql db list \
  --resource-group babe-fight-rg \
  --server babefight-sql-1766424549 \
  --output table

# View deployment logs
az containerapp logs show \
  --name babe-fight-app \
  --resource-group babe-fight-rg \
  --follow
```

---

**Remember: Local Azure SQL = Happy Deployments! 🎉**
