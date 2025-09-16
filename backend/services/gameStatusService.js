const axios = require('axios');

const TEAM_ALIASES = {
  JAC: 'JAX',
  JAX: 'JAX',
  ARZ: 'ARI',
  ARI: 'ARI',
  LA: 'LAR',
  LAR: 'LAR',
  STL: 'LAR',
  SD: 'LAC',
  SDC: 'LAC',
  LAC: 'LAC',
  OAK: 'LV',
  LVR: 'LV',
  LV: 'LV',
  TB: 'TB',
  TAM: 'TB',
  WAS: 'WAS',
  WSH: 'WAS',
  WFT: 'WAS',
  NO: 'NO',
  NOR: 'NO',
  NE: 'NE',
  NWE: 'NE',
  SF: 'SF',
  SFO: 'SF',
  KC: 'KC',
  KAN: 'KC',
  GB: 'GB',
  GNB: 'GB',
  BAL: 'BAL',
  HOU: 'HOU',
  NYJ: 'NYJ',
  NYG: 'NYG',
  DAL: 'DAL',
  MIA: 'MIA',
  MIN: 'MIN',
  PIT: 'PIT',
  ATL: 'ATL',
  BUF: 'BUF',
  CAR: 'CAR',
  CHI: 'CHI',
  CIN: 'CIN',
  CLE: 'CLE',
  DEN: 'DEN',
  DET: 'DET',
  GBY: 'GB',
  IND: 'IND',
  JET: 'NYJ',
  PHI: 'PHI',
  SEA: 'SEA',
  TEN: 'TEN',
  HAW: 'SEA',
  BALTI: 'BAL',
  HST: 'HOU'
};

const DEFAULT_CACHE_TTL_MS = 2 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_PATH = '/events';
const DEFAULT_SEASON_TYPE = 'regular';

class GameStatusService {
  constructor() {
    this.cache = new Map();
    this.client = null;
    this.cacheTtlMs = Number(process.env.GAME_STATUS_CACHE_TTL_MS) || DEFAULT_CACHE_TTL_MS;
    this.apiPath = process.env.GAME_STATUS_API_PATH || DEFAULT_PATH;
    this.seasonType = process.env.GAME_STATUS_SEASON_TYPE || DEFAULT_SEASON_TYPE;
  }

  isConfigured() {
    return Boolean(process.env.GAME_STATUS_API_URL);
  }

  getClient() {
    if (!this.isConfigured()) {
      return null;
    }

    if (!this.client) {
      const baseURL = process.env.GAME_STATUS_API_URL.replace(/\/$/, '');
      const timeout = Number(process.env.GAME_STATUS_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS;
      const headers = {};

      if (process.env.GAME_STATUS_API_KEY) {
        headers['x-api-key'] = process.env.GAME_STATUS_API_KEY;
      }

      if (process.env.GAME_STATUS_API_HOST) {
        headers['x-api-host'] = process.env.GAME_STATUS_API_HOST;
      }

      this.client = axios.create({
        baseURL,
        timeout,
        headers
      });
    }

    return this.client;
  }

  normalizeTimestamp(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return null;
      }
      return value < 1e12 ? value * 1000 : value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }

      const numeric = Number(trimmed);
      if (!Number.isNaN(numeric)) {
        return numeric < 1e12 ? numeric * 1000 : numeric;
      }

