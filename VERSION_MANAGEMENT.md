# Version Management

## Version Config File
File: `version.config.json`

Stores:
- **version**: Application version (BETA 2.x)
- **gitCommit**: Git commit hash
- **buildTime**: Build timestamp
- **environment**: Deployment environment

## Scripts

### 1. `update-version.sh` - Update Git Commit Hash
Updates `version.config.json` with current git commit hash and build time.

**Usage:**
```bash
./scripts/update-version.sh
```

**Automatically runs** when you use `./scripts/quick-update.sh`

---

### 2. `bump-version.sh` - Increment Minor Version
Increments the minor version number when adding new features.

**Usage:**
```bash
./scripts/bump-version.sh
```

**Example:**
- BETA 2.0 → BETA 2.1
- BETA 2.1 → BETA 2.2
- BETA 2.2 → BETA 2.3

---

## Workflow

### When Adding a New Feature:
1. Develop the feature
2. Run `./scripts/bump-version.sh` to increment version
3. Commit with message: `git commit -m "Add feature: ... (bump to 2.x)"`
4. Deploy: `./scripts/quick-update.sh`

### Regular Updates (Bug Fixes, Minor Changes):
1. Make changes
2. Commit: `git commit -m "Fix: ..."`
3. Deploy: `./scripts/quick-update.sh` (auto-updates git commit hash)

---

## Version History
- **BETA 2.0** - Initial version with turbo modal, H2H improvements, 6-digit PIN
- **BETA 2.x** - Future features...
