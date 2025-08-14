# FF Dashboard - Docker Commands

.PHONY: help build up down logs restart clean dev dev-down deploy pull-latest

# Configuration
REGISTRY = ghcr.io
USERNAME = marsbars439
REPO_NAME = ff-dashboard
IMAGE_TAG = latest

# Default target
help:
	@echo "Available commands:"
	@echo "  make up          - Start production (with nginx)"
	@echo "  make down        - Stop the application"
	@echo "  make logs        - View application logs"
	@echo "  make restart     - Restart the application"
	@echo "  make deploy      - Deploy using pre-built GitHub images"
	@echo "  make dev         - Start development environment"
	@echo "  make dev-down    - Stop development environment"
	@echo "  make clean       - Remove containers and images"
	@echo "  make pull-latest - Pull latest images from GitHub registry"

# Production commands (main docker-compose.yml)
up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

restart:
	docker-compose restart

# Deployment (pull latest images and start)
deploy: pull-latest up
	@echo "✅ Deployment complete!"
	@echo "🌐 Application available at: http://localhost:3000"

# Development commands
dev:
	docker-compose -f docker-compose.dev.yml up --build

dev-down:
	docker-compose -f docker-compose.dev.yml down

# Pull latest images from GitHub Container Registry
pull-latest:
	docker-compose pull

# Cleanup commands
clean:
	docker-compose down --volumes --remove-orphans
	docker-compose -f docker-compose.dev.yml down --volumes --remove-orphans
	docker system prune -f
	docker image prune -f

# Status check
status:
	docker-compose ps

# View specific service logs
logs-api:
	docker-compose logs -f ff-dashboard-api

logs-web:
	docker-compose logs -f ff-dashboard-web

logs-nginx:
	docker-compose logs -f nginx