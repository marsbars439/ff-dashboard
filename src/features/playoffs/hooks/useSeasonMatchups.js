/**
 * useSeasonMatchups Hook
 * Fetches full-season matchup schedule for a given year
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../../../utils/queryClient';

export function useSeasonMatchups(year) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['seasonMatchups', year],
    queryFn: () => api.get(`/seasons/${year}/matchups`),
    enabled: Boolean(year),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    matchups: data?.matchups || [],
    loading: isLoading,
    error: error?.message || null
  };
}

export default useSeasonMatchups;
