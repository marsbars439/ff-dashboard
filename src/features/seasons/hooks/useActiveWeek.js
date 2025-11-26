/**
 * useActiveWeek Hook
 * Fetches active week matchups with automatic polling using React Query
 */

import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../utils/queryClient';

const ACTIVE_WEEK_REFRESH_INTERVAL_MS = 30000; // 30 seconds

export function useActiveWeek(year, enabled = true) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.activeWeek.current(year),
    queryFn: () => api.get(`/api/active-week/${year}`),
    enabled: !!year && enabled,
    staleTime: 0, // Always consider active week data stale
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: enabled ? ACTIVE_WEEK_REFRESH_INTERVAL_MS : false, // Auto-refetch every 30 seconds
    refetchIntervalInBackground: false, // Don't refetch when tab is not visible
    retry: 3,
  });

  return {
    activeWeekData: data || null,
    loading: isLoading,
    error: error?.message || null,
    refetch
  };
}
