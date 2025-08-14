    { year: 2024, name_id: "markreischel", team_name: "Mark's Team", wins: 8, losses: 6, points_for: 1575.78, points_against: 1485.52, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "willhubbard", team_name: "HubbaD", wins: 8, losses: 6, points_for: 1457.38, points_against: 1429.18, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 7, losses: 7, points_for: 1567.54, points_against: 1563.52, regular_season_rank: 6, playoff_finish: 2, dues: 200, payout: 500, high_game: null },
    { year: 2024, name_id: "ruairilynch", team_name: "Hail Mary", wins: 7, losses: 7, points_for: 1535.82, points_against: 1554.1, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "carlosortiz", team_name: "Slightly Brown Mamba", wins: 7, losses: 7, points_for: 1458.9, points_against: 1557.04, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 5, losses: 9, points_for: 1448.46, points_against: 1524.36, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "danguadronjasonvoss", team_name: "Taylor Ham Egg & Cheese", wins: 2, losses: 12, points_for: 1388.96, points_against: 1773.46, regular_season_rank: 10, playoff_finish: null, dues: 240, payout: 0, high_game: null }
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
              <h1 className="text-3xl font-bold text-gray-900">FF Dashboard</h1>
            </div>
            <nav className="flex space-x-6">
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'records' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Hall of Records
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'rules' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Rules
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'records' && (
          <div className="space-y-8">
            {/* Current Champion & Chumpion */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Crown className="w-6 h-6" />
                      <span className="text-sm font-medium opacity-90">2024 CHAMPION</span>
                    </div>
                    <h2 className="text-2xl font-bold">{currentChampion.name}</h2>
                    <p className="text-yellow-100">Colaneri FC • 10-4 Record</p>
                    <p className="text-yellow-100 font-semibold">$1,540 Prize Money</p>
                  </div>
                  <Trophy className="w-12 h-12 text-yellow-200" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-red-400 to-red-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="w-6 h-6" />
                      <span className="text-sm font-medium opacity-90">2024 CHUMPION</span>
                    </div>
                    <h2 className="text-2xl font-bold">{currentChumpion.name}</h2>
                    <p className="text-red-100">Taylor Ham Egg & Cheese • 2-12 Record</p>
                    <p className="text-red-100 font-semibold">Paid $50 Extra to Champion</p>
                  </div>
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-2xl">
                    🏮
                  </div>
                </div>
              </div>
            </div>

            {/* Medal Count Rankings */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Award className="w-5 h-5 text-yellow-500" />
                <span>Medal Count Rankings</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {medalRankings.map((manager, index) => (
                  <div key={manager.name} className={`p-4 rounded-lg border ${
                    manager.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-lg">#{index + 1}</span>
                        <span className={`font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                        </span>
                        {!manager.active && <span className="text-xs text-gray-500">INACTIVE</span>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      {manager.championships > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                          <span>{manager.championships}</span>
                        </div>
                      )}
                      {manager.secondPlace > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                          <span>{manager.secondPlace}</span>
                        </div>
                      )}
                      {manager.thirdPlace > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-amber-600 rounded-full"></div>
                          <span>{manager.thirdPlace}</span>
                        </div>
                      )}
                      {manager.totalMedals === 0 && (
                        <span className="text-gray-500 italic">No medals</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chumpion Count Rankings */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Target className="w-5 h-5 text-red-500" />
                <span>Chumpion Count Rankings</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {chumpionRankings.filter(m => m.chumpionships > 0).map((manager, index) => (
                  <div key={manager.name} className={`p-4 rounded-lg border-l-4 ${
                    manager.active ? 'bg-red-50 border-red-400' : 'bg-gray-50 border-gray-400 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                        </p>
                        {!manager.active && <span className="text-xs text-gray-500">INACTIVE</span>}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">{manager.chumpionships}</p>
                        <p className="text-xs text-gray-500">chumpionships</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Franchise Win/Loss Records */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-green-500" />
                <span>Franchise Win/Loss Records</span>
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Rank</th>
                      <th className="text-left p-2">Manager</th>
                      <th className="text-left p-2">Record</th>
                      <th className="text-left p-2">Win %</th>
                      <th className="text-left p-2">Seasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winPctRankings.map((manager, index) => (
                      <tr key={manager.name} className={`border-b ${
                        manager.active ? '' : 'bg-gray-50 opacity-75'
                      }`}>
                        <td className="p-2 font-bold">#{index + 1}</td>
                        <td className={`p-2 font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                          {!manager.active && <span className="ml-2 text-xs text-gray-500">INACTIVE</span>}
                        </td>
                        <td className="p-2">{manager.totalWins}-{manager.totalLosses}</td>
                        <td className="p-2 font-bold">{(manager.winPct * 100).toFixed(1)}%</td>
                        <td className="p-2">{manager.seasons}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Franchise Points Scored */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <span>Franchise Points Scored</span>
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Rank</th>
                      <th className="text-left p-2">Manager</th>
                      <th className="text-left p-2">Total Points</th>
                      <th className="text-left p-2">Games Played</th>
                      <th className="text-left p-2">Points Per Game</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ppgRankings.map((manager, index) => (
                      <tr key={manager.name} className={`border-b ${
                        manager.active ? '' : 'bg-gray-50 opacity-75'
                      }`}>
                        <td className="p-2 font-bold">#{index + 1}</td>
                        <td className={`p-2 font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                          {!manager.active && <span className="ml-2 text-xs text-gray-500">INACTIVE</span>}
                        </td>
                        <td className="p-2">{manager.totalPointsFor.toFixed(1)}</td>
                        <td className="p-2">{manager.gamesPlayed}</td>
                        <td className="p-2 font-bold">{manager.pointsPerGame.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Miscellaneous Records */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Zap className="w-5 h-5 text-purple-500" />
                <span>Miscellaneous Records</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Most Points, Season (All-Time)</p>
                    <p className="text-xl font-bold text-blue-600">{miscRecords.mostPointsSeason.toFixed(1)}</p>
                    <p className="text-sm text-gray-700">{miscRecords.mostPointsSeasonHolder.name} ({miscRecords.mostPointsSeasonHolder.highestSeasonYear})</p>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Most Points, Game (All-Time)</p>
                    <p className="text-xl font-bold text-green-600">N/A</p>
                    <p className="text-sm text-gray-700">High game data not available</p>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Best Regular Season Record</p>
                    <p className="text-xl font-bold text-yellow-600">{miscRecords.bestRecord.wins}-{miscRecords.bestRecord.losses}</p>
                    <p className="text-sm text-gray-700">{miscRecords.bestRecord.manager.name} ({miscRecords.bestRecord.year})</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Most Points Against, Season</p>
                    <p className="text-xl font-bold text-red-600">{Math.max(...Object.values(allRecords).map(r => r.mostPointsAgainst)).toFixed(1)}</p>
                    <p className="text-sm text-gray-700">
                      {Object.values(allRecords).find(r => r.mostPointsAgainst === Math.max(...Object.values(allRecords).map(r => r.mostPointsAgainst))).name} 
                      ({Object.values(allRecords).find(r => r.mostPointsAgainst === Math.max(...Object.values(allRecords).map(r => r.mostPointsAgainst))).mostPointsAgainstYear})
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Worst Regular Season Record</p>
                    <p className="text-xl font-bold text-gray-600">{miscRecords.worstRecord.wins}-{miscRecords.worstRecord.losses}</p>
                    <p className="text-sm text-gray-700">{miscRecords.worstRecord.manager.name} ({miscRecords.worstRecord.year})</p>
                  </div>
                  
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">League Parity</p>
                    <p className="text-xl font-bold text-indigo-600">7 Different</p>
                    <p className="text-sm text-gray-700">Champions in 9 seasons</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Manager Lookup */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <span>Manager Lookup</span>
              </h3>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select a Manager
                </label>
                <div className="relative">
                  <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  >
                    <option value="">Choose a manager...</option>
                    {managersData.map(manager => (
                      <option key={manager.name_id} value={manager.name_id}>
                        {manager.full_name} {!manager.active ? '(Inactive)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {selectedManager && allRecords[selectedManager] && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-2xl font-bold text-gray-900">
                      {allRecords[selectedManager].name}
                    </h4>import React, { useState, useEffect } from 'react';
import { Trophy, Users, TrendingUp, DollarSign, Calendar, BookOpen, BarChart3, Award, Zap, Crown, Target, ChevronDown } from 'lucide-react';

const FantasyFootballApp = () => {
  const [activeTab, setActiveTab] = useState('records');
  const [selectedManager, setSelectedManager] = useState('');
  const [managers, setManagers] = useState([]);
  const [teamSeasons, setTeamSeasons] = useState([]);

  // Manager data
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

  // Complete historical data from Excel file
  const allTeamSeasons = [
    { year: 2016, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 11, losses: 3, points_for: 1818.66, points_against: 1490.6, regular_season_rank: 1, playoff_finish: null, dues: 200, payout: 200, high_game: null },
    { year: 2016, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 9, losses: 5, points_for: 1732.22, points_against: 1611.92, regular_season_rank: 2, playoff_finish: 2, dues: 200, payout: 400, high_game: null },
    { year: 2016, name_id: "willhubbard", team_name: "Hubba-D", wins: 9, losses: 5, points_for: 1855.6, points_against: 1717.16, regular_season_rank: 3, playoff_finish: 3, dues: 200, payout: 200, high_game: null },
    { year: 2016, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 7, losses: 7, points_for: 1739.88, points_against: 1740.36, regular_season_rank: 4, playoff_finish: 1, dues: 200, payout: 800, high_game: null },
    { year: 2016, name_id: "marshallroshto", team_name: "My Ball Zach Ertz", wins: 7, losses: 7, points_for: 1695.76, points_against: 1770.98, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2016, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1599.28, points_against: 1633.96, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2016, name_id: "scottzagorski", team_name: "¯\\_(?)_/¯", wins: 3, losses: 11, points_for: 1531.28, points_against: 1839.66, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2016, name_id: "samcarlos", team_name: "savages", wins: 3, losses: 11, points_for: 1522.26, points_against: 1690.3, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 11, losses: 3, points_for: 1818.66, points_against: 1490.6, regular_season_rank: 1, playoff_finish: 2, dues: 200, payout: 600, high_game: null },
    { year: 2017, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 9, losses: 5, points_for: 1732.22, points_against: 1611.92, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 800, high_game: null },
    { year: 2017, name_id: "willhubbard", team_name: "Hubba-D", wins: 9, losses: 5, points_for: 1855.6, points_against: 1717.16, regular_season_rank: 3, playoff_finish: 3, dues: 200, payout: 200, high_game: null },
    { year: 2017, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 7, losses: 7, points_for: 1739.88, points_against: 1740.36, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 7, losses: 7, points_for: 1695.76, points_against: 1770.98, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1599.28, points_against: 1633.96, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "scottzagorski", team_name: "¯\\_(?)_/¯", wins: 3, losses: 11, points_for: 1531.28, points_against: 1839.66, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "samcarlos", team_name: "savages", wins: 3, losses: 11, points_for: 1522.26, points_against: 1690.3, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 10, losses: 4, points_for: 1873.78, points_against: 1584.56, regular_season_rank: 1, playoff_finish: 2, dues: 200, payout: 500, high_game: null },
    { year: 2018, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 8, losses: 6, points_for: 1971, points_against: 1798.68, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 1000, high_game: null },
    { year: 2018, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 8, losses: 6, points_for: 1862.66, points_against: 1850.02, regular_season_rank: 3, playoff_finish: 3, dues: 200, payout: 250, high_game: null },
    { year: 2018, name_id: "willhubbard", team_name: "Hubba-D", wins: 8, losses: 6, points_for: 1825.76, points_against: 1774.98, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 7, losses: 7, points_for: 1815.04, points_against: 1824.2, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1702.32, points_against: 1851.96, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "davepasi", team_name: "Laces Out", wins: 5, losses: 9, points_for: 1743.5, points_against: 1965.76, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "scottzagorski", team_name: "¯\\_(?)_/¯", wins: 5, losses: 9, points_for: 1711.5, points_against: 1978.58, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "samcarlos", team_name: "savages", wins: 4, losses: 10, points_for: 1629.44, points_against: 1867.48, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 2, losses: 12, points_for: 1470.04, points_against: 1892.52, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "markreischel", team_name: "Mark's Team", wins: 10, losses: 4, points_for: 1867.36, points_against: 1711.66, regular_season_rank: 1, playoff_finish: 2, dues: 200, payout: 400, high_game: null },
    { year: 2019, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 9, losses: 5, points_for: 1784.58, points_against: 1714.02, regular_season_rank: 2, playoff_finish: 3, dues: 200, payout: 200, high_game: null },
    { year: 2019, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 8, losses: 6, points_for: 1780.6, points_against: 1780.54, regular_season_rank: 3, playoff_finish: 1, dues: 200, payout: 800, high_game: null },
    { year: 2019, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 8, losses: 6, points_for: 1705.04, points_against: 1747.54, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 7, losses: 7, points_for: 1749.46, points_against: 1750.24, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "willhubbard", team_name: "Hubba-D", wins: 7, losses: 7, points_for: 1716.18, points_against: 1695.3, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "davepasi", team_name: "Laces Out", wins: 6, losses: 8, points_for: 1618.64, points_against: 1706.96, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 6, losses: 8, points_for: 1610.04, points_against: 1748.36, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "scottzagorski", team_name: "¯\\_(?)_/¯", wins: 4, losses: 10, points_for: 1501.84, points_against: 1750.82, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "samcarlos", team_name: "savages", wins: 1, losses: 13, points_for: 1468.16, points_against: 1891.94, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "markreischel", team_name: "Mark's Team", wins: 11, losses: 3, points_for: 2084.9, points_against: 1822.9, regular_season_rank: 1, playoff_finish: 1, dues: 200, payout: 1000, high_game: null },
    { year: 2020, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 10, losses: 4, points_for: 2073.3, points_against: 1863.78, regular_season_rank: 2, playoff_finish: 2, dues: 200, payout: 600, high_game: null },
    { year: 2020, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 9, losses: 5, points_for: 1884.5, points_against: 1834.98, regular_season_rank: 3, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 8, losses: 6, points_for: 1925.88, points_against: 1836.3, regular_season_rank: 4, playoff_finish: 3, dues: 200, payout: 200, high_game: null },
    { year: 2020, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 8, losses: 6, points_for: 1901.46, points_against: 1874.42, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "willhubbard", team_name: "Hubba-D", wins: 7, losses: 7, points_for: 1828.02, points_against: 1918.06, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 6, losses: 8, points_for: 1854.3, points_against: 1933.74, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "davepasi", team_name: "Laces Out", wins: 4, losses: 10, points_for: 1712.76, points_against: 1924.7, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "ruairilynch", team_name: "Hail Mary", wins: 4, losses: 10, points_for: 1734.32, points_against: 1968.28, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "danguadronjasonvoss", team_name: "Taylor Ham Egg & Cheese", wins: 3, losses: 11, points_for: 1709.58, points_against: 1949.32, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "steveshiffer", team_name: "Philly Shif Eaters", wins: 10, losses: 4, points_for: 2001.88, points_against: 1839.24, regular_season_rank: 1, playoff_finish: 1, dues: 200, payout: 1250, high_game: null },
    { year: 2021, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 10, losses: 4, points_for: 1939.44, points_against: 1856.96, regular_season_rank: 2, playoff_finish: 3, dues: 200, payout: 250, high_game: null },
    { year: 2021, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 9, losses: 5, points_for: 1843.92, points_against: 1728.06, regular_season_rank: 3, playoff_finish: 2, dues: 200, payout: 500, high_game: null },
    { year: 2021, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 8, losses: 6, points_for: 1877.5, points_against: 1786.82, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 8, losses: 6, points_for: 1778.5, points_against: 1828.62, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1776.54, points_against: 1756.38, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "willhubbard", team_name: "Hubba-D", wins: 7, losses: 7, points_for: 1742.24, points_against: 1806.58, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "davepasi", team_name: "Laces Out", wins: 5, losses: 9, points_for: 1667.94, points_against: 1854.96, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 4, losses: 10, points_for: 1708.3, points_against: 1869.04, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "ruairilynch", team_name: "Hail Mary", wins: 2, losses: 12, points_for: 1546.2, points_against: 1932.46, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "robcolaneri", team_name: "Colaneri FC", wins: 11, losses: 3, points_for: 1994.38, points_against: 1657.88, regular_season_rank: 1, playoff_finish: 2, dues: 200, payout: 750, high_game: null },
    { year: 2022, name_id: "davepasi", team_name: "Laces Out", wins: 10, losses: 4, points_for: 1880.14, points_against: 1709.9, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 1000, high_game: null },
    { year: 2022, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 9, losses: 5, points_for: 1857.58, points_against: 1720.14, regular_season_rank: 3, playoff_finish: 3, dues: 200, payout: 250, high_game: null },
    { year: 2022, name_id: "willhubbard", team_name: "HubbaD", wins: 8, losses: 6, points_for: 1709.72, points_against: 1671.36, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 8, losses: 6, points_for: 1682.54, points_against: 1705.9, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "carlosortiz", team_name: "Slightly Brown Mamba", wins: 7, losses: 7, points_for: 1723.06, points_against: 1731.7, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "markreischel", team_name: "Mark's Team", wins: 6, losses: 8, points_for: 1664.28, points_against: 1716.7, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "ruairilynch", team_name: "Hail Mary", wins: 6, losses: 8, points_for: 1612.14, points_against: 1751.24, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 4, losses: 10, points_for: 1583.4, points_against: 1832.24, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "danguadronjasonvoss", team_name: "Taylor Ham Egg & Cheese", wins: 3, losses: 11, points_for: 1530.16, points_against: 1795.44, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 11, losses: 3, points_for: 2045.7, points_against: 1808.06, regular_season_rank: 1, playoff_finish: 3, dues: 200, payout: 250, high_game: null },
    { year: 2023, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 9, losses: 5, points_for: 2051.64, points_against: 1767.56, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 1250, high_game: null },
    { year: 2023, name_id: "carlosortiz", team_name: "Slightly Brown Mamba", wins: 8, losses: 6, points_for: 1916.26, points_against: 1789.5, regular_season_rank: 3, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "willhubbard", team_name: "HubbaD", wins: 8, losses: 6, points_for: 1858.16, points_against: 1786.56, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "robcolaneri", team_name: "Colaneri FC", wins: 8, losses: 6, points_for: 1629.22, points_against: 1676.3, regular_season_rank: 5, playoff_finish: 2, dues: 200, payout: 500, high_game: null },
    { year: 2023, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1807.96, points_against: 1823.18, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "ruairilynch", team_name: "Hail Mary", wins: 6, losses: 8, points_for: 1747.66, points_against: 1898.78, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "danguadronjasonvoss", team_name: "Taylor Ham Egg & Cheese", wins: 6, losses: 8, points_for: 1656.82, points_against: 1829.54, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "davepasi", team_name: "Laces Out", wins: 5, losses: 9, points_for: 1726.6, points_against: 1797.64, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 2, losses: 12, points_for: 1637.1, points_against: 1900, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "robcolaneri", team_name: "Colaneri FC", wins: 10, losses: 4, points_for: 1796.44, points_against: 1496, regular_season_rank: 1, playoff_finish: 1, dues: 200, payout: 1540, high_game: null },
    { year: 2024, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 8, losses: 6, points_for: 1764.38, points_against: 1582.18, regular_season_rank: 2, playoff_finish: 3, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "davepasi", team_name: "Laces Out", wins: 8, losses: 6, points_for: 1622.88, points_against: 1651.08, regular_season_rank: 3, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "import React, { useState, useEffect } from 'react';
import { Trophy, Users, TrendingUp, DollarSign, Calendar, BookOpen, BarChart3, Award, Zap, Crown, Target, ChevronDown } from 'lucide-react';

const FantasyFootballApp = () => {
  const [activeTab, setActiveTab] = useState('records');
  const [selectedManager, setSelectedManager] = useState('');
  const [managers, setManagers] = useState([]);
  const [teamSeasons, setTeamSeasons] = useState([]);

  // Manager data
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

  // Complete historical data from your Excel file
  const allTeamSeasons = [
    { year: 2016, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 11, losses: 3, points_for: 1818.66, points_against: 1490.6, regular_season_rank: 1, playoff_finish: null, dues: 200, payout: 200, high_game: null },
    { year: 2016, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 9, losses: 5, points_for: 1732.22, points_against: 1611.92, regular_season_rank: 2, playoff_finish: 2, dues: 200, payout: 400, high_game: null },
    { year: 2016, name_id: "willhubbard", team_name: "Hubba-D", wins: 9, losses: 5, points_for: 1855.6, points_against: 1717.16, regular_season_rank: 3, playoff_finish: 3, dues: 200, payout: 200, high_game: null },
    { year: 2016, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 7, losses: 7, points_for: 1739.88, points_against: 1740.36, regular_season_rank: 4, playoff_finish: 1, dues: 200, payout: 800, high_game: null },
    { year: 2016, name_id: "marshallroshto", team_name: "My Ball Zach Ertz", wins: 7, losses: 7, points_for: 1695.76, points_against: 1770.98, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2016, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1599.28, points_against: 1633.96, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2016, name_id: "scottzagorski", team_name: "¯\\_(?)_/¯", wins: 3, losses: 11, points_for: 1531.28, points_against: 1839.66, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2016, name_id: "samcarlos", team_name: "savages", wins: 3, losses: 11, points_for: 1522.26, points_against: 1690.3, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 11, losses: 3, points_for: 1818.66, points_against: 1490.6, regular_season_rank: 1, playoff_finish: 2, dues: 200, payout: 600, high_game: null },
    { year: 2017, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 9, losses: 5, points_for: 1732.22, points_against: 1611.92, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 800, high_game: null },
    { year: 2017, name_id: "willhubbard", team_name: "Hubba-D", wins: 9, losses: 5, points_for: 1855.6, points_against: 1717.16, regular_season_rank: 3, playoff_finish: 3, dues: 200, payout: 200, high_game: null },
    { year: 2017, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 7, losses: 7, points_for: 1739.88, points_against: 1740.36, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 7, losses: 7, points_for: 1695.76, points_against: 1770.98, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1599.28, points_against: 1633.96, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "scottzagorski", team_name: "¯\\_(?)_/¯", wins: 3, losses: 11, points_for: 1531.28, points_against: 1839.66, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2017, name_id: "samcarlos", team_name: "savages", wins: 3, losses: 11, points_for: 1522.26, points_against: 1690.3, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 10, losses: 4, points_for: 1873.78, points_against: 1584.56, regular_season_rank: 1, playoff_finish: 2, dues: 200, payout: 500, high_game: null },
    { year: 2018, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 8, losses: 6, points_for: 1971, points_against: 1798.68, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 1000, high_game: null },
    { year: 2018, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 8, losses: 6, points_for: 1862.66, points_against: 1850.02, regular_season_rank: 3, playoff_finish: 3, dues: 200, payout: 250, high_game: null },
    { year: 2018, name_id: "willhubbard", team_name: "Hubba-D", wins: 8, losses: 6, points_for: 1825.76, points_against: 1774.98, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 7, losses: 7, points_for: 1815.04, points_against: 1824.2, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1702.32, points_against: 1851.96, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "davepasi", team_name: "Laces Out", wins: 5, losses: 9, points_for: 1743.5, points_against: 1965.76, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "scottzagorski", team_name: "¯\\_(?)_/¯", wins: 5, losses: 9, points_for: 1711.5, points_against: 1978.58, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "samcarlos", team_name: "savages", wins: 4, losses: 10, points_for: 1629.44, points_against: 1867.48, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2018, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 2, losses: 12, points_for: 1470.04, points_against: 1892.52, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "markreischel", team_name: "Mark's Team", wins: 10, losses: 4, points_for: 1867.36, points_against: 1711.66, regular_season_rank: 1, playoff_finish: 2, dues: 200, payout: 400, high_game: null },
    { year: 2019, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 9, losses: 5, points_for: 1784.58, points_against: 1714.02, regular_season_rank: 2, playoff_finish: 3, dues: 200, payout: 200, high_game: null },
    { year: 2019, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 8, losses: 6, points_for: 1780.6, points_against: 1780.54, regular_season_rank: 3, playoff_finish: 1, dues: 200, payout: 800, high_game: null },
    { year: 2019, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 8, losses: 6, points_for: 1705.04, points_against: 1747.54, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 7, losses: 7, points_for: 1749.46, points_against: 1750.24, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "willhubbard", team_name: "Hubba-D", wins: 7, losses: 7, points_for: 1716.18, points_against: 1695.3, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "davepasi", team_name: "Laces Out", wins: 6, losses: 8, points_for: 1618.64, points_against: 1706.96, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 6, losses: 8, points_for: 1610.04, points_against: 1748.36, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "scottzagorski", team_name: "¯\\_(?)_/¯", wins: 4, losses: 10, points_for: 1501.84, points_against: 1750.82, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2019, name_id: "samcarlos", team_name: "savages", wins: 1, losses: 13, points_for: 1468.16, points_against: 1891.94, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "markreischel", team_name: "Mark's Team", wins: 11, losses: 3, points_for: 2084.9, points_against: 1822.9, regular_season_rank: 1, playoff_finish: 1, dues: 200, payout: 1000, high_game: null },
    { year: 2020, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 10, losses: 4, points_for: 2073.3, points_against: 1863.78, regular_season_rank: 2, playoff_finish: 2, dues: 200, payout: 600, high_game: null },
    { year: 2020, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 9, losses: 5, points_for: 1884.5, points_against: 1834.98, regular_season_rank: 3, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 8, losses: 6, points_for: 1925.88, points_against: 1836.3, regular_season_rank: 4, playoff_finish: 3, dues: 200, payout: 200, high_game: null },
    { year: 2020, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 8, losses: 6, points_for: 1901.46, points_against: 1874.42, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "willhubbard", team_name: "Hubba-D", wins: 7, losses: 7, points_for: 1828.02, points_against: 1918.06, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 6, losses: 8, points_for: 1854.3, points_against: 1933.74, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "davepasi", team_name: "Laces Out", wins: 4, losses: 10, points_for: 1712.76, points_against: 1924.7, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "ruairilynch", team_name: "Hail Mary", wins: 4, losses: 10, points_for: 1734.32, points_against: 1968.28, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2020, name_id: "danguadronjasonvoss", team_name: "Taylor Ham Egg & Cheese", wins: 3, losses: 11, points_for: 1709.58, points_against: 1949.32, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "steveshiffer", team_name: "Philly Shif Eaters", wins: 10, losses: 4, points_for: 2001.88, points_against: 1839.24, regular_season_rank: 1, playoff_finish: 1, dues: 200, payout: 1250, high_game: null },
    { year: 2021, name_id: "carlosortiz", team_name: "Gostkowski for Pres.", wins: 10, losses: 4, points_for: 1939.44, points_against: 1856.96, regular_season_rank: 2, playoff_finish: 3, dues: 200, payout: 250, high_game: null },
    { year: 2021, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 9, losses: 5, points_for: 1843.92, points_against: 1728.06, regular_season_rank: 3, playoff_finish: 2, dues: 200, payout: 500, high_game: null },
    { year: 2021, name_id: "robcolaneri", team_name: "Tebows Shaggin Flies", wins: 8, losses: 6, points_for: 1877.5, points_against: 1786.82, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 8, losses: 6, points_for: 1778.5, points_against: 1828.62, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1776.54, points_against: 1756.38, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "willhubbard", team_name: "Hubba-D", wins: 7, losses: 7, points_for: 1742.24, points_against: 1806.58, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "davepasi", team_name: "Laces Out", wins: 5, losses: 9, points_for: 1667.94, points_against: 1854.96, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 4, losses: 10, points_for: 1708.3, points_against: 1869.04, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2021, name_id: "ruairilynch", team_name: "Hail Mary", wins: 2, losses: 12, points_for: 1546.2, points_against: 1932.46, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "robcolaneri", team_name: "Colaneri FC", wins: 11, losses: 3, points_for: 1994.38, points_against: 1657.88, regular_season_rank: 1, playoff_finish: 2, dues: 200, payout: 750, high_game: null },
    { year: 2022, name_id: "davepasi", team_name: "Laces Out", wins: 10, losses: 4, points_for: 1880.14, points_against: 1709.9, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 1000, high_game: null },
    { year: 2022, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 9, losses: 5, points_for: 1857.58, points_against: 1720.14, regular_season_rank: 3, playoff_finish: 3, dues: 200, payout: 250, high_game: null },
    { year: 2022, name_id: "willhubbard", team_name: "HubbaD", wins: 8, losses: 6, points_for: 1709.72, points_against: 1671.36, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 8, losses: 6, points_for: 1682.54, points_against: 1705.9, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "carlosortiz", team_name: "Slightly Brown Mamba", wins: 7, losses: 7, points_for: 1723.06, points_against: 1731.7, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "markreischel", team_name: "Mark's Team", wins: 6, losses: 8, points_for: 1664.28, points_against: 1716.7, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "ruairilynch", team_name: "Hail Mary", wins: 6, losses: 8, points_for: 1612.14, points_against: 1751.24, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 4, losses: 10, points_for: 1583.4, points_against: 1832.24, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2022, name_id: "danguadronjasonvoss", team_name: "Taylor Ham Egg & Cheese", wins: 3, losses: 11, points_for: 1530.16, points_against: 1795.44, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 11, losses: 3, points_for: 2045.7, points_against: 1808.06, regular_season_rank: 1, playoff_finish: 3, dues: 200, payout: 250, high_game: null },
    { year: 2023, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 9, losses: 5, points_for: 2051.64, points_against: 1767.56, regular_season_rank: 2, playoff_finish: 1, dues: 200, payout: 1250, high_game: null },
    { year: 2023, name_id: "carlosortiz", team_name: "Slightly Brown Mamba", wins: 8, losses: 6, points_for: 1916.26, points_against: 1789.5, regular_season_rank: 3, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "willhubbard", team_name: "HubbaD", wins: 8, losses: 6, points_for: 1858.16, points_against: 1786.56, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "robcolaneri", team_name: "Colaneri FC", wins: 8, losses: 6, points_for: 1629.22, points_against: 1676.3, regular_season_rank: 5, playoff_finish: 2, dues: 200, payout: 500, high_game: null },
    { year: 2023, name_id: "markreischel", team_name: "Mark's Team", wins: 7, losses: 7, points_for: 1807.96, points_against: 1823.18, regular_season_rank: 6, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "ruairilynch", team_name: "Hail Mary", wins: 6, losses: 8, points_for: 1747.66, points_against: 1898.78, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "danguadronjasonvoss", team_name: "Taylor Ham Egg & Cheese", wins: 6, losses: 8, points_for: 1656.82, points_against: 1829.54, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "davepasi", team_name: "Laces Out", wins: 5, losses: 9, points_for: 1726.6, points_against: 1797.64, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2023, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 2, losses: 12, points_for: 1637.1, points_against: 1900, regular_season_rank: 10, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "robcolaneri", team_name: "Colaneri FC", wins: 10, losses: 4, points_for: 1796.44, points_against: 1496, regular_season_rank: 1, playoff_finish: 1, dues: 200, payout: 1540, high_game: null },
    { year: 2024, name_id: "marshallroshto", team_name: "The Marsh Men", wins: 8, losses: 6, points_for: 1764.38, points_against: 1582.18, regular_season_rank: 2, playoff_finish: 3, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "davepasi", team_name: "Laces Out", wins: 8, losses: 6, points_for: 1622.88, points_against: 1651.08, regular_season_rank: 3, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "markreischel", team_name: "Mark's Team", wins: 8, losses: 6, points_for: 1575.78, points_against: 1485.52, regular_season_rank: 4, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "willhubbard", team_name: "HubbaD", wins: 8, losses: 6, points_for: 1457.38, points_against: 1429.18, regular_season_rank: 5, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "byronkou", team_name: "Rice Rice Baby", wins: 7, losses: 7, points_for: 1567.54, points_against: 1563.52, regular_season_rank: 6, playoff_finish: 2, dues: 200, payout: 500, high_game: null },
    { year: 2024, name_id: "ruairilynch", team_name: "Hail Mary", wins: 7, losses: 7, points_for: 1535.82, points_against: 1554.1, regular_season_rank: 7, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "carlosortiz", team_name: "Slightly Brown Mamba", wins: 7, losses: 7, points_for: 1458.9, points_against: 1557.04, regular_season_rank: 8, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "stevescicchitano", team_name: "stephen's Team", wins: 5, losses: 9, points_for: 1448.46, points_against: 1524.36, regular_season_rank: 9, playoff_finish: null, dues: 200, payout: 0, high_game: null },
    { year: 2024, name_id: "danguadronjasonvoss", team_name: "Taylor Ham Egg & Cheese", wins: 2, losses: 12, points_for: 1388.96, points_against: 1773.46, regular_season_rank: 10, playoff_finish: null, dues: 240, payout: 0, high_game: null }
  ];
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
              <h1 className="text-3xl font-bold text-gray-900">FF Dashboard</h1>
            </div>
            <nav className="flex space-x-6">
              <button
                onClick={() => setActiveTab('records')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'records' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Hall of Records
              </button>
              <button
                onClick={() => setActiveTab('rules')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  activeTab === 'rules' 
                    ? 'bg-blue-100 text-blue-700' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Rules
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'records' && (
          <div className="space-y-8">
            {/* Current Champion & Chumpion */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Crown className="w-6 h-6" />
                      <span className="text-sm font-medium opacity-90">2024 CHAMPION</span>
                    </div>
                    <h2 className="text-2xl font-bold">{currentChampion.name}</h2>
                    <p className="text-yellow-100">Colaneri FC • 10-4 Record</p>
                    <p className="text-yellow-100 font-semibold">$1,540 Prize Money</p>
                  </div>
                  <Trophy className="w-12 h-12 text-yellow-200" />
                </div>
              </div>

              <div className="bg-gradient-to-r from-red-400 to-red-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <Target className="w-6 h-6" />
                      <span className="text-sm font-medium opacity-90">2024 CHUMPION</span>
                    </div>
                    <h2 className="text-2xl font-bold">{currentChumpion.name}</h2>
                    <p className="text-red-100">Taylor Ham Egg & Cheese • 2-12 Record</p>
                    <p className="text-red-100 font-semibold">Paid $50 Extra to Champion</p>
                  </div>
                  <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center text-2xl">
                    🏮
                  </div>
                </div>
              </div>
            </div>

            {/* Medal Count Rankings */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Award className="w-5 h-5 text-yellow-500" />
                <span>Medal Count Rankings</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {medalRankings.map((manager, index) => (
                  <div key={manager.name} className={`p-4 rounded-lg border ${
                    manager.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-300 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-lg">#{index + 1}</span>
                        <span className={`font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                        </span>
                        {!manager.active && <span className="text-xs text-gray-500">INACTIVE</span>}
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm">
                      {manager.championships > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                          <span>{manager.championships}</span>
                        </div>
                      )}
                      {manager.secondPlace > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
                          <span>{manager.secondPlace}</span>
                        </div>
                      )}
                      {manager.thirdPlace > 0 && (
                        <div className="flex items-center space-x-1">
                          <div className="w-4 h-4 bg-amber-600 rounded-full"></div>
                          <span>{manager.thirdPlace}</span>
                        </div>
                      )}
                      {manager.totalMedals === 0 && (
                        <span className="text-gray-500 italic">No medals</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chumpion Count Rankings */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Target className="w-5 h-5 text-red-500" />
                <span>Chumpion Count Rankings</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {chumpionRankings.filter(m => m.chumpionships > 0).map((manager, index) => (
                  <div key={manager.name} className={`p-4 rounded-lg border-l-4 ${
                    manager.active ? 'bg-red-50 border-red-400' : 'bg-gray-50 border-gray-400 opacity-75'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                        </p>
                        {!manager.active && <span className="text-xs text-gray-500">INACTIVE</span>}
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-red-600">{manager.chumpionships}</p>
                        <p className="text-xs text-gray-500">chumpionships</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Franchise Win/Loss Records */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <BarChart3 className="w-5 h-5 text-green-500" />
                <span>Franchise Win/Loss Records</span>
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Rank</th>
                      <th className="text-left p-2">Manager</th>
                      <th className="text-left p-2">Record</th>
                      <th className="text-left p-2">Win %</th>
                      <th className="text-left p-2">Seasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winPctRankings.map((manager, index) => (
                      <tr key={manager.name} className={`border-b ${
                        manager.active ? '' : 'bg-gray-50 opacity-75'
                      }`}>
                        <td className="p-2 font-bold">#{index + 1}</td>
                        <td className={`p-2 font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                          {!manager.active && <span className="ml-2 text-xs text-gray-500">INACTIVE</span>}
                        </td>
                        <td className="p-2">{manager.totalWins}-{manager.totalLosses}</td>
                        <td className="p-2 font-bold">{(manager.winPct * 100).toFixed(1)}%</td>
                        <td className="p-2">{manager.seasons}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Franchise Points Scored */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                <span>Franchise Points Scored</span>
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Rank</th>
                      <th className="text-left p-2">Manager</th>
                      <th className="text-left p-2">Total Points</th>
                      <th className="text-left p-2">Games Played</th>
                      <th className="text-left p-2">Points Per Game</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ppgRankings.map((manager, index) => (
                      <tr key={manager.name} className={`border-b ${
                        manager.active ? '' : 'bg-gray-50 opacity-75'
                      }`}>
                        <td className="p-2 font-bold">#{index + 1}</td>
                        <td className={`p-2 font-semibold ${manager.active ? 'text-gray-900' : 'text-gray-600'}`}>
                          {manager.name}
                          {!manager.active && <span className="ml-2 text-xs text-gray-500">INACTIVE</span>}
                        </td>
                        <td className="p-2">{manager.totalPointsFor.toFixed(1)}</td>
                        <td className="p-2">{manager.gamesPlayed}</td>
                        <td className="p-2 font-bold">{manager.pointsPerGame.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Miscellaneous Records */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Zap className="w-5 h-5 text-purple-500" />
                <span>Miscellaneous Records</span>
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Most Points, Season (All-Time)</p>
                    <p className="text-xl font-bold text-blue-600">{miscRecords.mostPointsSeason.toFixed(1)}</p>
                    <p className="text-sm text-gray-700">{miscRecords.mostPointsSeasonHolder.name} ({miscRecords.mostPointsSeasonHolder.highestSeasonYear})</p>
                  </div>
                  
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Most Points, Game (All-Time)</p>
                    <p className="text-xl font-bold text-green-600">{miscRecords.mostPointsGame.toFixed(1)}</p>
                    <p className="text-sm text-gray-700">{miscRecords.mostPointsGameHolder.name} ({miscRecords.mostPointsGameHolder.highestGameYear})</p>
                  </div>
                  
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Best Regular Season Record</p>
                    <p className="text-xl font-bold text-yellow-600">{miscRecords.bestRecord.wins}-{miscRecords.bestRecord.losses}</p>
                    <p className="text-sm text-gray-700">{miscRecords.bestRecord.manager.name} ({miscRecords.bestRecord.year})</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Most Points Against, Season</p>
                    <p className="text-xl font-bold text-red-600">{Math.max(...Object.values(allRecords).map(r => r.mostPointsAgainst)).toFixed(1)}</p>
                    <p className="text-sm text-gray-700">
                      {Object.values(allRecords).find(r => r.mostPointsAgainst === Math.max(...Object.values(allRecords).map(r => r.mostPointsAgainst))).name} 
                      ({Object.values(allRecords).find(r => r.mostPointsAgainst === Math.max(...Object.values(allRecords).map(r => r.mostPointsAgainst))).mostPointsAgainstYear})
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">Worst Regular Season Record</p>
                    <p className="text-xl font-bold text-gray-600">{miscRecords.worstRecord.wins}-{miscRecords.worstRecord.losses}</p>
                    <p className="text-sm text-gray-700">{miscRecords.worstRecord.manager.name} ({miscRecords.worstRecord.year})</p>
                  </div>
                  
                  <div className="p-4 bg-indigo-50 rounded-lg">
                    <p className="text-sm font-medium text-gray-600">League Parity</p>
                    <p className="text-xl font-bold text-indigo-600">7 Different</p>
                    <p className="text-sm text-gray-700">Champions in 9 seasons</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Manager Lookup */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center space-x-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <span>Manager Lookup</span>
              </h3>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select a Manager
                </label>
                <div className="relative">
                  <select
                    value={selectedManager}
                    onChange={(e) => setSelectedManager(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
                  >
                    <option value="">Choose a manager...</option>
                    {managersData.map(manager => (
                      <option key={manager.name_id} value={manager.name_id}>
                        {manager.full_name} {!manager.active ? '(Inactive)' : ''}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
                </div>
              </div>

              {selectedManager && allRecords[selectedManager] && (
                <div className="bg-gray-50 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-2xl font-bold text-gray-900">
                      {allRecords[selectedManager].name}
                    </h4>
                    {!allRecords[selectedManager].active && (
                      <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                        INACTIVE
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-1">Franchise Record</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {allRecords[selectedManager].totalWins}-{allRecords[selectedManager].totalLosses}
                      </p>
                      <p className="text-sm text-gray-500">
                        {(allRecords[selectedManager].winPct * 100).toFixed(1)}% win rate
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-1">Playoff Appearances</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {allRecords[selectedManager].playoffAppearances}/{allRecords[selectedManager].seasons}
                      </p>
                      <p className="text-sm text-gray-500">
                        {allRecords[selectedManager].seasons > 0 ? 
                          ((allRecords[selectedManager].playoffAppearances / allRecords[selectedManager].seasons) * 100).toFixed(0) : 0}% rate
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-1">Net Earnings</p>
                      <p className={`text-2xl font-bold ${
                        allRecords[selectedManager].netEarnings >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {allRecords[selectedManager].netEarnings >= 0 ? '+' : '-'}${Math.abs(allRecords[selectedManager].netEarnings)}
                      </p>
                      <p className="text-sm text-gray-500">
                        ${allRecords[selectedManager].totalPayout} won - ${allRecords[selectedManager].totalDues} dues
                      </p>
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-1">Championships</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {allRecords[selectedManager].championships}
                      </p>
                      <p className="text-sm text-gray-500">
                        {allRecords[selectedManager].totalMedals} total medals
                      </p>
                    </div>
                  </div>
                  
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-2">Best Season</p>
                      {allRecords[selectedManager].bestRecord ? (
                        <div>
                          <p className="text-lg font-bold">
                            {allRecords[selectedManager].bestRecord.wins}-{allRecords[selectedManager].bestRecord.losses}
                          </p>
                          <p className="text-sm text-gray-500">
                            {allRecords[selectedManager].bestRecord.year} • {(allRecords[selectedManager].bestRecord.pct * 100).toFixed(1)}% win rate
                          </p>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">No data available</p>
                      )}
                    </div>
                    
                    <div className="bg-white p-4 rounded-lg">
                      <p className="text-sm font-medium text-gray-600 mb-2">Scoring Stats</p>
                      <p className="text-lg font-bold">
                        {allRecords[selectedManager].pointsPerGame.toFixed(1)} PPG
                      </p>
                      <p className="text-sm text-gray-500">
                        {allRecords[selectedManager].totalPointsFor.toFixed(0)} total points in {allRecords[selectedManager].gamesPlayed} games
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'rules' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-8">
              <BookOpen className="w-8 h-8 text-blue-500" />
              <h2 className="text-3xl font-bold text-gray-900">League Rules</h2>
            </div>
            <div className="prose prose-lg max-w-none">
              {rulesContent.split('\n').map((line, index) => {
                if (line.startsWith('# ')) {
                  return <h1 key={index} className="text-3xl font-bold text-gray-900 mt-8 mb-4">{line.slice(2)}</h1>;
                } else if (line.startsWith('## ')) {
                  return <h2 key={index} className="text-2xl font-bold text-gray-800 mt-6 mb-3">{line.slice(3)}</h2>;
                } else if (line.startsWith('### ')) {
                  return <h3 key={index} className="text-xl font-bold text-gray-700 mt-4 mb-2">{line.slice(4)}</h3>;
                } else if (line.startsWith('- ')) {
                  return <li key={index} className="ml-4 text-gray-700 mb-1">{line.slice(2)}</li>;
                } else if (line.startsWith('> ')) {
                  return <blockquote key={index} className="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-4">{line.slice(2)}</blockquote>;
                } else if (line.includes('**') && line.includes('**')) {
                  const parts = line.split('**');
                  return (
                    <p key={index} className="text-gray-700 mb-2">
                      {parts.map((part, i) => 
                        i % 2 === 1 ? <strong key={i}>{part}</strong> : part
                      )}
                    </p>
                  );
                } else if (line.trim() === '' || line.trim() === '---') {
                  return <br key={index} />;
                } else {
                  return <p key={index} className="text-gray-700 mb-2">{line}</p>;
                }
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default FantasyFootballApp;