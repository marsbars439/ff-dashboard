/**
 * useTeamSeasons Hook
 * Fetches and manages team seasons data using React Query
 */

import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../utils/queryClient';

export function useTeamSeasons(year = null) {
  const queryKey = year
    ? queryKeys.teamSeasons.byYear(year)
    : queryKeys.teamSeasons.all;

  const endpoint = year
    ? `/team-seasons/${year}`
    : '/team-seasons';

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: () => api.get(endpoint),
    staleTime: 5 * 60 * 1000, // 5 minutes - team seasons update more frequently
  });

  const teamSeasons = data?.teamSeasons || [];

  return {
    teamSeasons,
    loading: isLoading,
    error: error?.message || null
  };
}
