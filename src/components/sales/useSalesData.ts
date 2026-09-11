/**
 * Hook di lettura per le viste del cruscotto vendite. Le viste sono in RLS
 * "authenticated legge": nessuna scrittura, nessun filtro per ruolo qui (la
 * voce di menu è già ristretta ad admin/finance/account in AppHeader).
 *
 * Le viste non sono ancora nei tipi generati (src/integrations/supabase/types.ts):
 * `.from(nome as any)` bypassa il controllo statico sul nome, `.returns<T>()`
 * ripristina un tipo preciso sul risultato, stesso pattern già in uso in
 * src/pages/InvoiceQueue.tsx.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type {
  MrrClientRow,
  OfferConversionRow,
  RecurringValueSummaryRow,
  RevenueMonthRow,
  RevenueMixRow,
  RevenueTargetRow,
  SalesByProductRow,
  SalesBySalespersonRow,
  SalesProjectRow,
} from './types';

const EXCLUDED_PROFITABILITY_CLIENT_IDS = new Set([
  '237330c7-a7c6-43d0-ab93-372f92f995d9', // Larin Group
  '311d9691-7f05-4df9-9c17-d2ed8faf4db6', // Larin Srl
]);

export function useSalesYears() {
  return useQuery({
    queryKey: ['sales-years'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revenue_mix' as any)
        .select('anno')
        .returns<{ anno: number }[]>();
      if (error) throw error;
      const years = [...new Set([new Date().getFullYear(), ...data.map((r) => r.anno)])].sort((a, b) => b - a);
      return years;
    },
  });
}

export function useSalesByProduct(year: number | null) {
  return useQuery({
    queryKey: ['sales-by-product', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_by_product' as any)
        .select('*')
        .eq('anno', year)
        .returns<SalesByProductRow[]>();
      if (error) throw error;
      return data;
    },
    enabled: year !== null,
  });
}

export function useSalesBySalesperson(year: number | null) {
  return useQuery({
    queryKey: ['sales-by-salesperson', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales_by_salesperson' as any)
        .select('*')
        .eq('anno', year)
        .returns<SalesBySalespersonRow[]>();
      if (error) throw error;
      return data;
    },
    enabled: year !== null,
  });
}

export function useRevenueMix(year: number | null) {
  return useQuery({
    queryKey: ['revenue-mix', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('revenue_mix' as any)
        .select('*')
        .eq('anno', year)
        .maybeSingle()
        .returns<RevenueMixRow | null>();
      if (error) throw error;
      return data;
    },
    enabled: year !== null,
  });
}

export function useOfferConversion(year: number | null) {
  return useQuery({
    queryKey: ['offer-conversion', year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offer_conversion' as any)
        .select('*')
        .eq('anno', year)
        .returns<OfferConversionRow[]>();
      if (error) throw error;
      return data;
    },
    enabled: year !== null,
  });
}

export function useRevenueHealth(year: number | null) {
  return useQuery({
    queryKey: ['sales-revenue-health', year],
    queryFn: async () => {
      const [{ data: revenue, error: revenueError }, { data: targets, error: targetError }] = await Promise.all([
        supabase.rpc('get_sales_revenue_monthly', { p_year: year as number }),
        supabase.from('sales_revenue_targets').select('id, year, month, amount').eq('year', year as number),
      ]);
      if (revenueError) throw revenueError;
      if (targetError) throw targetError;
      return {
        revenue: (revenue ?? []) as RevenueMonthRow[],
        targets: (targets ?? []) as RevenueTargetRow[],
      };
    },
    enabled: year !== null,
  });
}

export function useMrrHealth() {
  return useQuery({
    queryKey: ['sales-mrr-health'],
    queryFn: async () => {
      const [{ data: summary, error: summaryError }, { data: clients, error: clientsError }] = await Promise.all([
        supabase.from('recurring_value_summary' as any).select('*').single(),
        supabase.rpc('get_sales_mrr_by_client'),
      ]);
      if (summaryError) throw summaryError;
      if (clientsError) throw clientsError;
      return {
        summary: summary as unknown as RecurringValueSummaryRow,
        clients: (clients ?? []) as MrrClientRow[],
      };
    },
  });
}

export function useSalesProjects(year: number | null) {
  return useQuery({
    queryKey: ['sales-margin-projects', year],
    queryFn: async () => {
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client_id, margin_percentage, clients(name)')
        .neq('area', 'interno')
        .or(`start_date.lte.${end},start_date.is.null`)
        .or(`end_date.gte.${start},end_date.is.null`)
        .order('name');
      if (error) throw error;
      return (data ?? [])
        .filter((row) => !row.client_id || !EXCLUDED_PROFITABILITY_CLIENT_IDS.has(row.client_id))
        .map((row) => ({
          id: row.id,
          name: row.name,
          client_id: row.client_id,
          client_name: row.clients?.name ?? 'Senza cliente',
          margin_percentage: row.margin_percentage,
        })) as SalesProjectRow[];
    },
    enabled: year !== null,
  });
}
