import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { RestaurantInfo, StaffUser } from '../types';

export interface StaffIdentity { user: StaffUser; restaurant: RestaurantInfo }

export function useStaff() {
  return useQuery({
    queryKey: ['staff', 'me'],
    queryFn: () => api.get<StaffIdentity>('/auth/me'),
    retry: false,
    staleTime: 30_000
  });
}
