import { useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchProfilesCompensationMap, type ProfileCompensation } from '@/lib/profilesCompensation';
import {
  getEffectiveContract,
  getEffectiveContractForDate,
  type ContractPeriodRow,
  type EffectiveContract,
} from '@/lib/contractPeriods';

export interface ContractResolverData {
  periods: ContractPeriodRow[];
  compensation: Map<string, ProfileCompensation>;
}

export async function fetchContractData(userIds?: string[]): Promise<ContractResolverData> {
  const ids = userIds && userIds.length > 0 ? Array.from(new Set(userIds.filter(Boolean))) : undefined;

  let periodsQuery = supabase
    .from('user_contract_periods')
    .select('user_id, start_date, end_date, contract_hours, contract_hours_period, contract_type');
  if (ids) periodsQuery = periodsQuery.in('user_id', ids);

  const [{ data: periods }, compensation] = await Promise.all([
    periodsQuery,
    fetchProfilesCompensationMap(ids),
  ]);

  return { periods: (periods || []) as ContractPeriodRow[], compensation };
}

export function resolveContract(
  data: ContractResolverData | undefined,
  userId: string,
  from: Date,
  to: Date
): EffectiveContract {
  const comp = data?.compensation.get(userId);
  return getEffectiveContract(
    userId,
    from,
    to,
    data?.periods || [],
    Number(comp?.contract_hours || 0),
    comp?.contract_hours_period || 'monthly',
    comp?.contract_type ?? null
  );
}

/**
 * Riferimento contrattuale condiviso: i periodi in `user_contract_periods`
 * vincono, il profilo resta solo come ripiego. Usare questo hook in tutte le
 * viste per evitare capacità diverse per la stessa persona.
 */
export function useContractResolver(userIds?: string[]) {
  const ids = useMemo(
    () => (userIds && userIds.length > 0 ? Array.from(new Set(userIds.filter(Boolean))).sort() : undefined),
    [userIds]
  );

  const query = useQuery({
    queryKey: ['contracts', ids?.join(',') || 'all'],
    queryFn: () => fetchContractData(ids),
    staleTime: 5 * 60 * 1000,
  });

  const resolve = useCallback(
    (userId: string, from: Date, to: Date) => resolveContract(query.data, userId, from, to),
    [query.data]
  );

  const resolveForDate = useCallback(
    (userId: string, date: Date) => {
      const comp = query.data?.compensation.get(userId);
      return getEffectiveContractForDate(
        userId,
        date,
        query.data?.periods || [],
        Number(comp?.contract_hours || 0),
        comp?.contract_hours_period || 'monthly',
        comp?.contract_type ?? null
      );
    },
    [query.data]
  );

  return { ...query, resolve, resolveForDate };
}
