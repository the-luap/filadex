import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Currency, TemperatureUnit } from './units';

interface UserUnits {
  currency: Currency;
  temperatureUnit: TemperatureUnit;
}

const DEFAULT_UNITS: UserUnits = {
  currency: 'EUR',
  temperatureUnit: 'C',
};

/**
 * Hook to access and update user units preferences
 */
export function useUnits() {
  const queryClient = useQueryClient();

  // Fetch user data to get units preferences
  const { data: userData } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: () => apiRequest<{ currency?: Currency; temperatureUnit?: TemperatureUnit }>('/api/auth/me'),
    retry: false,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Update units mutation
  const updateUnitsMutation = useMutation({
    mutationFn: (units: Partial<UserUnits>) => {
      return apiRequest('/api/users/units', {
        method: 'POST',
        body: JSON.stringify(units),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
    },
  });

  const currency: Currency = userData?.currency || DEFAULT_UNITS.currency;
  const temperatureUnit: TemperatureUnit = userData?.temperatureUnit || DEFAULT_UNITS.temperatureUnit;

  const updateUnits = (units: Partial<UserUnits>) => {
    updateUnitsMutation.mutate(units);
  };

  return {
    currency,
    temperatureUnit,
    updateUnits,
    isLoading: updateUnitsMutation.isPending,
  };
}

