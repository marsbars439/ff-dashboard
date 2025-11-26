/**
 * WebSocket Client Service
 * Handles real-time bidirectional communication with the backend
 */

import { io } from 'socket.io-client';
import { API, STORAGE_KEYS } from './constants';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Connect to WebSocket server
   * Requires authentication token from localStorage
   */
  connect() {
    // Get authentication credentials
    const token = localStorage.getItem(STORAGE_KEYS.ADMIN_TOKEN) ||
                  localStorage.getItem(STORAGE_KEYS.MANAGER_TOKEN);
    const managerId = localStorage.getItem(STORAGE_KEYS.MANAGER_ID);

    if (!token) {
      console.warn('[WebSocket] No auth token available for connection');
      return false;
    }

    // Disconnect existing connection if any
    if (this.socket) {
      this.disconnect();
    }

    console.log('[WebSocket] Connecting to server...', {
      url: API.BASE_URL,
      hasToken: !!token,
      managerId
    });

    // Create Socket.IO connection
    this.socket = io(API.BASE_URL, {
      auth: {
        token,
        managerId
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts
    });

    // Setup event listeners
    this._setupEventListeners();

    return true;
  }

  /**
   * Setup Socket.IO event listeners
   * @private
   */
  _setupEventListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected', { socketId: this.socket.id });
      this.connected = true;
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected', { reason });
      this.connected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error.message);
      this.reconnectAttempts++;

      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.error('[WebSocket] Max reconnection attempts reached');
        this.disconnect();
      }
    });

    this.socket.on('error', (error) => {
      console.error('[WebSocket] Socket error:', error);
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect() {
    if (this.socket) {
      console.log('[WebSocket] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.reconnectAttempts = 0;
    }
  }

  /**
   * Check if connected
   * @returns {boolean}
   */
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }

  /**
   * Subscribe to active week updates
   * @param {number} year - Season year
   * @param {function} callback - Callback function to handle updates
   * @returns {function} Unsubscribe function
   */
  subscribeToActiveWeek(year, callback) {
    if (!this.isConnected()) {
      console.warn('[WebSocket] Cannot subscribe - not connected');
      return () => {};
    }

    console.log('[WebSocket] Subscribing to active week', { year });

    this.socket.emit('subscribe:activeWeek', year);
    this.socket.on('activeWeek:update', callback);

    // Return unsubscribe function
    return () => {
      if (this.socket) {
        console.log('[WebSocket] Unsubscribing from active week', { year });
        this.socket.emit('unsubscribe:activeWeek', year);
        this.socket.off('activeWeek:update', callback);
      }
    };
  }

  /**
   * Subscribe to rule voting updates
   * @param {number} year - Season year
   * @param {function} callback - Callback function to handle updates
   * @returns {function} Unsubscribe function
   */
  subscribeToRuleVotes(year, callback) {
    if (!this.isConnected()) {
      console.warn('[WebSocket] Cannot subscribe - not connected');
      return () => {};
    }

    console.log('[WebSocket] Subscribing to rule votes', { year });

    this.socket.emit('subscribe:rules', year);
    this.socket.on('rule:voteUpdate', callback);

    // Return unsubscribe function
    return () => {
      if (this.socket) {
        console.log('[WebSocket] Unsubscribing from rule votes', { year });
        this.socket.emit('unsubscribe:rules', year);
        this.socket.off('rule:voteUpdate', callback);
      }
    };
  }

  /**
   * Subscribe to season/standings updates
   * @param {number} year - Season year
   * @param {function} callback - Callback function to handle updates
   * @returns {function} Unsubscribe function
   */
  subscribeToSeasonUpdates(year, callback) {
    if (!this.isConnected()) {
      console.warn('[WebSocket] Cannot subscribe - not connected');
      return () => {};
    }

    console.log('[WebSocket] Subscribing to season updates', { year });

    this.socket.emit('subscribe:seasons', year);
    this.socket.on('teamSeasons:update', callback);

    // Return unsubscribe function
    return () => {
      if (this.socket) {
        console.log('[WebSocket] Unsubscribing from season updates', { year });
        this.socket.emit('unsubscribe:seasons', year);
        this.socket.off('teamSeasons:update', callback);
      }
    };
  }

  /**
   * Subscribe to keeper lock updates
   * @param {function} callback - Callback function to handle updates
   * @returns {function} Unsubscribe function
   */
  subscribeToKeeperLock(callback) {
    if (!this.isConnected()) {
      console.warn('[WebSocket] Cannot subscribe - not connected');
      return () => {};
    }

    console.log('[WebSocket] Subscribing to keeper lock updates');

    this.socket.on('keeper:lockUpdate', callback);

    // Return unsubscribe function
    return () => {
      if (this.socket) {
        console.log('[WebSocket] Unsubscribing from keeper lock updates');
        this.socket.off('keeper:lockUpdate', callback);
      }
    };
  }

  /**
   * Subscribe to general notifications
   * @param {function} callback - Callback function to handle notifications
   * @returns {function} Unsubscribe function
   */
  subscribeToNotifications(callback) {
    if (!this.isConnected()) {
      console.warn('[WebSocket] Cannot subscribe - not connected');
      return () => {};
    }

    console.log('[WebSocket] Subscribing to notifications');

    this.socket.on('notification', callback);

    // Return unsubscribe function
    return () => {
      if (this.socket) {
        console.log('[WebSocket] Unsubscribing from notifications');
        this.socket.off('notification', callback);
      }
    };
  }

  /**
   * Emit a custom event
   * @param {string} eventName - Event name
   * @param {*} data - Data to send
   */
  emit(eventName, data) {
    if (!this.isConnected()) {
      console.warn('[WebSocket] Cannot emit - not connected');
      return false;
    }

    this.socket.emit(eventName, data);
    return true;
  }

  /**
   * Listen for a custom event
   * @param {string} eventName - Event name
   * @param {function} callback - Callback function
   * @returns {function} Unsubscribe function
   */
  on(eventName, callback) {
    if (!this.isConnected()) {
      console.warn('[WebSocket] Cannot listen - not connected');
      return () => {};
    }

    this.socket.on(eventName, callback);

    return () => {
      if (this.socket) {
        this.socket.off(eventName, callback);
      }
    };
  }
}

// Create singleton instance
export const socketService = new SocketService();

// Export for testing or multiple instances if needed
export default SocketService;
