/**
 * Custom hook for state persistence in localStorage
 * Automatically syncs state with localStorage and handles JSON serialization
 */
import { useState, useEffect } from 'react';

/**
 * Hook that persists state to localStorage
 * @param {string} key - The localStorage key
 * @param {*} defaultValue - Default value if no stored value exists
 * @returns {[*, function]} - Stateful value and setter function
 */
export function usePersistedState(key, defaultValue) {
  // Initialize state from localStorage or use default
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error loading ${key} from localStorage:`, error);
      return defaultValue;
    }
  });

  // Sync state changes to localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error saving ${key} to localStorage:`, error);
    }
  }, [key, state]);

  return [state, setState];
}
