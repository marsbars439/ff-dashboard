const test = require('node:test');
const assert = require('node:assert/strict');

const gameStatusServiceModule = require('../gameStatusService');
const { GameStatusService } = gameStatusServiceModule;

test('normalizes ESPN event payload', async () => {
  const service = new GameStatusService();
  service.cacheTtlMs = 0;
  service.isConfigured = () => true;

  const espnEvent = {
    id: '401547999',
    date: '2023-09-12T00:15Z',
    status: {
      clock: '0:00',
      displayClock: '0:00',
      period: 4,
      type: {
        name: 'STATUS_FINAL',
        state: 'post',
        completed: true,
        description: 'Final',
        detail: 'Final',
        shortDetail: 'Final'
      }
    },
    competitions: [
      {
        id: '401547999',
        date: '2023-09-12T00:15Z',
        status: {
          clock: '0:00',
          displayClock: '0:00',
          period: 4,
          type: {
            name: 'STATUS_FINAL',
            state: 'post',
            completed: true,
            description: 'Final',
            detail: 'Final',
            shortDetail: 'Final'
          }
        },
        competitors: [
          {
            id: '23',
            homeAway: 'home',
            score: '22',
            team: {
              id: '23',
              displayName: 'New York Jets',
              shortDisplayName: 'Jets',
              name: 'Jets',
              location: 'New York',
              abbreviation: 'NYJ'
            }
          },
          {
            id: '2',
            homeAway: 'away',
            score: '16',
            team: {
              id: '2',
              displayName: 'Buffalo Bills',
              shortDisplayName: 'Bills',
              name: 'Bills',
              location: 'Buffalo',
              abbreviation: 'BUF'
            }
          }
        ]
      }
    ]
  };

  let receivedOverrides = null;
  service.fetchWeekGames = async (season, week, overrides) => {
    assert.strictEqual(season, 2023);
    assert.strictEqual(week, 1);
    receivedOverrides = overrides;
    return [espnEvent];
  };

  const result = await service.getWeekGameStatuses(2023, 1, {
    dates: '20230907-20230913'
  });

  assert.deepStrictEqual(receivedOverrides, { dates: '20230907-20230913' });

  const jets = result.NYJ;
  const bills = result.BUF;

  assert.ok(jets, 'expected Jets entry');
  assert.ok(bills, 'expected Bills entry');
  assert.strictEqual(jets, bills, 'home and away teams should share the same meta object');

  assert.strictEqual(jets.homeTeam, 'NYJ');
  assert.strictEqual(jets.awayTeam, 'BUF');
  assert.strictEqual(jets.status, 'final');
  assert.strictEqual(jets.activityKey, 'finished');
  assert.strictEqual(jets.isFinal, true);
  assert.strictEqual(jets.homeScore, 22);
  assert.strictEqual(jets.awayScore, 16);
  assert.strictEqual(jets.detail, 'Q4 0:00');
  assert.strictEqual(jets.quarter, 'Q4');
  assert.strictEqual(jets.clock, '0:00');
  assert.ok(typeof jets.startTime === 'number' && jets.startTime > 0);
});
