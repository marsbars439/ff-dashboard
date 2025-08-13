# Docker Deployment Setup

This guide will help you deploy the Fantasy Football League app using Docker and Docker Compose.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) installed on your system
- [Docker Compose](https://docs.docker.com/compose/install/) installed
- Basic familiarity with command line

## Quick Start

### Production Deployment

1. **Clone or download all the project files to a directory**

2. **Build and start the application**:
   ```bash
   docker-compose up -d --build
   ```

3. **Access your application**:
   - Open your browser and go to `http://localhost:3000`

That's it! Your Fantasy Football League app is now running in production mode.

## Available Commands

### Using Docker Compose Directly

```bash
# Build the image
docker-compose build

# Start the application (detached mode)
docker-compose up -d

# Start with build
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Restart the application
docker-compose restart
```

### Using Make Commands (if you have Make installed)

```bash
# View all available commands
make help

# Start production application
make up

# Build and start
make prod-up

# View logs
make logs

# Stop application
make down

# Start development environment
make dev

# Clean up everything
make clean
```

## Development Mode

For development with hot reloading:

```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up --build

# Or using make
make dev
```

This will:
- Start the app on `http://localhost:3000`
- Enable hot reloading when you make code changes
- Mount your local files so changes are reflected immediately

## Production vs Development

### Production Mode (`docker-compose.yml`)
- **Multi-stage build** for optimal image size
- **Nginx** serves the built React app
- **Optimized** for performance and security
- **Port**: 3000 (mapped to container port 80)

### Development Mode (`docker-compose.dev.yml`)
- **Hot reloading** enabled
- **Volume mounting** for live code changes
- **Development server** with debugging
- **Port**: 3000

## Configuration

### Changing the Port

Edit `docker-compose.yml` to change the exposed port:
```yaml
ports:
  - "8080:80"  # Changes app to run on port 8080
```

### Environment Variables

Add environment variables in `docker-compose.yml`:
```yaml
environment:
  - NODE_ENV=production
  - REACT_APP_API_URL=https://your-api.com
```

### SSL/HTTPS Setup

For production with SSL, uncomment the nginx-proxy service in `docker-compose.yml` and:

1. Add your SSL certificates to a `./ssl` directory
2. Configure the proxy settings
3. Update the nginx-proxy configuration

## Deployment Options

### Local Deployment
```bash
docker-compose up -d --build
```

### VPS/Cloud Server
1. Copy all files to your server
2. Install Docker and Docker Compose
3. Run: `docker-compose up -d --build`
4. Configure your domain/firewall as needed

### Using Docker Hub
1. Build and push to Docker Hub:
   ```bash
   docker build -t yourusername/fantasy-football-league .
   docker push yourusername/fantasy-football-league
   ```

2. Update `docker-compose.yml`:
   ```yaml
   services:
     fantasy-football-app:
       image: yourusername/fantasy-football-league
       # Remove the build: . line
   ```

## Updating Your Application

### Method 1: Rebuild from Source
```bash
# Stop the current container
docker-compose down

# Rebuild and start
docker-compose up -d --build
```

### Method 2: Update Code and Restart
If you only changed the source code:
```bash
# Update your code files
# Then rebuild
docker-compose build
docker-compose up -d
```

## Troubleshooting

### Common Issues

1. **Port Already in Use**:
   ```bash
   # Check what's using port 3000
   lsof -i :3000
   # Or change the port in docker-compose.yml
   ```

2. **Permission Denied**:
   ```bash
   # Run with sudo (Linux/Mac)
   sudo docker-compose up -d --build
   ```

3. **Container Won't Start**:
   ```bash
   # Check logs
   docker-compose logs
   ```

4. **Hot Reloading Not Working in Dev Mode**:
   - Make sure you're using `docker-compose.dev.yml`
   - Check that volumes are properly mounted

### Useful Commands

```bash
# View running containers
docker ps

# Access container shell
docker exec -it fantasy-football-league sh

# View detailed logs
docker-compose logs fantasy-football-app

# Check resource usage
docker stats

# Remove all unused Docker resources
docker system prune -f
```

## File Structure

```
fantasy-football-league/
├── Dockerfile              # Production build
├── Dockerfile.dev          # Development build
├── docker-compose.yml      # Production compose
├── docker-compose.dev.yml  # Development compose
├── nginx.conf              # Nginx configuration
├── .dockerignore           # Docker ignore rules
├── Makefile                # Convenience commands
└── DOCKER-SETUP.md         # This file
```

## Security Considerations

For production deployments:

1. **Use a reverse proxy** (nginx, Traefik) for SSL termination
2. **Set up proper firewall rules**
3. **Use environment variables** for sensitive data
4. **Regularly update** base images
5. **Use non-root user** in containers (already configured)

## Performance Optimization

The current setup includes:
- **Multi-stage builds** for smaller images
- **Gzip compression** via nginx
- **Static asset caching**
- **Security headers**

For high-traffic scenarios, consider:
- **Load balancing** with multiple container instances
- **CDN** for static assets
- **Database** for dynamic data instead of hardcoded arrays

## Support

If you encounter issues:
1. Check the logs: `docker-compose logs`
2. Ensure Docker and Docker Compose are up to date
3. Verify all files are in the correct locations
4. Check for port conflicts