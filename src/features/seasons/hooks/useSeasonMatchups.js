/**
 * useSeasonMatchups Hook
 * Fetches season matchups data using React Query
 */

import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../utils/queryClient';

const seasonsWithoutMatchups = [2016, 2017, 2018, 2019];

export function useSeasonMatchups(year) {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.seasons.matchups(year, 'all'),
    queryFn: async () => {
      if (seasonsWithoutMatchups.includes(year)) {
        return [];
      }
      return await api.get(`/api/matchups/${year}`);
    },
    enabled: !!year, // Only run query if year is provided
    staleTime: 10 * 60 * 1000, // 10 minutes - historical matchups don't change
  });

  return {
    matchups: data || [],
    loading: isLoading,
    error: error?.message || null
  };
}
