const axios = require('axios');

const POS_URLS = {
  QB: 'https://www.fantasypros.com/nfl/rankings/ros-qb.php',
  RB: 'https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-rb.php',
  WR: 'https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-wr.php',
  TE: 'https://www.fantasypros.com/nfl/rankings/ros-half-point-ppr-te.php',
  DST: 'https://www.fantasypros.com/nfl/rankings/ros-dst.php'
};

function parseRankings(html, defaultPos) {
  const headerMatch = html.match(/<thead[^>]*>([\s\S]*?)<\/thead>/i);
  let idxPlayer = 0, idxProj = -1, idxSosSeason = -1, idxSosPlayoffs = -1;
  if (headerMatch) {
    const headers = [...headerMatch[1].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)]
      .map(h => h[1].replace(/<[^>]+>/g, '').trim().toLowerCase());
    idxPlayer = headers.indexOf('player') !== -1 ? headers.indexOf('player') : 0;
    idxProj = headers.findIndex(h => h.includes('proj'));
    idxSosSeason = headers.indexOf('sos season');
    idxSosPlayoffs = headers.indexOf('sos playoffs');
  }
  const bodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  if (!bodyMatch) return [];
  const rows = [...bodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
  return rows.map(r => {
    const cells = [...r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
      .map(c => c[1].replace(/<[^>]+>/g, '').trim());
    const playerCell = cells[idxPlayer] || '';
    const nameMatch = playerCell.match(/^(.*?)\s+\(([^-]+)\s*-\s*([^\)]+)\)/);
    let name = playerCell;
    let team = '';
    let position = defaultPos;
    if (nameMatch) {
      name = nameMatch[1].trim();
      team = nameMatch[2].trim();
      position = nameMatch[3].trim();
    }
    const projPts = parseFloat(cells[idxProj] || '0') || 0;
    const sosSeason = parseInt(cells[idxSosSeason] || '0') || 0;
    const sosPlayoffs = parseInt(cells[idxSosPlayoffs] || '0') || 0;
    return {
      player_name: name,
      team,
      position,
      proj_pts: projPts,
      sos_season: sosSeason,
      sos_playoffs: sosPlayoffs
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
  for (const [pos, url] of Object.entries(POS_URLS)) {
    try {
      const html = await fetchWithRetry(url, pos);
      const players = parseRankings(html, pos);
      if (!players.length) {
        throw new Error(`No rankings found for ${pos}`);
      }
      allPlayers.push(...players);
    } catch (err) {
      console.error(err.message);
      failed.push(pos);
    }
  }
  if (failed.length) {
    throw new Error(`Unable to fetch rankings for: ${failed.join(', ')}`);
  }
  return allPlayers;
}

module.exports = { scrapeRosRankings };
