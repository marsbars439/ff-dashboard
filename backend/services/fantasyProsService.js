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

async function scrapeRosRankings() {
  const allPlayers = [];
  for (const [pos, url] of Object.entries(POS_URLS)) {
    try {
      const { data: html } = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const players = parseRankings(html, pos);
      allPlayers.push(...players);
    } catch (err) {
      console.error(`Failed to fetch ${pos} rankings:`, err.message);
    }
  }
  return allPlayers;
}

module.exports = { scrapeRosRankings };
