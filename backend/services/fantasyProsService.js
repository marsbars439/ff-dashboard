const axios = require('axios');
const { parse } = require('csv-parse/sync');

const POS_URLS = {
  QB: 'https://www.fantasypros.com/nfl/rankings/ros-qb.php',
  RB: 'https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-rb.php',
  WR: 'https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-wr.php',
  TE: 'https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-te.php',
  DST: 'https://www.fantasypros.com/nfl/rankings/ros-dst.php'
};

async function fetchCsvRankings(pos) {
  const baseUrl = POS_URLS[pos];
  if (!baseUrl) throw new Error(`Unknown position: ${pos}`);
  const url = `${baseUrl}?export=csv`;
  const csv = await fetchWithRetry(url, pos);
  const records = parse(csv, { columns: true, skip_empty_lines: true });
  return records.map(r => {
    const playerName = r.Player || r.player || r.PLAYER || '';
    const team = r.Team || r.team || r.TEAM || '';
    const position = r.Pos || r.POSITION || r.position || pos;
    const proj = parseFloat(r['Proj Pts'] || r.proj_pts || r['FPTS'] || '0') || 0;
    const sosSeason = parseInt(r['SOS Season'] || r.sos_season || r['SOS SEASON'] || '0', 10) || 0;
    const sosPlayoffs = parseInt(r['SOS Playoffs'] || r.sos_playoffs || r['SOS PLAYOFFS'] || '0', 10) || 0;
    return {
      player_name: playerName,
      team,
      position,
      proj_pts: proj,
      sos_season: sosSeason,
      sos_playoffs: sosPlayoffs,
    };
  });
}

const REQUEST_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Referer': 'https://www.fantasypros.com/nfl/',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
};

async function fetchWithRetry(url, pos, retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data } = await axios.get(url, { headers: REQUEST_HEADERS });
      return data;
    } catch (err) {
      console.warn(`Attempt ${attempt} failed for ${pos} rankings: ${err.message}`);
      if (attempt < retries) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw new Error(`Failed to fetch ${pos} rankings after ${retries} attempts`);
      }
    }
  }
}

async function scrapeRosRankings() {
  const allPlayers = [];
  const failed = [];
  for (const pos of Object.keys(POS_URLS)) {
    try {
      const players = await fetchCsvRankings(pos);
      if (!players.length) {
        throw new Error(`No rankings found for ${pos}`);
      }
      allPlayers.push(...players);
    } catch (err) {
      console.error(err.message);
      failed.push(pos);
    }
  }
  return { players: allPlayers, failed };
}

module.exports = { scrapeRosRankings, fetchCsvRankings };
