# Fantasy Football League - Docker Commands

.PHONY: help build up down logs restart clean dev dev-down prod-build prod-up deploy-prod pull-latest

# Configuration
REGISTRY = ghcr.io
USERNAME = marsbars439
REPO_NAME = ff-dashboard
IMAGE_TAG = latest

# Default target
help:
	@echo "Available commands:"
	@echo "  make build       - Build the production Docker image locally"
	@echo "  make up          - Start the application (local build)"
	@echo "  make down        - Stop the application"
	@echo "  make logs        - View application logs"
	@echo "  make restart     - Restart the application"
	@echo "  make clean       - Remove containers and images"
	@echo "  make dev         - Start development environment"
	@echo "  make dev-down    - Stop development environment"
	@echo "  make prod-build  - Build and start production locally"
	@echo "  make prod-up     - Start production (build if needed)"
	@echo "  make pull-latest - Pull latest image from GitHub registry"
	@echo "  make deploy-prod - Deploy using pre-built GitHub image"

# Local development and building
build:
	docker-compose build

up:
	docker-compose up -d

down:
	docker-compose down

logs:
	docker-compose logs -f

restart:
	docker-compose restart

# Development commands
dev:
	docker-compose -f docker-compose.dev.yml up --build

dev-down:
	docker-compose -f docker-compose.dev.yml down

# Local production commands
prod-build: build up

prod-up:
	docker-compose up -d --build

# GitHub registry commands
pull-latest:
	docker pull $(REGISTRY)/$(USERNAME)/$(REPO_NAME):$(IMAGE_TAG)

deploy-prod:
	docker-compose -f docker-compose.prod.yml pull
	docker-compose -f docker-compose.prod.yml up -d

# Cleanup commands
clean:
	docker-compose down --volumes --remove-orphans
	docker-compose -f docker-compose.dev.yml down --volumes --remove-orphans
	docker-compose -f docker-compose.prod.yml down --volumes --remove-orphans
	docker system prune -f
	docker image prune -f

# Force rebuild everything
rebuild: clean prod-build

# Update deployment script username
update-username:
	@read -p "Enter your GitHub username: " username; \
	sed -i 's/YOURUSERNAME/'$username'/g' Makefile docker-compose.prod.yml deploy.sh