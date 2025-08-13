# GitHub Docker Image Publishing Setup

This guide will help you set up automatic Docker image building and publishing using GitHub Actions and GitHub Container Registry (GHCR).

## Overview

Your setup will automatically:
- ✅ Build Docker images on every push to `main` branch
- ✅ Publish to GitHub Container Registry (GHCR)
- ✅ Support multi-architecture builds (AMD64 + ARM64)
- ✅ Create both production and development images
- ✅ Tag images with version numbers and `latest`
- ✅ Provide easy deployment scripts

## Prerequisites

- GitHub repository (public or private)
- Docker installed locally (for testing)
- Basic familiarity with GitHub Actions

## Setup Steps

### Step 1: Update Configuration Files

1. **Update `docker-compose.prod.yml`**:
   Replace `YOURUSERNAME` with your actual GitHub username:
   ```yaml
   image: ghcr.io/YOUR_ACTUAL_USERNAME/fantasy-football-league:latest
   ```

2. **Update `deploy.sh`**:
   Replace `YOURUSERNAME` with your GitHub username on line 8:
   ```bash
   USERNAME="${1:-YOUR_ACTUAL_USERNAME}"
   ```

3. **Update `Makefile`**:
   Replace `YOURUSERNAME` with your GitHub username on line 8:
   ```makefile
   USERNAME = YOUR_ACTUAL_USERNAME
   ```

   Or use the convenience command:
   ```bash
   make update-username
   ```

### Step 2: Enable GitHub Container Registry

1. Go to your GitHub repository
2. Navigate to **Settings** → **Actions** → **General**
3. Under "Workflow permissions", ensure:
   - ☑️ "Read and write permissions" is selected
   - ☑️ "Allow GitHub Actions to create and approve pull requests" is checked

### Step 3: Push Your Code

```bash
git add .
git commit -m "Add Docker build workflow"
git push origin main
```

### Step 4: Monitor the Build

1. Go to your repository on GitHub
2. Click the **Actions** tab
3. You should see "Build and Push Docker Images" workflow running
4. Click on it to see the build progress

## Available Images

After successful build, your images will be available at:

### Production Image
```
ghcr.io/yourusername/fantasy-football-league:latest
ghcr.io/yourusername/fantasy-football-league:main
```

### Development Image
```
ghcr.io/yourusername/fantasy-football-league:dev
```

### Tagged Versions (when you create releases)
```
ghcr.io/yourusername/fantasy-football-league:v1.0.0
ghcr.io/yourusername/fantasy-football-league:1.0
ghcr.io/yourusername/fantasy-football-league:1
```

## Deployment Options

### Option 1: Using Docker Compose (Recommended)

```bash
# Deploy using pre-built image
docker-compose -f docker-compose.prod.yml up -d

# Or using make
make deploy-prod
```

### Option 2: Using Deployment Script

```bash
# Make script executable
chmod +x deploy.sh

# Deploy latest version
./deploy.sh

# Deploy specific version
./deploy.sh yourusername v1.0.0

# Deploy to different port
./deploy.sh yourusername latest 8080
```

### Option 3: Manual Docker Run

```bash
# Pull and run latest image
docker pull ghcr.io/yourusername/fantasy-football-league:latest
docker run -d --name fantasy-football -p 3000:80 ghcr.io/yourusername/fantasy-football-league:latest
```

## Workflow Triggers

The Docker build workflow runs on:

- **Push to `main` branch** → Builds and pushes `latest` and `main` tags
- **Push to `develop` branch** → Builds and pushes `develop` tag
- **Git tags starting with `v`** → Builds version-specific tags (e.g., `v1.0.0`)
- **Pull requests** → Builds but doesn't push (for testing)

## Creating Releases

To create versioned releases:

```bash
# Create and push a tag
git tag v1.0.0
git push origin v1.0.0
```

