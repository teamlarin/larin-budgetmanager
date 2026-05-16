import { supabase } from '@/integrations/supabase/client';

export type ProfileCompensation = {
  id: string;
  hourly_rate: number | null;
  contract_type: string | null;
  contract_hours: number | null;
  contract_hours_period: string | null;
};

/**
 * Fetches compensation fields (hourly_rate, contract_type, contract_hours,
 * contract_hours_period) for the given user IDs. Direct SELECT on these columns
 * is revoked from authenticated; only admins / finance / team leaders can read
 * data for users other than themselves. Non-privileged users only get their own
 * row back. Missing IDs simply return no row.
 *
 * Pass undefined / no argument to fetch all rows the caller is allowed to see.
 */
export async function fetchProfilesCompensation(userIds?: string[]): Promise<ProfileCompensation[]> {
  const ids = userIds && userIds.length > 0 ? Array.from(new Set(userIds.filter(Boolean))) : null;
  const { data, error } = await supabase.rpc('get_profiles_compensation', {
    _user_ids: ids,
  } as any);
  if (error) {
    console.warn('get_profiles_compensation failed', error);
    return [];
  }
  return (data as ProfileCompensation[]) || [];
}

export async function fetchProfilesCompensationMap(
  userIds?: string[],
): Promise<Map<string, ProfileCompensation>> {
  const rows = await fetchProfilesCompensation(userIds);
  return new Map(rows.map((r) => [r.id, r]));
}
