# Fantasy Football League - Docker Commands

.PHONY: help build up down logs restart clean dev dev-down prod-build prod-up

# Default target
help:
	@echo "Available commands:"
	@echo "  make build     - Build the production Docker image"
	@echo "  make up        - Start the production application"
	@echo "  make down      - Stop the production application"
	@echo "  make logs      - View application logs"
	@echo "  make restart   - Restart the production application"
	@echo "  make clean     - Remove containers and images"
	@echo "  make dev       - Start development environment"
	@echo "  make dev-down  - Stop development environment"
	@echo "  make prod-build- Build and start production"
	@echo "  make prod-up   - Start production (build if needed)"

# Production commands
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

# Combined production commands
prod-build: build up

prod-up:
	docker-compose up -d --build

# Cleanup commands
clean:
	docker-compose down --volumes --remove-orphans
	docker system prune -f
	docker image prune -f

# Force rebuild everything
rebuild: clean prod-build