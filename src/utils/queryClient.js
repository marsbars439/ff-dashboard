/**
 * React Query Configuration
 * Centralized query client and API utilities for data fetching
 */

import { QueryClient } from '@tanstack/react-query';
import { API } from './constants';

// Create Query Client with default options
// Implements stale-while-revalidate caching strategy for optimal performance
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale-while-revalidate configuration
      staleTime: 5 * 60 * 1000, // 5 minutes - data stays fresh, won't refetch
      gcTime: 30 * 60 * 1000, // 30 minutes - garbage collection time (formerly cacheTime in v4)

      // Network optimization
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Don't refetch when user returns to window
      refetchOnReconnect: true, // Refetch when internet reconnects
      refetchOnMount: true, // Refetch on component mount if data is stale

      // Error handling
      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Query error:', error);
        }
      },

      // Network mode
      networkMode: 'online' // Only fetch when online
    },
    mutations: {
      retry: 1, // Only retry mutations once
      networkMode: 'online',
      onError: (error) => {
        if (process.env.NODE_ENV === 'development') {
          console.error('Mutation error:', error);
        }
      }
    }
  }
});

// API Helper Functions
export const api = {
  /**
   * GET request
   * @param {string} endpoint - API endpoint (e.g., '/api/managers')
   * @returns {Promise<any>} Response data
   */
  get: async (endpoint) => {
    const response = await fetch(`${API.BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorMessage = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorMessage || response.statusText}`);
    }

    return response.json();
  },

  /**
   * POST request
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request body data
   * @returns {Promise<any>} Response data
   */
  post: async (endpoint, data) => {
    const response = await fetch(`${API.BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorMessage = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorMessage || response.statusText}`);
    }

    return response.json();
  },

  /**
   * PUT request
   * @param {string} endpoint - API endpoint
   * @param {object} data - Request body data
   * @returns {Promise<any>} Response data
   */
  put: async (endpoint, data) => {
    const response = await fetch(`${API.BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorMessage = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorMessage || response.statusText}`);
    }

    return response.json();
  },

  /**
   * DELETE request
   * @param {string} endpoint - API endpoint
   * @returns {Promise<any>} Response data
   */
  delete: async (endpoint) => {
    const response = await fetch(`${API.BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorMessage = await response.text().catch(() => 'Unknown error');
      throw new Error(`HTTP ${response.status}: ${errorMessage || response.statusText}`);
    }

    return response.json();
  }
};

// Query Key Factories
// These help maintain consistent query keys across the app
export const queryKeys = {
  // Manager queries
  managers: {
    all: ['managers'],
    detail: (managerId) => ['managers', managerId]
  },

  // Team Seasons queries
  teamSeasons: {
    all: ['teamSeasons'],
    byYear: (year) => ['teamSeasons', year],
    byManager: (managerId) => ['teamSeasons', 'manager', managerId]
  },

  // Seasons queries
  seasons: {
    all: ['seasons'],
    detail: (year) => ['seasons', year],
    standings: (year) => ['seasons', year, 'standings'],
    matchups: (year, week) => ['seasons', year, 'matchups', week]
  },

  // Active Week queries
  activeWeek: {
    current: (year) => ['activeWeek', year]
  },

  // Keepers queries
  keepers: {
    byYear: (year) => ['keepers', year],
    byRoster: (year, rosterId) => ['keepers', year, rosterId],
    tradeLock: (year) => ['keepers', 'tradeLock', year]
  },

  // Rules queries
  rules: {
    proposals: (year) => ['rules', 'proposals', year],
    detail: (proposalId) => ['rules', 'proposals', proposalId],
    votes: (proposalId) => ['rules', 'proposals', proposalId, 'votes']
  },

  // Analytics queries
  analytics: {
    all: (year) => ['analytics', year],
    performance: (year) => ['analytics', 'performance', year],
    trends: (year) => ['analytics', 'trends', year]
  }
};

export default queryClient;
