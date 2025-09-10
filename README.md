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

- **LLM Summaries**: Generate AI-based summaries via `POST /api/summarize` (requires `OPENAI_API_KEY` in `backend/.env`)

## Quick Start

### Using Pre-built Docker Images (Recommended)

# Deploy production with nginx reverse proxy
docker-compose up -d

# Or using make
make deploy
```
Then visit: http://localhost:3000

### Local Development
# Development with hot reloading
docker-compose -f docker-compose.dev.yml up --build

# Or using make
make dev
```

### Management Commands
# Deploy latest version
make deploy

# View logs
make logs

# Stop application
make down

# Clean up everything
make clean
```

## Technologies

- React 18
- Tailwind CSS (via CDN)
- Lucide React (for icons)
- Docker (for deployment)

## Docker Images

The project automatically builds and publishes Docker images to GitHub Container Registry:

- **Production**: `ghcr.io/marsbars439/ff-dashboard:latest`
- **Tagged versions**: `ghcr.io/marsbars439/ff-dashboard:v1.0.0`

## Data Updates

To update league data, modify the `managersData` and `allTeamSeasons` arrays in `src/components/FantasyFootballApp.js`.

### Managing Sleeper IDs

Each manager can have different Sleeper accounts across seasons. Historical
IDs are stored in the `manager_sleeper_ids` table with the season they apply
to. New mappings can be added through the Admin UI or manually with SQL:

```sql
INSERT INTO manager_sleeper_ids (name_id, sleeper_user_id, season)
VALUES ('byronkou', '12345', 2023);
```

When a manager changes Sleeper accounts, insert a new row for the relevant
season rather than updating past records. Seed scripts in
`backend/scripts/seedDatabase.js` include examples of how to populate these
historical IDs.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).