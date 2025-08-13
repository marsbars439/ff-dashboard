# Fantasy Football League Web App

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

Visit the live application at: `https://yourusername.github.io/fantasy-football-league`

## Technologies Used

- React 18
- Tailwind CSS (via CDN)
- Lucide React (for icons)
- GitHub Pages (for hosting)

## Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/fantasy-football-league.git
   cd fantasy-football-league
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

## Deployment

This project is configured for automatic deployment to GitHub Pages using GitHub Actions.

### Manual Deployment

If you prefer to deploy manually:

1. Install gh-pages:
   ```bash
   npm install --save-dev gh-pages
   ```

2. Update the `homepage` field in `package.json` with your GitHub username and repository name.

3. Deploy:
   ```bash
   npm run deploy
   ```

### Automatic Deployment

The project includes a GitHub Actions workflow that automatically builds and deploys the app when you push to the main branch.

## Project Structure

```
fantasy-football-league/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   └── FantasyFootballApp.js
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── .github/
│   └── workflows/
│       └── deploy.yml
├── package.json
└── README.md
```

## Data Updates

To update league data, modify the `managersData` and `allTeamSeasons` arrays in `src/components/FantasyFootballApp.js`.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).