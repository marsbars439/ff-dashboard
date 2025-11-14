import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SleeperAdmin from '../SleeperAdmin';

describe('SleeperAdmin Manage Season modal', () => {
  const API_BASE_URL = 'https://example.com/api';

  const createFetchMock = () => {
    const fetchMock = jest.fn();

    fetchMock.mockImplementation((url, options = {}) => {
      if (typeof url === 'string' && url.endsWith('/league-settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            settings: [
              {
                year: 2024,
                league_id: '123',
                keeper_locked: false,
                voting_locked: false
              }
            ]
          })
        });
      }

      if (typeof url === 'string' && url.endsWith('/sleeper/sync-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: [
              {
                year: 2024,
                league_id: '123',
                sync_status: 'completed',
                manual_complete: false
              }
            ]
          })
        });
      }

      if (typeof url === 'string' && url.endsWith('/managers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            managers: [
              {
                id: 1,
                name_id: 'manager-1',
                full_name: 'Manager One',
                emails: ['one@example.com'],
                active: true
              }
            ]
          })
        });
      }

      if (typeof url === 'string' && url.endsWith('/manager-sleeper-ids')) {
        if (options && options.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ mapping: {} })
          });
        }

        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ mappings: [] })
        });
      }

      if (typeof url === 'string' && /\/team-seasons\/(\d+)$/.test(url)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            teamSeasons: [
              {
                id: 10,
                year: 2024,
                name_id: 'manager-1',
                manager_name: 'Manager One',
                team_name: 'Team One',
                wins: 10,
                losses: 3,
                points_for: 1200,
                points_against: 900,
                regular_season_rank: 1,
                playoff_finish: 'Champion',
                dues: 100,
                payout: 500,
                dues_chumpion: 0
              }
            ]
          })
        });
      }

      if (typeof url === 'string' && url.includes('/league-settings/2024')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    return fetchMock;
  };

  beforeEach(() => {
    global.fetch = createFetchMock();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('opens the season management modal when Manage Season is clicked', async () => {
    render(
      <SleeperAdmin
        API_BASE_URL={API_BASE_URL}
        onDataUpdate={jest.fn()}
        onKeeperLockChange={jest.fn()}
        onVotingLockChange={jest.fn()}
      />
    );

    const manageButton = await screen.findByRole('button', { name: /Manage Season/i });
    await userEvent.click(manageButton);

    await waitFor(() => {
      expect(screen.getByText(/Season Management · 2024/)).toBeInTheDocument();
    });
  });

  it('handles non-string manager names when loading season data', async () => {
    global.fetch = jest.fn((url, options = {}) => {
      if (typeof url === 'string' && url.endsWith('/league-settings')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            settings: [
              {
                year: 2024,
                league_id: '123'
              }
            ]
          })
        });
      }

      if (typeof url === 'string' && url.endsWith('/sleeper/sync-status')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            status: [
              {
                year: 2024,
                league_id: '123',
                sync_status: 'completed',
                manual_complete: false
              }
            ]
          })
        });
      }

      if (typeof url === 'string' && url.endsWith('/managers')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            managers: [
              {
                id: 1,
                name_id: 'manager-1',
                full_name: 'Manager One',
                emails: ['one@example.com'],
                active: true
              }
            ]
          })
        });
      }

      if (typeof url === 'string' && url.endsWith('/manager-sleeper-ids')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ mappings: [] })
        });
      }

      if (typeof url === 'string' && /\/team-seasons\/(\d+)$/.test(url)) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            teamSeasons: [
              {
                id: 10,
                year: 2024,
                name_id: 'manager-1',
                manager_name: 12345,
                team_name: 'Team One',
                wins: 10,
                losses: 3,
                points_for: 1200,
                points_against: 900,
                regular_season_rank: 1,
                playoff_finish: 'Champion',
                dues: 100,
                payout: 500,
                dues_chumpion: 0
              }
            ]
          })
        });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });

    render(
      <SleeperAdmin
        API_BASE_URL={API_BASE_URL}
        onDataUpdate={jest.fn()}
        onKeeperLockChange={jest.fn()}
        onVotingLockChange={jest.fn()}
        adminToken="test-token"
      />
    );

    const manageButton = await screen.findByRole('button', { name: /Manage Season/i });
    await userEvent.click(manageButton);

    await waitFor(() => {
      expect(screen.getByText(/Season Management · 2024/)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('Team One')).toBeInTheDocument();
    });
  });
});
