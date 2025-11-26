/**
 * useManagers Hook
 * Fetches and manages manager data using React Query
 */

import { useQuery } from '@tanstack/react-query';
import { api, queryKeys } from '../utils/queryClient';

export function useManagers() {
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.managers.all,
    queryFn: () => api.get('/api/managers'),
    staleTime: 10 * 60 * 1000, // 10 minutes - managers data changes infrequently
  });

  return {
    managers: data?.managers || [],
    loading: isLoading,
    error: error?.message || null
  };
}
