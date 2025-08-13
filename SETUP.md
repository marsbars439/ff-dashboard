# Setup Instructions for GitHub Deployment

Follow these steps to deploy your Fantasy Football League app to GitHub Pages:

## Step 1: Create a GitHub Repository

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it something like `fantasy-football-league`
3. Make it public (required for free GitHub Pages)
4. Don't initialize with README, .gitignore, or license (we'll add these)

## Step 2: Update package.json

1. Open `package.json`
2. Update the `homepage` field to match your GitHub username and repository:
   ```json
   "homepage": "https://YOURUSERNAME.github.io/YOURREPOSITORYNAME"
   ```
   For example:
   ```json
   "homepage": "https://johnsmith.github.io/fantasy-football-league"
   ```

## Step 3: Set Up Local Project

1. Create a new folder for your project:
   ```bash
   mkdir fantasy-football-league
   cd fantasy-football-league
   ```

2. Initialize git:
   ```bash
   git init
   ```

3. Create all the files I provided in the correct folder structure:
   ```
   fantasy-football-league/
   ├── .github/
   │   └── workflows/
   │       └── deploy.yml
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
   ├── package.json
   ├── README.md
   └── SETUP.md
   ```

4. Install dependencies:
   ```bash
   npm install
   ```

5. Test locally:
   ```bash
   npm start
   ```

## Step 4: Deploy to GitHub

1. Add your remote repository:
   ```bash
   git remote add origin https://github.com/YOURUSERNAME/YOURREPOSITORYNAME.git
   ```

2. Add and commit all files:
   ```bash
   git add .
   git commit -m "Initial commit - Fantasy Football League app"
   ```

3. Push to GitHub:
   ```bash
   git branch -M main
   git push -u origin main
   ```

## Step 5: Enable GitHub Pages

1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Scroll down to **Pages** section in the left sidebar
4. Under **Source**, select **GitHub Actions**
5. The GitHub Actions workflow will automatically run and deploy your site

## Step 6: Access Your Site

After the GitHub Actions workflow completes (check the Actions tab), your site will be available at:
```
https://YOURUSERNAME.github.io/YOURREPOSITORYNAME
```

## Alternative: Manual Deployment

If you prefer manual deployment using gh-pages:

1. Make sure gh-pages is installed:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Deploy manually:
   ```bash
   npm run deploy
   ```

## Updating Your Site

To update your site:

1. Make changes to your code
2. Commit and push to the main branch:
   ```bash
   git add .
   git commit -m "Update league data"
   git push
   ```

3. GitHub Actions will automatically rebuild and deploy your site

## Troubleshooting

### Common Issues:

1. **404 Error**: Make sure the `homepage` field in package.json matches your GitHub Pages URL exactly

2. **Build Fails**: Check the Actions tab in your GitHub repo for error details

3. **White Screen**: Usually a routing issue. Make sure all paths are relative and the homepage field is correct

4. **Icons Not Loading**: Lucide React icons should work with the CDN setup, but if there are issues, check the browser console

### Getting Help:

- Check the **Actions** tab in your GitHub repository for build logs
- Open browser developer tools to see any JavaScript errors
- Ensure all file paths match the structure shown above

## Customizing Your Data

To update your league data:

1. Edit `src/components/FantasyFootballApp.js`
2. Update the `managersData` and `allTeamSeasons` arrays with your league's information
3. Commit and push your changes

The data structure is well-documented in the component file, making it easy to add new seasons or managers.