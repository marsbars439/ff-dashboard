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

- **Real-time Updates**: WebSocket integration for live data updates
  - Active week matchup changes broadcast to all connected clients
  - Rule voting updates in real-time
  - Keeper selection changes synchronized across sessions
  - Automatic React Query cache invalidation on updates

- **Security Features**:
  - Helmet security headers (CSP, XSS protection, frame options)
  - Express rate limiting on authentication endpoints
  - CORS configuration with environment-based origin control
  - Secure session management with short-lived tokens

- **LLM Summaries**: Generate AI-based summaries via `POST /api/summarize` (requires `OPENAI_API_KEY` in `backend/.env`)
- **Rate Limiting**: Summary endpoint allows 20 requests per minute by default and can be tuned with `SUMMARY_RATE_LIMIT_MAX` and `SUMMARY_RATE_LIMIT_WINDOW_MS` variables

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

### Admin & Analytics Access

- The admin and analytics dashboards now require backend authentication.
- Set an `ADMIN_PASSWORD` environment variable for the backend (or continue
  using `REACT_APP_ANALYTICS_PASSWORD` for backwards compatibility).
- Both `docker-compose` configurations forward `ADMIN_PASSWORD` to the
  `ff-dashboard-api` container so the `/api/admin-auth` endpoint can validate
  sign-in attempts.
- The frontend exchanges the password for a short-lived token by posting to
  `/api/admin-auth`. Tokens are stored in `localStorage` and automatically
  revalidated until they expire.
- When using `deploy.sh`, pass the password as the fifth argument to export it
  into the container (e.g. `./deploy.sh marsbars439 latest 3000 20 mySecretPw`).

### Cloudflare Access Manager Authentication

- The backend exposes `GET /api/manager-auth/cloudflare`, which trusts the
  `Cf-Access-Authenticated-User-Email` header (and optional
  `Cf-Access-Jwt-Assertion`) injected by Cloudflare Access.
- Configure your Access application to forward both headers to the origin. The
  backend uses the email to look up the manager record and issue the same token
  payload returned by the passcode flow.
- Optional JWT validation is enabled when the following environment variables
  are provided:
  - `CF_ACCESS_VALIDATE_JWT=true` to enforce signature, issuer, and audience checks
  - `CF_ACCESS_TEAM_DOMAIN` (e.g. `example.cloudflareaccess.com`)
  - `CF_ACCESS_JWT_AUD` – the application Audience Tag from Cloudflare Access
  - `CF_ACCESS_JWKS_CACHE_MS` (default 1 hour) and
    `CF_ACCESS_JWKS_TIMEOUT_MS` (default 5 seconds) tune JWKS caching/fetching
- Rate limiting for this endpoint can be customized with
  `CF_MANAGER_AUTH_RATE_LIMIT_WINDOW_MS` (default 60 seconds) and
  `CF_MANAGER_AUTH_RATE_LIMIT_MAX` (default 10 requests per window).
- Ensure each manager row in the database has a valid email address so the
  mapping succeeds; failed lookups are logged to help diagnose missing entries.

### Backend Python Dependencies
The backend's FantasyPros scraper requires Python packages. When running the project outside of Docker, install them with:

```
pip install --break-system-packages -r backend/requirements.txt
```

These dependencies are installed automatically in the backend Docker image.

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

### Frontend
- React 18
- TanStack React Query (data fetching and caching)
- Socket.IO Client (real-time WebSocket communication)
- Tailwind CSS (via CDN)
- Lucide React (for icons)

### Backend
- Express.js
- Socket.IO (WebSocket server)
- Better-SQLite3 (database)
- Helmet (security headers)
- Express Slow Down (rate limiting)
- Winston (logging)

### Deployment
- Docker & Docker Compose
- Nginx (reverse proxy)

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

### Live Game Status Integration

Player activity badges now support a dedicated NFL game-status provider to
ensure a starter's status (upcoming, live, finished) reflects the official
scoreboard. Configure the backend with the following optional environment
variables (see `backend/.env.example` for details):

- `GAME_STATUS_API_URL` – base URL for the scoreboard API
- `GAME_STATUS_API_PATH` – endpoint that returns weekly games (defaults to
  `/events` when using ESPN feeds)
- `GAME_STATUS_API_KEY` / `GAME_STATUS_API_HOST` – optional authentication
  headers
- `GAME_STATUS_CACHE_TTL_MS` and `GAME_STATUS_API_TIMEOUT_MS` – request tuning
- `GAME_STATUS_SEASON_TYPE`, `GAME_STATUS_LEAGUE`, `GAME_STATUS_SPORT` – query
  parameter overrides when the provider requires them
- When targeting ESPN, include a `dates` query string such as
  `20230907-20230913` (or a single day `YYYYMMDD`) so the API scopes the
  returned events to the desired week.

If these variables are not provided the dashboard falls back to Sleeper data,
but enabling the integration keeps player statuses aligned with the actual NFL
game clock.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).