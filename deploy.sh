#!/bin/bash

# Fantasy Football League Deployment Script
# This script deploys the latest Docker image from GitHub Container Registry

set -e

# Configuration
REGISTRY="ghcr.io"
USERNAME="${1:-marsbars439}"  # Replace with your GitHub username
REPO_NAME="ff-dashboard"
IMAGE_TAG="${2:-latest}"
CONTAINER_NAME="ff-dashboard"
PORT="${3:-3000}"

echo "🚀 Deploying FF Dashboard"
echo "   Registry: $REGISTRY"
echo "   Image: $USERNAME/$REPO_NAME:$IMAGE_TAG"
echo "   Port: $PORT"
echo ""

# Function to check if container exists
container_exists() {
    docker ps -a --format "table {{.Names}}" | grep -q "^$CONTAINER_NAME$"
}

# Function to check if container is running
container_running() {
    docker ps --format "table {{.Names}}" | grep -q "^$CONTAINER_NAME$"
}

# Stop and remove existing container if it exists
if container_exists; then
    echo "📦 Stopping existing container..."
    if container_running; then
        docker stop $CONTAINER_NAME
    fi
    echo "🗑️  Removing existing container..."
    docker rm $CONTAINER_NAME
fi

# Pull the latest image
echo "⬇️  Pulling latest image..."
docker pull $REGISTRY/$USERNAME/$REPO_NAME:$IMAGE_TAG

# Run the new container
echo "🎯 Starting new container..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart unless-stopped \
    -p $PORT:3000 \
    -e NODE_ENV=production \
    $REGISTRY/$USERNAME/$REPO_NAME:$IMAGE_TAG

# Check if container started successfully
sleep 5
if container_running; then
    echo "✅ Deployment successful!"
    echo "🌐 Application is running at: http://localhost:$PORT"
    echo ""
    echo "📊 Container status:"
    docker ps --filter "name=$CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
else
    echo "❌ Deployment failed! Check container logs:"
    docker logs $CONTAINER_NAME
    exit 1
fi

# Optional: Clean up old images
read -p "🧹 Do you want to clean up old Docker images? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🧹 Cleaning up old images..."
    docker image prune -f
    echo "✅ Cleanup complete!"
fi

echo ""
echo "🎉 FF Dashboard is now live!"
echo "   URL: http://localhost:$PORT"
echo "   Container: $CONTAINER_NAME"
echo "   Image: $REGISTRY/$USERNAME/$REPO_NAME:$IMAGE_TAG"