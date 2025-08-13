# FF Dashboard

A comprehensive web application for tracking fantasy football league records, statistics, and rules.

## Features

- **Hall of Records**: Complete franchise statistics and records
  - Medal count rankings (championships, runner-up, third place)
  - Chumpion count tracking
  - Win/loss records with percentages
  - Points scored rankings
  - Miscellaneous records and achievements
  - Individual manager lookup with detailed stats

- **League Rules**: Complete rulebook including:
  - Keeper rules and cost escalators
  - Draft rules and salary information
  - 2025 dues and payout structure
  - Trade rules and deadlines
  - Playoff format
  - Champion plaque engraving instructions

## Live Demo

Visit the live application at: `https://marsbars439.github.io/ff-dashboard`

## Technologies Used

- React 18
- Tailwind CSS (via CDN)
- Lucide React (for icons)
- GitHub Pages (for hosting)
- Docker (for containerized deployment)

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/marsbars439/ff-dashboard.git
   cd ff-dashboard
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Deployment Options

### GitHub Pages
This project is configured for automatic deployment to GitHub Pages using GitHub Actions.

### Docker Deployment

#### Using Pre-built Images
```bash
# Deploy using pre-built image from GitHub Container Registry
docker run -d -p 3000:80 ghcr.io/marsbars439/ff-dashboard:latest
```

#### Using Docker Compose
```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# Local development with hot reloading
make dev
```

#### Using Deployment Script
```bash
chmod +x deploy.sh
./deploy.sh
```

### Manual Deployment

If you prefer to deploy manually:

1. Install gh-pages:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Deploy:
   ```bash
   npm run deploy
   ```

## Project Structure

```
ff-dashboard/
├── .github/
│   └── workflows/
│       ├── deploy.yml          # GitHub Pages deployment
│       └── docker-build.yml    # Docker image building
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
├── docker-compose.yml          # Local Docker development
├── docker-compose.prod.yml     # Production Docker deployment
├── docker-compose.dev.yml      # Development with hot reload
├── Dockerfile                  # Production Docker build
├── Dockerfile.dev             # Development Docker build
├── deploy.sh                  # Production deployment script
├── Makefile                   # Convenience commands
├── package.json
└── README.md
```

## Data Updates

To update league data, modify the `managersData` and `allTeamSeasons` arrays in `src/components/FantasyFootballApp.js`.

## Docker Images

The project automatically builds and publishes Docker images to GitHub Container Registry:

- **Production**: `ghcr.io/marsbars439/ff-dashboard:latest`
- **Development**: `ghcr.io/marsbars439/ff-dashboard:dev`
- **Tagged versions**: `ghcr.io/marsbars439/ff-dashboard:v1.0.0`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).