      const parsed = Date.parse(trimmed);
      return Number.isNaN(parsed) ? null : parsed;
    }

    return null;
  }

  normalizeTeam(team) {
    if (team === null || team === undefined) {
      return null;
    }

    const upper = team.toString().trim().toUpperCase();
    if (!upper) {
      return null;
    }

    return TEAM_ALIASES[upper] || upper;
  }

  normalizeStatus(status) {
    if (status === null || status === undefined) {
      return null;
    }

    if (typeof status === 'object') {
      const fields = [
        status.status,
        status.state,
        status.type,
        status.phase,
        status.description,
        status.detail,
        status.shortDetail,
        status.short_detail,
        status.display,
        status.displayStatus,
        status.display_status
      ];

      for (const field of fields) {
        const normalized = this.normalizeStatus(field);
        if (normalized) {
          return normalized;
        }
      }

      return null;
    }

    const text = status.toString().trim().toLowerCase();
    if (!text) {
      return null;
    }

    if (text.includes('bye')) {
      return 'bye';
    }

    if (
      text.includes('final') ||
      text.includes('complete') ||
      text.includes('ended') ||
      text.includes('post') ||
      text === 'finished' ||
      text === 'final'
    ) {
      return 'final';
    }

    if (
      text.includes('progress') ||
      text.includes('inprogress') ||
      text === 'in' ||
      text.includes('live') ||
      text.includes('playing') ||
      text.includes('half') ||
      text.includes('quarter') ||
      text.includes('ot') ||
      /\b(q[1-4]|1st|2nd|3rd|4th)\b/.test(text)
    ) {
      return 'in_progress';
    }

    if (text.includes('postpon')) {
      return 'postponed';
    }

    if (text.includes('cancel')) {
      return 'canceled';
    }

    if (text.includes('delay')) {
      return 'delayed';
    }

    if (
      text.includes('sched') ||
      text.includes('pre') ||
      text.includes('upcoming') ||
      text.includes('not started') ||
      text.includes('preview') ||
      text.includes('pending')
    ) {
      return 'pre';
    }

    return null;
  }

  normalizeQuarter(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    if (typeof value === 'number') {
      if (value >= 1 && value <= 4) {
        return `Q${value}`;
      }
      if (value === 5) {
        return 'OT';
      }
    }

    const text = value.toString().trim().toUpperCase();
    if (!text) {
      return null;
    }

    if (text === 'HALF' || text === 'HALFTIME') {
      return 'HALFTIME';
    }

    if (text.startsWith('Q') && text.length === 2) {
      return text;
    }

    if (text.includes('OT')) {
      return 'OT';
    }

    if (text.includes('1ST')) {
      return 'Q1';
    }
    if (text.includes('2ND')) {
      return 'Q2';
    }
    if (text.includes('3RD')) {
      return 'Q3';
    }
    if (text.includes('4TH')) {
      return 'Q4';
    }

    return text;
  }

  parseScore(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  extractClock(game) {
    const candidates = [
      game.clock,
      game.game_clock,
      game.display_clock,
      game.displayClock,
      game.status?.clock,
      game.status?.displayClock
    ];

    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const trimmed = candidate.trim();
        if (trimmed) {
          return trimmed.toUpperCase();
        }
      }
    }

    return null;
  }

  extractRawStatusText(game, competition = null) {
    const parts = [];
    const push = value => {
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          parts.push(trimmed);
        }
      }
    };

    push(game.status_text);
    push(game.statusText);
    push(game.status_detail);
    push(game.statusDetail);
    push(game.display_status);
    push(game.displayStatus);
    push(game.short_detail);
    push(game.shortDetail);
    push(game.detail);
    push(game.summary);
    push(game.game_status);
    push(game.gameStatus);
    push(game.state);
    push(game.phase);

    if (typeof game.status === 'string') {
      push(game.status);
    } else if (game.status && typeof game.status === 'object') {
      push(game.status.description);
      push(game.status.detail);
      push(game.status.shortDetail);
      push(game.status.display);
      push(game.status.displayStatus);
      push(game.status.display_status);
      push(game.status.state);
      push(game.status.type);
      push(game.status.phase);
    }

    if (competition && typeof competition === 'object') {
      push(competition.status_text);
      push(competition.statusText);

      if (competition.status && typeof competition.status === 'object') {
        push(competition.status.description);
        push(competition.status.detail);
        push(competition.status.shortDetail);
        push(competition.status.display);
        push(competition.status.displayStatus);
        push(competition.status.display_status);
        push(competition.status.state);
        push(competition.status.type);
        push(competition.status.phase);
      }
    }

    return parts.length ? parts.join(' ').trim() : null;
  }

  convertStatusToActivity(status) {
    switch (status) {
      case 'final':
        return 'finished';
      case 'in_progress':
        return 'live';
      case 'pre':
        return 'upcoming';
      case 'bye':
        return 'inactive';
      case 'postponed':
      case 'canceled':
      case 'delayed':
        return 'inactive';
      default:
        return null;
    }
  }

  buildGameMeta(game, homeTeam, awayTeam) {
    const competition = Array.isArray(game.competitions) ? game.competitions[0] : null;
    const statusCandidates = [
      this.normalizeStatus(game.status),
      this.normalizeStatus(game.status?.type),
      this.normalizeStatus(game.status?.state),
      this.normalizeStatus(game.status?.phase),
      this.normalizeStatus(game.status?.display_status),
      this.normalizeStatus(game.status?.displayStatus),
      this.normalizeStatus(game.status?.description),
      this.normalizeStatus(game.status?.detail),
      this.normalizeStatus(game.status?.shortDetail),
      this.normalizeStatus(game.status_text),
      this.normalizeStatus(game.statusText),
      this.normalizeStatus(game.status_detail),
      this.normalizeStatus(game.statusDetail),
      this.normalizeStatus(game.game_status),
      this.normalizeStatus(game.gameStatus),
      this.normalizeStatus(game.state),
      this.normalizeStatus(game.phase),
      this.normalizeStatus(competition?.status),
      this.normalizeStatus(competition?.status?.type),
      this.normalizeStatus(competition?.status?.state),
      this.normalizeStatus(competition?.status?.phase),
      this.normalizeStatus(competition?.status?.description),
      this.normalizeStatus(competition?.status?.detail),
      this.normalizeStatus(competition?.status?.shortDetail)
    ].filter(Boolean);

    const normalizedStatus = statusCandidates.length ? statusCandidates[0] : null;
    const rawStatusText = this.extractRawStatusText(game, competition);

    const startTime = this.normalizeTimestamp(
      game.start_time ||
        game.startTime ||
        game.kickoff ||
        game.scheduled ||
        game.commence_time ||
        (game.game_date && game.game_time ? `${game.game_date} ${game.game_time}` : null) ||
        game.date ||
        competition?.start_time ||
        competition?.startTime ||
        competition?.date
    );

    const updated = this.normalizeTimestamp(
      game.updated ||
        game.last_updated ||
        game.lastUpdate ||
        game.status?.updated ||
        game.status?.lastUpdated ||
        competition?.status?.updated ||
        competition?.status?.lastUpdated
    );

    const quarter = this.normalizeQuarter(
      game.quarter ||
        game.period ||
        game.current_period ||
        game.game_period ||
        game.status?.period ||
        game.status?.quarter ||
        competition?.status?.period ||
        competition?.status?.quarter ||
        competition?.period
    );

    const clock = this.extractClock(game) || (competition ? this.extractClock(competition) : null);

    let detail = null;
    if (quarter && clock) {
      detail = `${quarter} ${clock}`.trim();
    } else if (quarter) {
      detail = quarter;
    } else if (clock) {
      detail = clock;
    }

    if (!detail && rawStatusText) {
      detail = rawStatusText;
    }

    if (!detail && normalizedStatus === 'final') {
      detail = 'FINAL';
    }

    const meta = {
      status: normalizedStatus,
      activityKey: this.convertStatusToActivity(normalizedStatus),
      rawStatusText,
      detail,
      startTime,
      lastUpdated: updated,
      gameId: game.id || game.game_id || game.gameId || competition?.id || null,
      homeTeam: homeTeam || null,
      awayTeam: awayTeam || null,
      homeScore:
        this.parseScore(
          game.home_score ||
            game.homeScore ||
            game.home_points ||
            game.home_points_total ||
            game.score?.home ||
            game.home?.score ||
            game.scoring?.home
        ),
      awayScore:
        this.parseScore(
          game.away_score ||
            game.awayScore ||
            game.away_points ||
            game.away_points_total ||
            game.score?.away ||
            game.away?.score ||
            game.scoring?.away
        ),
      quarter,
      clock,
      isFinal: false,
      isInProgress: false,
      isPre: false,
      isDelayed: false
    };

    const normalizedStatusesForChecks = Array.from(
      new Set(
        [
          normalizedStatus,
          this.normalizeStatus(game.status?.type),
          this.normalizeStatus(game.status?.state),
          this.normalizeStatus(competition?.status),
          this.normalizeStatus(competition?.status?.type),
          this.normalizeStatus(competition?.status?.state)
        ].filter(Boolean)
      )
    );

    if (!meta.status && normalizedStatusesForChecks.length) {
      meta.status = normalizedStatusesForChecks[0];
      meta.activityKey = this.convertStatusToActivity(meta.status);
    }

    const statusStates = [
      game.status?.state,
      game.status?.type?.state,
      competition?.status?.state,
      competition?.status?.type?.state
    ]
      .map(value => (typeof value === 'string' ? value.toLowerCase() : null))
      .filter(Boolean);

    const statusCompletedFlags = [
      game.status?.completed,
      game.status?.type?.completed,
      competition?.status?.completed,
      competition?.status?.type?.completed
    ].filter(value => value === true);

    meta.isFinal =
      normalizedStatusesForChecks.includes('final') ||
      game.final === true ||
      game.completed === true ||
      game.status?.type === 'final' ||
      competition?.status?.type === 'final' ||
      statusStates.includes('post') ||
      statusStates.includes('postgame') ||
      statusCompletedFlags.includes(true);

    meta.isInProgress =
      normalizedStatusesForChecks.includes('in_progress') ||
      statusStates.includes('in') ||
      statusStates.includes('inprogress');

    meta.isPre =
      normalizedStatusesForChecks.includes('pre') ||
      statusStates.includes('pre');

    meta.isDelayed =
      normalizedStatusesForChecks.includes('delayed') ||
      normalizedStatusesForChecks.includes('postponed') ||
      normalizedStatusesForChecks.includes('canceled') ||
      statusStates.includes('delay');

    if (competition && Array.isArray(competition.competitors)) {
      const competitors = competition.competitors;

      const scoreFromCompetitor = comp => {
        const primary = this.parseScore(comp.score);
        if (primary !== null) {
          return primary;
        }

        if (Array.isArray(comp.linescores) && comp.linescores.length) {
          const last = comp.linescores[comp.linescores.length - 1];
          if (last && last.value !== undefined) {
            const parsed = this.parseScore(last.value);
            if (parsed !== null) {
              return parsed;
            }
          }
        }

        return null;
      };

      competitors.forEach(comp => {
        const role = typeof comp.homeAway === 'string' ? comp.homeAway.toLowerCase() : null;
        const teamAbbr = this.normalizeTeam(
          comp.team?.abbreviation ||
            comp.team?.shortDisplayName ||
            comp.team?.displayName ||
            comp.team?.name ||
            comp.team?.location
        );

        if (role === 'home') {
          if (!meta.homeTeam && teamAbbr) {
            meta.homeTeam = teamAbbr;
          }
          const score = scoreFromCompetitor(comp);
          if (score !== null) {
            meta.homeScore = score;
          }
        } else if (role === 'away') {
          if (!meta.awayTeam && teamAbbr) {
            meta.awayTeam = teamAbbr;
          }
          const score = scoreFromCompetitor(comp);
          if (score !== null) {
            meta.awayScore = score;
          }
        } else if (teamAbbr) {
          if (!meta.homeTeam) {
            meta.homeTeam = teamAbbr;
            const score = scoreFromCompetitor(comp);
            if (score !== null) {
              meta.homeScore = score;
            }
          } else if (!meta.awayTeam) {
            meta.awayTeam = teamAbbr;
            const score = scoreFromCompetitor(comp);
            if (score !== null) {
              meta.awayScore = score;
            }
          }
        }
      });
    }

    if (meta.isFinal && !meta.detail) {
      meta.detail = 'FINAL';
    }

    return meta;
  }

  extractGames(payload) {
    if (!payload) {
      return [];
    }

    if (Array.isArray(payload)) {
      return payload;
    }

    const arrayKeys = ['games', 'events', 'items', 'data'];
    for (const key of arrayKeys) {
      if (Array.isArray(payload[key])) {
        return payload[key];
      }
    }

    const nestedKeys = ['payload', 'body', 'result', 'response'];
    for (const key of nestedKeys) {
      if (payload[key]) {
        const nested = this.extractGames(payload[key]);
        if (nested.length) {
          return nested;
        }
      }
    }

    return [];
  }

  buildParams(season, week, overrides = {}) {
    const params = {};

    if (Number.isFinite(season)) {
      params.season = season;
    }

    if (Number.isFinite(week)) {
      params.week = week;
    }

    const league = process.env.GAME_STATUS_LEAGUE || 'nfl';
    if (league) {
      params.league = league;
    }

    const sport = process.env.GAME_STATUS_SPORT || 'nfl';
    if (sport) {
      params.sport = sport;
    }

    if (this.seasonType) {
      params.seasonType = this.seasonType;
    }

    if (overrides && typeof overrides === 'object') {
      Object.keys(overrides).forEach(key => {
        const value = overrides[key];
        if (value !== undefined && value !== null && value !== '') {
          params[key] = value;
        }
      });
    }

    return params;
  }

  async fetchWeekGames(season, week, overrides = {}) {
    const client = this.getClient();
    if (!client) {
      return [];
    }

    const response = await client.get(this.apiPath, {
      params: this.buildParams(season, week, overrides)
    });

    return this.extractGames(response.data);
  }

  async getWeekGameStatuses(season, week, options = {}) {
    const normalizedSeason = Number.parseInt(season, 10);
    const normalizedWeek = Number.parseInt(week, 10);
    const seasonKey = Number.isFinite(normalizedSeason) ? normalizedSeason : 'current';
    const weekKey = Number.isFinite(normalizedWeek) ? normalizedWeek : 'unknown';
    const sanitizedOptions = {};

    if (options && typeof options === 'object') {
      Object.keys(options).forEach(key => {
        const value = options[key];
        if (value !== undefined && value !== null && value !== '') {
          sanitizedOptions[key] = value;
        }
      });
    }

    const optionsKey = Object.keys(sanitizedOptions).length
      ? Object.keys(sanitizedOptions)
          .sort()
          .map(key => `${key}:${JSON.stringify(sanitizedOptions[key])}`)
          .join('|')
      : 'default';

    const cacheKey = `${seasonKey}-${weekKey}-${optionsKey}`;
    const now = Date.now();
    const cached = this.cache.get(cacheKey);

    if (cached && now - cached.timestamp < this.cacheTtlMs) {
      return cached.data;
    }

    if (!this.isConfigured()) {
      this.cache.set(cacheKey, { data: {}, timestamp: now });
      return {};
    }

    try {
      const games = await this.fetchWeekGames(normalizedSeason, normalizedWeek, sanitizedOptions);
      const map = {};

      games.forEach(game => {
        const competition = Array.isArray(game.competitions) ? game.competitions[0] : null;
        const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];

        let derivedHomeTeam = null;
        let derivedAwayTeam = null;
        let derivedHomeScore = null;
        let derivedAwayScore = null;

        competitors.forEach(comp => {
          const role = typeof comp.homeAway === 'string' ? comp.homeAway.toLowerCase() : null;
          const teamCandidate = this.normalizeTeam(
            comp.team?.abbreviation ||
              comp.team?.shortDisplayName ||
              comp.team?.displayName ||
              comp.team?.name ||
              comp.team?.location
          );

          const score = this.parseScore(
            comp.score ||
              (Array.isArray(comp.linescores) && comp.linescores.length
                ? comp.linescores[comp.linescores.length - 1]?.value
                : null)
          );

          if (role === 'home') {
            if (!derivedHomeTeam && teamCandidate) {
              derivedHomeTeam = teamCandidate;
            }
            if (score !== null) {
              derivedHomeScore = score;
            }
          } else if (role === 'away') {
            if (!derivedAwayTeam && teamCandidate) {
              derivedAwayTeam = teamCandidate;
            }
            if (score !== null) {
              derivedAwayScore = score;
            }
          } else if (teamCandidate) {
            if (!derivedHomeTeam) {
              derivedHomeTeam = teamCandidate;
              if (score !== null) {
                derivedHomeScore = score;
              }
            } else if (!derivedAwayTeam) {
              derivedAwayTeam = teamCandidate;
              if (score !== null) {
                derivedAwayScore = score;
              }
            }
          }
        });

        const fallbackHomeTeam = this.normalizeTeam(
          game.home_team ||
            game.homeTeam ||
            game.home ||
            game.team_home ||
            game.teams?.home ||
            game.home_abbr
        );
        const fallbackAwayTeam = this.normalizeTeam(
          game.away_team ||
            game.awayTeam ||
            game.away ||
            game.team_away ||
            game.teams?.away ||
            game.away_abbr
        );

        const homeTeam = derivedHomeTeam || fallbackHomeTeam;
        const awayTeam = derivedAwayTeam || fallbackAwayTeam;

        if (!homeTeam && !awayTeam) {
          return;
        }

        const meta = this.buildGameMeta(game, homeTeam, awayTeam);

        if (derivedHomeScore !== null) {
          meta.homeScore = derivedHomeScore;
        }

        if (derivedAwayScore !== null) {
          meta.awayScore = derivedAwayScore;
        }

        if (homeTeam) {
          map[homeTeam] = meta;
        }

        if (awayTeam) {
          map[awayTeam] = meta;
        }
      });

      this.cache.set(cacheKey, { data: map, timestamp: now });
      return map;
    } catch (error) {
      console.error('❌ Unable to fetch game status data:', error.message);
      this.cache.set(cacheKey, { data: {}, timestamp: now });
      return {};
    }
  }
}

module.exports = new GameStatusService();
module.exports.GameStatusService = GameStatusService;
