/**
 * useWebSocket Hook
 * React hook for managing WebSocket connections and integrating with React Query
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { socketService } from '../utils/socket';

/**
 * Hook to establish and manage WebSocket connection
 * Automatically connects when auth tokens are available
 */
export function useWebSocketConnection() {
  const hasConnected = useRef(false);

  useEffect(() => {
    // Only connect once
    if (!hasConnected.current) {
      const connected = socketService.connect();
      if (connected) {
        hasConnected.current = true;
      }
    }

    // Cleanup on unmount
    return () => {
      if (hasConnected.current) {
        socketService.disconnect();
        hasConnected.current = false;
      }
    };
  }, []);

  return {
    isConnected: socketService.isConnected(),
    socket: socketService
  };
}

/**
 * Hook to subscribe to active week real-time updates
 * Automatically updates React Query cache when data arrives
 * @param {number} year - Season year
 * @param {boolean} enabled - Whether subscription is enabled
 */
export function useActiveWeekRealtime(year, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !year) return;

    // Ensure WebSocket is connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Subscribe to active week updates
    const unsubscribe = socketService.subscribeToActiveWeek(year, (data) => {
      console.log('[useActiveWeekRealtime] Received update', { year, data });

      // Update React Query cache with fresh data
      queryClient.setQueryData(['activeWeek', year], data);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [year, enabled, queryClient]);
}

/**
 * Hook to subscribe to rule voting real-time updates
 * @param {number} year - Season year
 * @param {boolean} enabled - Whether subscription is enabled
 */
export function useRuleVotesRealtime(year, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !year) return;

    // Ensure WebSocket is connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Subscribe to rule vote updates
    const unsubscribe = socketService.subscribeToRuleVotes(year, ({ proposalId, votes }) => {
      console.log('[useRuleVotesRealtime] Vote update', { year, proposalId, votes });

      // Update specific proposal in cache
      queryClient.setQueryData(['ruleProposals', year], (oldData) => {
        if (!oldData) return oldData;

        return oldData.map(proposal =>
          proposal.id === proposalId
            ? { ...proposal, votes }
            : proposal
        );
      });

      // Invalidate to trigger refetch if needed
      queryClient.invalidateQueries({ queryKey: ['ruleProposals', year] });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [year, enabled, queryClient]);
}

/**
 * Hook to subscribe to season/standings real-time updates
 * @param {number} year - Season year
 * @param {boolean} enabled - Whether subscription is enabled
 */
export function useSeasonUpdatesRealtime(year, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !year) return;

    // Ensure WebSocket is connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Subscribe to season updates
    const unsubscribe = socketService.subscribeToSeasonUpdates(year, ({ year: updateYear, teamSeasons }) => {
      console.log('[useSeasonUpdatesRealtime] Season update', { year: updateYear, teamSeasons });

      // Update team seasons cache
      queryClient.setQueryData(['teamSeasons', updateYear], teamSeasons);

      // Invalidate related queries
      queryClient.invalidateQueries({ queryKey: ['seasons'] });
      queryClient.invalidateQueries({ queryKey: ['seasonMatchups', updateYear] });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [year, enabled, queryClient]);
}

/**
 * Hook to subscribe to keeper lock status updates
 * @param {function} onLockChange - Callback when lock status changes
 * @param {boolean} enabled - Whether subscription is enabled
 */
export function useKeeperLockRealtime(onLockChange, enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    // Ensure WebSocket is connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Subscribe to keeper lock updates
    const unsubscribe = socketService.subscribeToKeeperLock(({ year, locked }) => {
      console.log('[useKeeperLockRealtime] Lock update', { year, locked });

      // Invalidate keeper lock queries
      queryClient.invalidateQueries({ queryKey: ['keeperTradeLock', year] });

      // Call user-provided callback
      if (onLockChange) {
        onLockChange({ year, locked });
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [enabled, onLockChange, queryClient]);
}

/**
 * Hook to subscribe to general notifications
 * @param {function} onNotification - Callback for notifications
 * @param {boolean} enabled - Whether subscription is enabled
 */
export function useNotifications(onNotification, enabled = true) {
  useEffect(() => {
    if (!enabled || !onNotification) return;

    // Ensure WebSocket is connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Subscribe to notifications
    const unsubscribe = socketService.subscribeToNotifications((notification) => {
      console.log('[useNotifications] Notification received', notification);
      onNotification(notification);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [enabled, onNotification]);
}

/**
 * Generic hook to listen for custom WebSocket events
 * @param {string} eventName - Event name to listen for
 * @param {function} callback - Callback function
 * @param {boolean} enabled - Whether subscription is enabled
 */
export function useWebSocketEvent(eventName, callback, enabled = true) {
  useEffect(() => {
    if (!enabled || !eventName || !callback) return;

    // Ensure WebSocket is connected
    if (!socketService.isConnected()) {
      socketService.connect();
    }

    // Listen for event
    const unsubscribe = socketService.on(eventName, callback);

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [eventName, callback, enabled]);
}
