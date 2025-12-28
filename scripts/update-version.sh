#!/bin/bash

# Get git commit hash
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "Missing")

# Get current timestamp
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Read current version from version.config.json
VERSION=$(grep -o '"version": "[^"]*"' version.config.json | cut -d'"' -f4)

# Update version.config.json
cat > version.config.json << EOF
{
  "version": "${VERSION}",
  "gitCommit": "${GIT_COMMIT}",
  "buildTime": "${BUILD_TIME}",
  "environment": "production"
}
EOF

echo "✅ Version config updated:"
echo "   Version: ${VERSION}"
echo "   Git Commit: ${GIT_COMMIT}"
echo "   Build Time: ${BUILD_TIME}"
