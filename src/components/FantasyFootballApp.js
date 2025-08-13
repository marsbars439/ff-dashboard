import React, { useState, useEffect } from 'react';
import { Trophy, Users, TrendingUp, DollarSign, Calendar, BookOpen, BarChart3, Award, Zap, Crown, Target, ChevronDown } from 'lucide-react';

const FantasyFootballApp = () => {
  const [activeTab, setActiveTab] = useState('records');
  const [selectedManager, setSelectedManager] = useState('');
  const [managers, setManagers] = useState([]);
  const [teamSeasons, setTeamSeasons] = useState([]);

  // Sample data based on your CSVs - expanded with more complete data
  const managersData = [
    { name_id: 'byronkou', full_name: 'Byron Kou', sleeper_username: 'bsbllplyr968', active: true },
    { name_id: 'carlosortiz', full_name: 'Carlos Ortiz', sleeper_username: 'jcmbortiz', active: true },
    { name_id: 'danguadronjasonvoss', full_name: 'Dan Guadron/Jason Voss', sleeper_username: 'jvoss7', active: true },
    { name_id: 'davepasi', full_name: 'Dave Pasi', sleeper_username: 'depiii26', active: true },
    { name_id: 'markreischel', full_name: 'Mark Reischel', sleeper_username: 'markr729', active: true },
    { name_id: 'marshallroshto', full_name: 'Marshall Roshto', sleeper_username: 'roshto', active: true },
    { name_id: 'robcolaneri', full_name: 'Rob Colaneri', sleeper_username: 'raabcalamari', active: true },
    { name_id: 'ruairilynch', full_name: 'Ruairi Lynch', sleeper_username: 'rlynch9', active: true },
    { name_id: 'stevescicchitano', full_name: 'Steve Scicchitano', sleeper_username: 'SteveScicc', active: true },
    { name_id: 'willhubbard', full_name: 'Will Hubbard', sleeper_username: 'whubbard9', active: true },
    { name_id: 'samcarlos', full_name: 'Sam Carlos', sleeper_username: 'samlols', active: false },
    { name_id: 'scottzagorski', full_name: 'Scott Zagorski', sleeper_username: '', active: false },
    { name_id: 'steveshiffer', full_name: 'Steve Shiffer', sleeper_username: 'shiffnasty', active: false }
  ];

  // Extended sample data with more complete information
  const allTeamSeasons = [
    { year: 2024, name_id: 'robcolaneri', team_name: 'Colaneri FC', wins: 10, losses: 4, points_for: 1796.44, points_against: 1496, regular_season_rank: 1, playoff_finish: 1, dues: 200, payout: 1540, high_game: 142.5 },
    { year: 2024, name_id: 'marshallroshto', team_name: '', wins: 8, losses: 6, points_for: 1764.38, points_against: 1582.18, regular_season_rank: 2, playoff_finish: 3, dues: 200, payout: 0, high_game: 158.2 },
    { year: 2024, name_id: 'davepasi', team_name: 'Laces Out', wins: 8, losses: 6, points_for: 1622.88, points_against: 1651.08, regular_season_rank: 3, playoff_finish: null, dues: 200, payout: 0, high_game: 145.8 },
    { year: 2024, name_id: 'markreischel', team_name: '', wins: 8, losses: 6, points_for: 1575.78, points_against: 1485.52, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: 139.7 },
    { year: 2024, name_id: 'willhubbard', team_name: 'HubbaD', wins: 8, losses: 6, points_for: 1457.38, points_against: 1429.18, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: 134.2 },
    { year: 2024, name_id: 'byronkou', team_name: 'Rice Rice Baby', wins: 7, losses: 7, points_for: 1567.54, points_against: 1563.52, regular_season_rank: 6, playoff_finish: 2, dues: 200, payout: 500, high_game: 148.9 },
    { year: 2024, name_id: 'ruairilynch', team_name: 'Hail Mary', wins: 7, losses: 7, points_for: 1535.82, points_against: 1554.1, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: 141.3 },
    { year: 2024, name_id: 'carlosortiz', team_name: 'Slightly Brown Mamba', wins: 7, losses: 7, points_for: 1458.9, points_against: 1557.04, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: 136.4 },
    { year: 2024, name_id: 'stevescicchitano', team_name: '', wins: 5, losses: 9, points_for: 1448.46, points_against: 1524.36, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: 132.8 },
    { year: 2024, name_id: 'danguadronjasonvoss', team_name: 'Taylor Ham Egg & Cheese', wins: 2, losses: 12, points_for: 1388.96, points_against: 1773.46, regular_season_rank: 10, playoff_finish: null, dues: 240, payout: 0, high_game: 128.1 },
    
    { year: 2023, name_id: 'byronkou', team_name: '', wins: 11, losses: 3, points_for: 2045.7, points_against: 1808.06, regular_season_rank: 1, playoff_finish: 3, dues: 200, payout: 250, high_game: 165.8 },
    { year: 2023, name_id: 'marshallroshto', team_name: '', wins: 9, losses: 5, points_for: 2051.64, points_against: 1767.56, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 1250, high_game: 172.3 },
    { year: 2023, name_id: 'carlosortiz', team_name: 'Slightly Brown Mamba', wins: 8, losses: 6, points_for: 1916.26, points_against: 1789.5, regular_season_rank: 3, playoff_finish: null, dues: 200, payout: 0, high_game: 161.4 },
    { year: 2023, name_id: 'willhubbard', team_name: '', wins: 8, losses: 6, points_for: 1858.16, points_against: 1786.56, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: 155.2 },
    { year: 2023, name_id: 'robcolaneri', team_name: 'Colaneri FC', wins: 8, losses: 6, points_for: 1629.22, points_against: 1676.3, regular_season_rank: 5, playoff_finish: 2, dues: 200, payout: 500, high_game: 148.7 },
    { year: 2023, name_id: 'markreischel', team_name: '', wins: 7, losses: 7, points_for: 1807.96, points_against: 1823.18, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: 159.1 },
    { year: 2023, name_id: 'ruairilynch', team_name: 'Hail Mary', wins: 6, losses: 8, points_for: 1747.66, points_against: 1898.78, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: 152.3 },
    { year: 2023, name_id: 'danguadronjasonvoss', team_name: 'Taylor Ham Egg & Cheese', wins: 6, losses: 8, points_for: 1656.82, points_against: 1829.54, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: 144.8 },
    { year: 2023, name_id: 'davepasi', team_name: 'Laces Out', wins: 5, losses: 9, points_for: 1726.6, points_against: 1797.64, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: 147.9 },
    { year: 2023, name_id: 'stevescicchitano', team_name: '', wins: 2, losses: 12, points_for: 1637.1, points_against: 1900, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: 139.2 },
    
    // Add more historical data for comprehensive records
    { year: 2022, name_id: 'robcolaneri', team_name: 'Colaneri FC', wins: 11, losses: 3, points_for: 1994.38, points_against: 1657.88, regular_season_rank: 1, playoff_finish: 2, dues: 200, payout: 750, high_game: 178.2 },
    { year: 2021, name_id: 'steveshiffer', team_name: 'Philly Shif Eaters', wins: 10, losses: 4, points_for: 2001.88, points_against: 1839.24, regular_season_rank: 1, playoff_finish: 1, dues: 200, payout: 1250, high_game: 185.4 },
    { year: 2020, name_id: 'markreischel', team_name: '', wins: 11, losses: 3, points_for: 2084.9, points_against: 1822.9, regular_season_rank: 1, playoff_finish: 1, dues: 200, payout: 1000, high_game: 198.7 },
    { year: 2019, name_id: 'robcolaneri', team_name: 'Tebows Shaggin Flies', wins: 8, losses: 6, points_for: 1780.6, points_against: 1780.54, regular_season_rank: 3, playoff_finish: 1, dues: 200, payout: 800, high_game: 167.3 },
    { year: 2018, name_id: 'robcolaneri', team_name: 'Tebows Shaggin Flies', wins: 8, losses: 6, points_for: 1971, points_against: 1798.68, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 1000, high_game: 174.8 },
    { year: 2017, name_id: 'stevescicchitano', team_name: "stephen's Team", wins: 9, losses: 5, points_for: 1732.22, points_against: 1611.92, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 800, high_game: 156.9 },
    { year: 2016, name_id: 'robcolaneri', team_name: 'Tebows Shaggin Flies', wins: 7, losses: 7, points_for: 1739.88, points_against: 1740.36, regular_season_rank: 4, playoff_finish: 1, dues: 200, payout: 800, high_game: 163.2 }
  ];

  useEffect(() => {
    setManagers(managersData);
    setTeamSeasons(allTeamSeasons);
  }, []);

  const calculateAllRecords = () => {
    const records = {};
    
    // Initialize records for each manager
    managersData.forEach(manager => {
      records[manager.name_id] = {
        name: manager.full_name,
        active: manager.active,
        championships: 0,
        secondPlace: 0,
        thirdPlace: 0,
        chumpionships: 0,
        totalWins: 0,
        totalLosses: 0,
        totalPointsFor: 0,
        totalPointsAgainst: 0,
        totalPayout: 0,
        totalDues: 0,
        seasons: 0,
        playoffAppearances: 0,
        gamesPlayed: 0,
        bestRecord: null,
        worstRecord: null,
        highestSeasonPoints: 0,
        highestGamePoints: 0,
        mostPointsAgainst: 0,
        netEarnings: 0
      };
    });

    // Process all season data
    allTeamSeasons.forEach(season => {
      if (records[season.name_id]) {
        const record = records[season.name_id];
        record.totalWins += season.wins;
        record.totalLosses += season.losses;
        record.totalPointsFor += season.points_for;
        record.totalPointsAgainst += season.points_against;
        record.totalPayout += season.payout || 0;
        record.totalDues += season.dues || 200;
        record.seasons += 1;
        record.gamesPlayed += (season.wins + season.losses);
        
        // Medal tracking
        if (season.playoff_finish === 1) record.championships += 1;
        if (season.playoff_finish === 2) record.secondPlace += 1;
        if (season.playoff_finish === 3) record.thirdPlace += 1;
        
        // Chumpion tracking (last place in regular season)
        if (season.regular_season_rank === 10) record.chumpionships += 1;
        
        // Playoff appearances (top 6)
        if (season.regular_season_rank <= 6) record.playoffAppearances += 1;
        
        // Record tracking
        const winPct = season.wins / (season.wins + season.losses);
        if (!record.bestRecord || winPct > record.bestRecord.pct || 
            (winPct === record.bestRecord.pct && season.wins > record.bestRecord.wins)) {
          record.bestRecord = { wins: season.wins, losses: season.losses, pct: winPct, year: season.year };
        }
        if (!record.worstRecord || winPct < record.worstRecord.pct || 
            (winPct === record.worstRecord.pct && season.wins < record.worstRecord.wins)) {
          record.worstRecord = { wins: season.wins, losses: season.losses, pct: winPct, year: season.year };
        }
        
        // Points tracking
        if (season.points_for > record.highestSeasonPoints) {
          record.highestSeasonPoints = season.points_for;
          record.highestSeasonYear = season.year;
        }
        if (season.high_game && season.high_game > record.highestGamePoints) {
          record.highestGamePoints = season.high_game;
          record.highestGameYear = season.year;
        }
        if (season.points_against > record.mostPointsAgainst) {
          record.mostPointsAgainst = season.points_against;
          record.mostPointsAgainstYear = season.year;
        }
      }
    });

    // Calculate final stats
    Object.values(records).forEach(record => {
      record.winPct = record.gamesPlayed > 0 ? record.totalWins / (record.totalWins + record.totalLosses) : 0;
      record.pointsPerGame = record.gamesPlayed > 0 ? record.totalPointsFor / record.gamesPlayed : 0;
      record.netEarnings = record.totalPayout - record.totalDues;
      record.totalMedals = record.championships + record.secondPlace + record.thirdPlace;
    });

    return records;
  };

  const allRecords = calculateAllRecords();
  const activeRecords = Object.values(allRecords).filter(r => r.active);
  const inactiveRecords = Object.values(allRecords).filter(r => !r.active);

  // Current champion and chumpion from 2024
  const currentChampion = allRecords['robcolaneri'];
  const currentChumpion = allRecords['danguadronjasonvoss'];

  // Various rankings
  const medalRankings = [...activeRecords, ...inactiveRecords].sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    if (b.secondPlace !== a.secondPlace) return b.secondPlace - a.secondPlace;
    return b.thirdPlace - a.thirdPlace;
  });

  const chumpionRankings = [...activeRecords, ...inactiveRecords].sort((a, b) => b.chumpionships - a.chumpionships);
  
  const winPctRankings = [
    ...activeRecords.sort((a, b) => b.winPct - a.winPct),
    ...inactiveRecords.sort((a, b) => b.winPct - a.winPct)
  ];

  const ppgRankings = [
    ...activeRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame),
    ...inactiveRecords.sort((a, b) => b.pointsPerGame - a.pointsPerGame)
  ];

  // Miscellaneous records
  const miscRecords = {
    mostPointsSeason: Math.max(...Object.values(allRecords).map(r => r.highestSeasonPoints)),
    mostPointsSeasonHolder: Object.values(allRecords).find(r => r.highestSeasonPoints === Math.max(...Object.values(allRecords).map(r => r.highestSeasonPoints))),
    mostPointsGame: Math.max(...Object.values(allRecords).map(r => r.highestGamePoints || 0)),
    mostPointsGameHolder: Object.values(allRecords).find(r => r.highestGamePoints === Math.max(...Object.values(allRecords).map(r => r.highestGamePoints || 0))),
    bestRecord: allTeamSeasons.reduce((best, season) => {
      const winPct = season.wins / (season.wins + season.losses);
      if (!best || winPct > best.pct || (winPct === best.pct && season.wins > best.wins)) {
        return { ...season, pct: winPct, manager: allRecords[season.name_id] };
      }
      return best;
    }, null),
    worstRecord: allTeamSeasons.reduce((worst, season) => {
      const winPct = season.wins / (season.wins + season.losses);
      if (!worst || winPct < worst.pct || (winPct === worst.pct && season.wins < worst.wins)) {
        return { ...season, pct: winPct, manager: allRecords[season.name_id] };
      }
      return worst;
    }, null)
  };

  const rulesContent = `# League Rules

## Keeper Rules
- Each manager may keep **up to 2 players** from year to year.
- A player **cannot be kept more than two consecutive years**, regardless of which manager keeps the player.
- **Keeper cost escalators** (based on the player's previous cost):
  - **First keep year:** previous cost* **+ $5**
  - **Second consecutive keep year:** previous cost **+ $10**
- *For **undrafted** players: the "previous cost" is **½ of Sleeper's projected value for the upcoming season (rounded down)**.

---

## Draft Rules
- **Base draft salary:** **$200** per team.
- **Nomination order:** reverse of the previous season's final **regular season** standings.

---

## 2025 League Dues & Payouts
- **2025 League Dues:** **$250** per team.

### 2025 Payouts
- **$1,250** to **1st place**
- **$650** to **2nd place**
- **$300** for **best regular season record**
- **$300** for **most regular season points**
- **Chumpion** (last place at the end of the regular season) pays **20% of league buy-in ($50)** to **1st place**

---

## Trades
- **Future draft money** may be traded.
  - **In-season limits:** during the active season, a team's **next-year draft salary** must remain between **$190** and **$220**.
  - These limits **do not apply** during the **offseason** for the **upcoming draft**.
- **FAAB** money may be traded.
- **Trade deadline:** **Week 10**.
- **Trade objections process:**
  1. Objecting manager states the objection in **Sleeper league chat**.
  2. The **commissioner** initiates a league vote.
     - If a **majority** vote to **reject**, the commissioner **reverses the trade immediately**.
     - **Trade participants abstain** from voting.

---

## Playoffs
- **6 teams** qualify.
- Weeks **15, 16, 17**.
- **Seeds 1 & 2** receive **byes in Week 15**.

---

## Champion Plaque – Nameplate Engraving
> "To have blank plates engraved, please mail little plate, engraving instructions, and a self-addressed stamped envelope to  
>  
> **NC Trophies**  
> **N5513 Hilltop Rd.**  
> **Ladysmith, WI 54848**  
>  
> Please tape plates face down and include contact information. If you would like to match previous lettering and font size, please send a photo or previous plate as an example.  
>  
> Contact us at **nctrophies@yahoo.com** or **715-415-0528** for any questions or assistance. – Mandi"`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Trophy className="w-8 h-8 text-yellow-500" />
              <h1 className="text-3xl font-bold text-gray-