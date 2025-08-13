# Setup Instructions for GitHub Deployment

Follow these steps to deploy your FF Dashboard app to GitHub Pages:

## Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it `ff-dashboard`
3. Make it public (required for free GitHub Pages)
4. Don't initialize with README, .gitignore, or license (we'll add these)

## Step 2: Set Up Local Project

1. Create a new folder for your project:
   ```bash
   mkdir ff-dashboard
   cd ff-dashboard
   ```

2. Initialize git:
   ```bash
   git init
   ```

3. Create all the files I provided in the correct folder structure:
   ```
   ff-dashboard/
   ├── .github/
   │   └── workflows/
   │       ├── deploy.yml
   │       └── docker-build.yml
   ├── public/
   │   ├── index.html
   │   └── manifest.json
   ├── src/
   │   ├── components/
   │   │   └── FantasyFootballApp.js
   │   ├── App.js
   │   ├── App.css
   │   ├── index.js
   │   └── index.css
   ├── .gitignore
   ├── .dockerignore
   ├── package.json
   ├── Dockerfile
   ├── Dockerfile.dev
   ├── docker-compose.yml
   ├── docker-compose.dev.yml
   ├── docker-compose.prod.yml
   ├── nginx.conf
   ├── deploy.sh
   ├── Makefile
   ├── README.md
   ├── SETUP.md
   ├── DOCKER-SETUP.md
   └── GITHUB-DOCKER-SETUP.md
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Test locally:
   ```bash
   npm start
   ```

## Step 3: Deploy to GitHub

1. Add your remote repository:
   ```bash
   git remote add origin https://github.com/marsbars439/ff-dashboard.git
   ```

2. Add and commit all files:
   ```bash
   git add .
   git commit -m "Initial commit - FF Dashboard"
   ```

3. Push to GitHub:
   ```bash
   git branch -M main
   git push -u origin main
   ```

## Step 4: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select **GitHub Actions**
5. The GitHub Actions workflow will automatically run and deploy your site

## Step 5: Enable Docker Image Publishing

1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Go to **Actions** → **General**
4. Under "Workflow permissions", select **Read and write permissions**
5. Check **Allow GitHub Actions to create and approve pull requests**

## Step 6: Access Your Sites

After the GitHub Actions workflows complete:

### GitHub Pages Site
```
https://marsbars439.github.io/ff-dashboard
```

### Docker Images
```
ghcr.io/marsbars439/ff-dashboard:latest
ghcr.io/marsbars439/ff-dashboard:dev
```

## Deployment Options

### Option 1: GitHub Pages (Free hosting)
- Automatically deploys on push to main
- Available at: https://marsbars439.github.io/ff-dashboard

### Option 2: Docker (Self-hosted)
```bash
# Quick deployment
docker run -d -p 3000:80 ghcr.io/marsbars439/ff-dashboard:latest

# Using docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Using deployment script
chmod +x deploy.sh && ./deploy.sh
```

## Updating Your Site

To update your site:

1. Make changes to your code
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Update league data"
   git push
   ```

3. GitHub Actions will automatically:
   - Build and deploy to GitHub Pages
   - Build and publish new Docker images

4. For Docker deployments, update with:
   ```bash
   # Pull latest image and restart
   ./deploy.sh
   ```

## Troubleshooting

### Common Issues:

1. **GitHub Pages 404 Error**: Wait a few minutes after first deployment
2. **Docker Build Fails**: Check the Actions tab for error details
3. **Permission Errors**: Ensure workflow permissions are set correctly

### Getting Help:

- Check the **Actions** tab in your GitHub repository for build logs
- All file contents are provided in the artifacts above
- Docker images are built automatically for multi-platform support

## Customizing Your Data

To update your league data:

1. Edit `src/components/FantasyFootballApp.js`
2. Update the `managersData` and `allTeamSeasons` arrays with your league's information
3. Commit and push your changes
4. Both GitHub Pages and Docker images will update automatically

The data structure is well-documented in the component file, making it easy to add new seasons or managers.