This will trigger a build that creates:
- `ghcr.io/yourusername/fantasy-football-league:v1.0.0`
- `ghcr.io/yourusername/fantasy-football-league:1.0`
- `ghcr.io/yourusername/fantasy-football-league:1`

## Image Visibility

### Making Images Public (Recommended)

1. Go to your GitHub profile
2. Click **Packages** tab
3. Find your `fantasy-football-league` package
4. Click **Package settings**
5. Scroll to **Danger Zone**
6. Click **Change visibility** → **Public**

This allows anyone to pull your Docker images without authentication.

### Private Images

If you keep images private, users will need to authenticate:

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Then pull/run as normal
docker pull ghcr.io/yourusername/fantasy-football-league:latest
```

## Multi-Architecture Support

Your images are built for both:
- **AMD64** (Intel/AMD processors)
- **ARM64** (Apple Silicon, Raspberry Pi, ARM servers)

This means they'll work on:
- ✅ Regular PCs and servers
- ✅ Apple Silicon Macs (M1/M2)
- ✅ Raspberry Pi 4+
- ✅ ARM-based cloud instances

## Local Development Workflow

```bash
# Work on your code locally
make dev

# Test production build locally
make prod-up

# When ready, push to GitHub
git add .
git commit -m "Update league data"
git push origin main

# GitHub Actions automatically builds and publishes
# Deploy the new image
make deploy-prod
```

## Updating Your Application

### Method 1: Automatic (Recommended)
1. Push code changes to GitHub
2. Wait for GitHub Actions to build new image
3. Pull and restart: `make deploy-prod`

### Method 2: Manual
```bash
# Pull latest image
docker pull ghcr.io/yourusername/fantasy-football-league:latest

# Restart with new image
docker-compose -f docker-compose.prod.yml up -d
```

## Troubleshooting

### Build Failures

1. **Check the Actions tab** in your GitHub repository
2. **Look at the build logs** for specific errors
3. **Common issues**:
   - Missing dependencies in package.json
   - Syntax errors in Dockerfile
   - File path issues

### Permission Errors

If you get permission errors:
1. Check repository settings → Actions → General
2. Ensure "Read and write permissions" is enabled
3. Make sure the repository has proper access to packages

### Image Pull Errors

```bash
# Login to GitHub Container Registry
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Or make the package public (easier)
```

### Container Won't Start

```bash
# Check logs
docker logs fantasy-football-league

# Common issues:
# - Port already in use (change port in docker-compose.prod.yml)
# - Missing environment variables
# - File permission issues
```

## Advanced Configuration

### Custom Build Arguments

Edit `.github/workflows/docker-build.yml` to add build arguments:

```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: .
    build-args: |
      NODE_VERSION=18
      CUSTOM_ARG=value
    # ... other options
```

### Multiple Registries

You can also push to Docker Hub or other registries by adding more login and push steps to the workflow.

### Environment-Specific Images

Create different Dockerfiles for different environments:
- `Dockerfile.prod` - Production optimized
- `Dockerfile.staging` - Staging environment
- `Dockerfile.dev` - Development (already exists)

## Security Best Practices

1. **Use official base images** (already configured)
2. **Regular updates** - GitHub Dependabot will help
3. **Scan for vulnerabilities** - GitHub automatically scans your images
4. **Minimal permissions** - Workflow only has necessary permissions
5. **No secrets in images** - Use environment variables instead

## Cost Considerations

- ✅ **GitHub Actions**: 2,000 minutes/month free for public repos
- ✅ **GitHub Container Registry**: Free for public packages
- ✅ **Bandwidth**: Free for public packages
- ⚠️ **Private repos**: May have usage limits

## Support

If you encounter issues:

1. **Check GitHub Actions logs** first
2. **Verify all usernames** are updated correctly
3. **Test locally** before pushing to GitHub
4. **Check package visibility** settings
5. **Ensure proper permissions** are set

Your Fantasy Football League app will now have professional-grade Docker image building and deployment! 🎉