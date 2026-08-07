import { supabase } from '@/integrations/supabase/client';

const PAGE_SIZE = 1000;

/**
 * Supabase caps every query at 1000 rows. The clients table exceeds that, so any
 * "load the whole client list" query must paginate or names late in the alphabet
 * silently disappear from lists and selectors.
 */
export async function fetchAllClients<T = Record<string, unknown>>(
  columns: string = 'id, name',
  orderBy: string = 'name'
): Promise<T[]> {
  const select = (s: string): string => s;
  const all: T[] = [];
  let from = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from('clients')
      .select(select(columns))
      .order(orderBy)
      .range(from, from + PAGE_SIZE - 1)
      .returns<T[]>();

    if (error) throw error;

    const batch = data || [];
    all.push(...batch);
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}
