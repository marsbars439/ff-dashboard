/**
 * Frontend Application Constants
 * Centralized configuration values
 */

// API Configuration
export const API = {
  BASE_URL: process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001',
  TIMEOUT_MS: 30000, // 30 seconds
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
};

// Polling Intervals
export const POLLING = {
  ACTIVE_WEEK_INTERVAL_MS: 30000, // 30 seconds
  STANDINGS_INTERVAL_MS: 60000, // 1 minute
  DEFAULT_INTERVAL_MS: 30000 // 30 seconds
};

// Fantasy Football Settings
export const FANTASY = {
  PLAYOFF_THRESHOLD: 6,
  REGULAR_SEASON_WEEKS: 14,
  TOTAL_WEEKS: 18,
  MIN_YEAR: 2016,
  KEEPER_SLOTS: 3
};

// Tab Names (for navigation)
export const TABS = {
  RECORDS: 'records',
  SEASONS: 'seasons',
  PRESEASON: 'preseason',
  RULES: 'rules',
  ADMIN: 'admin',
  ANALYTICS: 'analytics'
};

// Local Storage Keys
export const STORAGE_KEYS = {
  ADMIN_TOKEN: 'adminToken',
  ADMIN_TOKEN_EXPIRY: 'adminTokenExpiry',
  MANAGER_ID: 'managerId',
  MANAGER_TOKEN: 'managerToken',
  MANAGER_TOKEN_EXPIRY: 'managerTokenExpiry',
  ACTIVE_TAB: 'activeTab',
  THEME: 'theme',
  SELECTED_MANAGER: 'selectedManager',
  SELECTED_YEAR: 'selectedYear'
};

// Authentication
export const AUTH = {
  ADMIN_TOKEN_TTL_MS: 15 * 60 * 1000, // 15 minutes
  MANAGER_TOKEN_TTL_MS: 12 * 60 * 60 * 1000, // 12 hours
  TOKEN_REFRESH_BUFFER_MS: 5 * 60 * 1000 // Refresh 5 minutes before expiry
};

// UI Constants
export const UI = {
  DEBOUNCE_MS: 300,
  TOAST_DURATION_MS: 3000,
  ANIMATION_DURATION_MS: 200,
  MAX_MOBILE_WIDTH: 768,
  MAX_TABLET_WIDTH: 1024
};

// Chart Colors (for analytics)
export const CHART_COLORS = {
  PRIMARY: '#3b82f6',
  SECONDARY: '#8b5cf6',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  DANGER: '#ef4444',
  INFO: '#06b6d4',
  NEUTRAL: '#6b7280'
};

// Player Position Colors
export const POSITION_COLORS = {
  QB: '#ef4444',
  RB: '#10b981',
  WR: '#3b82f6',
  TE: '#f59e0b',
  K: '#8b5cf6',
  DEF: '#6b7280'
};

// Record Types
export const RECORD_TYPES = {
  CHAMPIONSHIPS: 'championships',
  PLAYOFF_APPEARANCES: 'playoff_appearances',
  REGULAR_SEASON_WINS: 'regular_season_wins',
  POINTS_FOR: 'points_for',
  POINTS_AGAINST: 'points_against',
  WIN_PERCENTAGE: 'win_percentage',
  PLAYOFF_WIN_PERCENTAGE: 'playoff_win_percentage'
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  SESSION_EXPIRED: 'Your session has expired. Please log in again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.'
};

// Success Messages
export const SUCCESS_MESSAGES = {
  SAVE_SUCCESS: 'Changes saved successfully',
  DELETE_SUCCESS: 'Deleted successfully',
  UPDATE_SUCCESS: 'Updated successfully',
  LOGIN_SUCCESS: 'Logged in successfully',
  LOGOUT_SUCCESS: 'Logged out successfully'
};

export default {
  API,
  POLLING,
  FANTASY,
  TABS,
  STORAGE_KEYS,
  AUTH,
  UI,
  CHART_COLORS,
  POSITION_COLORS,
  RECORD_TYPES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES
};
