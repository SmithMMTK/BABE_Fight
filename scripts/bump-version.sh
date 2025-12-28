#!/bin/bash

# Script to bump minor version (2.0 -> 2.1 -> 2.2)

# Read current version
CURRENT_VERSION=$(grep -o '"version": "[^"]*"' version.config.json | cut -d'"' -f4)

# Extract major and minor version
MAJOR=$(echo $CURRENT_VERSION | sed 's/BETA //' | cut -d'.' -f1)
MINOR=$(echo $CURRENT_VERSION | sed 's/BETA //' | cut -d'.' -f2)

# Increment minor version
NEW_MINOR=$((MINOR + 1))
NEW_VERSION="BETA ${MAJOR}.${NEW_MINOR}"

# Get git commit hash
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "Missing")

# Get current timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Update version.config.json
cat > version.config.json << EOF
{
  "version": "${NEW_VERSION}",
  "gitCommit": "${GIT_COMMIT}",
  "buildTime": "${BUILD_TIME}",
  "environment": "production"
}
EOF

echo "✅ Version bumped: ${CURRENT_VERSION} → ${NEW_VERSION}"
echo "   Git Commit: ${GIT_COMMIT}"
echo "   Build Time: ${BUILD_TIME}"
echo ""
echo "📝 Don't forget to commit this change!"
