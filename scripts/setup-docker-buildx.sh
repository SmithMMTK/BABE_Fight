#!/bin/bash

echo "=== Setting up Docker Buildx for Multi-Platform Builds ==="
echo ""

# Check if buildx is available
if ! docker buildx version &> /dev/null; then
    echo "Error: Docker Buildx is not available"
    echo "Please update Docker Desktop to the latest version"
    exit 1
fi

# Create a new builder instance
echo "Creating buildx builder instance..."
docker buildx create --name multiplatform --use --bootstrap

# Verify builder
echo ""
echo "✅ Buildx builder created successfully"
echo ""
docker buildx ls
echo ""
echo "You can now build images for AMD64 (Azure) from your ARM Mac"
echo ""
echo "To build: docker buildx build --platform linux/amd64 -t myimage:latest --load ."
echo ""
