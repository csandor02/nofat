import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from './providers';

export function useBootstrap() {
  const { user } = useAuth();
  return useQuery({ queryKey: ['bootstrap', user?.id], queryFn: api.syncDuel, enabled: Boolean(user) });
}

export function useWeekSummary(weekId?: string | null) {
  const { user } = useAuth();
  return useQuery({ queryKey: ['week-summary', user?.id, weekId], queryFn: () => api.getWeekSummary(weekId!), enabled: Boolean(user && weekId) });
}
