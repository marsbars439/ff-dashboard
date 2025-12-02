/**
 * usePlayoffBracket Hook
 * Fetches playoff bracket data using React Query
 */

import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../../../utils/queryClient';

export function usePlayoffBracket(year, isRegularSeasonComplete) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['seasons', year, 'playoffBracket'],
    queryFn: async () => {
      if (!isRegularSeasonComplete) {
        return [];
      }
      return await api.get(`/playoff-bracket/${year}`);
    },
    enabled: !!year && isRegularSeasonComplete, // Only run if year and season is complete
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  return {
    playoffBracket: data || [],
    loading: isLoading,
    error: error?.message || null
  };
}
