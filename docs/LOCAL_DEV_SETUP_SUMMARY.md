# Local Azure SQL Development Setup - Complete

## ✅ What Was Created

### 1. **Setup Script** (`scripts/setup-local-azure-sql.sh`)
Automated one-time configuration:
- Creates dev database or uses production (with warning)
- Adds your IP to firewall rules
- Generates `backend/.env` with connection details
- Tests connection automatically

### 2. **Documentation**
- [`docs/setup/LOCAL_AZURE_SQL_SETUP.md`](./setup/LOCAL_AZURE_SQL_SETUP.md) - Detailed setup guide
- [`docs/DEVELOPMENT_WORKFLOW.md`](./DEVELOPMENT_WORKFLOW.md) - Quick reference card
- Updated [`README.md`](../README.md) - Added Azure SQL local dev section

### 3. **Enhanced Server**
`backend/src/server.js` now shows:
- Database type (MSSQL vs SQLite)
- Database name
- Environment
- Warning if using SQLite

---

## 🚀 How to Use (Starting Now)

### First Time Setup (5 minutes)

```bash
# 1. Run setup script
bash scripts/setup-local-azure-sql.sh

# Follow prompts:
# - Choose option 1 (create dev database)
# - Enter SQL admin password when asked
# - Script tests connection automatically

# 2. Start development server
bash scripts/run-local.sh

# 3. Check console output
# Should see: "💾 Database: MSSQL (babefightdb-dev)"
```

### Daily Development

```bash
# Just run the server
bash scripts/run-local.sh

# Develop features, test against Azure SQL
# Deploy with confidence!
bash scripts/update-app.sh
```

---

## 🎯 Why This Solves Your Problem

### Before (SQLite Local → Azure SQL Production)
```
Develop → Test SQLite ✅ → Deploy → ❌ CONSTRAINT ERROR → Rollback → Fix → Repeat
```

Issues caught **only** in production:
- Foreign key CASCADE circular paths
- Data type mismatches
- SQL Server-specific constraints

### After (Azure SQL Local → Azure SQL Production)
```
Develop → Test Azure SQL → Fix issues locally → Deploy → ✅ SUCCESS
```

Issues caught **during development**:
- Same database engine
- Same constraints
- Same behavior
- No surprises!

---

## 📊 Current Deployment Issue

**Status**: Still failing with FK constraint error

**Root Cause**: Even without foreign keys on `game_handicap_h2h`, the drop table logic is being triggered and recreating with FKs somewhere.

**Next Steps to Fix Current Deployment**:

1. Check if the drop table is working:
```bash
# Connect to Azure SQL and check tables
az sql db query \
  --server babefight-sql-1766424549 \
  --database babefightdb-dev \
  --admin-user sqladmin \
  --admin-password "PASSWORD" \
  --query "SELECT name FROM sys.tables ORDER BY name"
```

2. Or manually recreate database:
```bash
bash scripts/recreate-azure-database.sh
# Then deploy again
bash scripts/update-app.sh
```

3. **Most Important**: Test H2H handicap feature locally with Azure SQL first!

---

## 📚 File Reference

### New Files
- `scripts/setup-local-azure-sql.sh` - Automated setup
- `docs/setup/LOCAL_AZURE_SQL_SETUP.md` - Detailed guide
- `docs/DEVELOPMENT_WORKFLOW.md` - Quick reference
- `backend/fix-cascade-constraints.sql` - Manual SQL fix (if needed)
- `scripts/recreate-azure-database.sh` - Database recreation script

### Modified Files
- `README.md` - Added Azure SQL local dev section
- `backend/src/server.js` - Enhanced startup logging
- `backend/src/db/database-mssql.js` - Removed FK constraints from game_handicap_h2h

---

## 🔧 Troubleshooting

### Connection Failed
```bash
# Your IP changed - update firewall
bash scripts/setup-local-azure-sql.sh
```

### Want to Start Fresh
```bash
# Delete dev database and recreate
az sql db delete \
  --resource-group babe-fight-rg \
  --server babefight-sql-1766424549 \
  --name babefightdb-dev \
  --yes

# Run setup again
bash scripts/setup-local-azure-sql.sh
```

### Switch Back to SQLite Temporarily
Edit `backend/.env`:
```env
DB_TYPE=sqlite
# (comment out other DB_* variables)
```

Restart server. Remember to test with Azure SQL before deploying!

---

## ✨ Benefits Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Local DB** | SQLite | Azure SQL (MSSQL) |
| **Testing** | Different engine | Same as production |
| **FK Constraints** | Not enforced same way | Identical to production |
| **Deployment Confidence** | 😰 Fingers crossed | 😎 Already tested |
| **Debug Time** | Hours fixing production | Minutes fixing locally |
| **Team Efficiency** | Rollbacks, hotfixes | Smooth deployments |

---

## 🎓 Learning

**Key Lesson**: Always develop with the same database engine as production!

**SQL Server Specific Issues**:
- Circular CASCADE paths not allowed
- Stricter foreign key validation
- IDENTITY vs AUTOINCREMENT
- VARCHAR vs NVARCHAR defaults
- Transaction isolation levels

**These are caught immediately with local Azure SQL! 🎉**

---

## Next Feature Development Checklist

- [ ] Run `bash scripts/setup-local-azure-sql.sh` (one-time)
- [ ] Start server, verify "💾 Database: MSSQL" in console
- [ ] Develop feature
- [ ] Test all database operations
- [ ] If schema changes, restart server and check for errors
- [ ] Deploy with confidence: `bash scripts/update-app.sh`
- [ ] Celebrate successful deployment! 🎉

---

**From now on**: No more production deployment surprises with database constraints! ✨
