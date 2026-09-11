/**
 * Letture per la tab "Progetti e operations" del cruscotto: utilizzo del team,
 * capacità residua, scostamento delle ore preventivate, consegne in tempo e
 * customer satisfaction (letta dal foglio Google tramite Edge Function).
 *
 * Tutte le query sui time entry sono paginate a blocchi da 1.000 righe: il
 * limite PostgREST altrimenti taglia i dati e falsa i totali.
 */
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { calculateSafeHours } from '@/lib/timeUtils';
import { getEffectiveContract, type ContractPeriodRow } from '@/lib/contractPeriods';
import {
  businessDaysBetween,
  dailyContractHours,
  grossCapacityHours,
  isAbsenceProjectName,
  roundToMinute,
} from '@/lib/capacity';
import { countBusinessClosureDays, type ClosureDaysSettings } from '@/lib/closureDays';
import {
  normalizeProjectName,
  remainingCapacity,
  saturationPct,
  scopeDeviationPct,
  type PeriodRange,
} from '@/lib/operationsMetrics';


const PAGE_SIZE = 1000;

const EXCLUDED_CLIENT_IDS = new Set([
  '237330c7-a7c6-43d0-ab93-372f92f995d9', // Larin Group
  '311d9691-7f05-4df9-9c17-d2ed8faf4db6', // Larin Srl
]);

const EXCLUDED_UTILIZATION_AREAS = new Set(['sales', 'struttura']);

const ymd = (date: Date) => format(date, 'yyyy-MM-dd');

async function fetchAllPages<T>(
  run: (from: number, to: number) => Promise<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const rows: T[] = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await run(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  return rows;
}

export interface UtilizationMemberRow {
  userId: string;
  fullName: string;
  area: string | null;
  capacityGross: number;
  absenceHours: number;
  capacityNet: number;
  billableHours: number;
  nonBillableHours: number;
  plannedHours: number;
  utilizationPct: number;
  remainingHours: number;
}

export interface UtilizationResult {
  start: string;
  end: string;
  businessDays: number;
  capacityNet: number;
  billableHours: number;
  nonBillableHours: number;
  absenceHours: number;
  plannedHours: number;
  utilizationPct: number;
  saturationPct: number;
  remainingHours: number;
  members: UtilizationMemberRow[];
  byArea: { area: string; capacityNet: number; plannedHours: number; remainingHours: number }[];
  capacity: {
    capacityNet: number;
    plannedHours: number;
    remainingHours: number;
    saturationPct: number;
    byArea: { area: string; capacityNet: number; plannedHours: number; remainingHours: number }[];
  };
}

export function useTeamUtilization(range: PeriodRange | null) {
  return useQuery({
    queryKey: ['ops-utilization', range && ymd(range.start), range && ymd(range.end)],
    enabled: range !== null && !range.empty,
    queryFn: async (): Promise<UtilizationResult> => {
      const { start, end } = range as PeriodRange;
      const fromStr = ymd(start);
      const toStr = ymd(end);
      const businessDays = businessDaysBetween(start, end);

      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name, area')
        .eq('approved', true)
        .is('deleted_at', null);
      if (profilesError) throw profilesError;

      const userIds = (profiles ?? []).map((row) => row.id);
      if (userIds.length === 0) {
        return {
          start: fromStr, end: toStr, businessDays, capacityNet: 0, billableHours: 0, nonBillableHours: 0,
          absenceHours: 0, plannedHours: 0, utilizationPct: 0, saturationPct: 0, remainingHours: 0,
          members: [], byArea: [],
          capacity: { capacityNet: 0, plannedHours: 0, remainingHours: 0, saturationPct: 0, byArea: [] },
        };
      }

      const { fetchProfilesCompensationMap } = await import('@/lib/profilesCompensation');
      const [
        compMap,
        { data: periodsData, error: periodsError },
        { data: closureSettingsRow, error: closureError },
      ] = await Promise.all([
        fetchProfilesCompensationMap(userIds),
        supabase
          .from('user_contract_periods')
          .select('user_id, start_date, end_date, contract_hours, contract_hours_period')
          .in('user_id', userIds),
        supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'closure_days')
          .maybeSingle(),
      ]);
      if (periodsError) throw periodsError;
      if (closureError) throw closureError;
      const contractPeriods = (periodsData ?? []) as ContractPeriodRow[];
      const closureSettings = (closureSettingsRow?.setting_value ?? null) as unknown as ClosureDaysSettings | null;
      const closureBusinessDays = countBusinessClosureDays(start, end, closureSettings);


      const entries = await fetchAllPages<any>((from, to) =>
        supabase
          .from('activity_time_tracking')
          .select(
            'id, user_id, scheduled_date, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, budget_items(project_id, projects:project_id(id, name, area, is_billable))'
          )
          .gte('scheduled_date', fromStr)
          .lte('scheduled_date', toStr)
          .order('id')
          .range(from, to) as any
      );

      interface Acc { billable: number; nonBillable: number; planned: number; absence: number }
      const accs = new Map<string, Acc>(userIds.map((id) => [id, { billable: 0, nonBillable: 0, planned: 0, absence: 0 }]));

      for (const entry of entries) {
        const acc = accs.get(entry.user_id);
        if (!acc) continue;
        const project = entry.budget_items?.projects ?? null;
        const projectName: string = project?.name ?? '';
        const planned = entry.scheduled_start_time && entry.scheduled_end_time
          ? calculateSafeHours(entry.scheduled_start_time, entry.scheduled_end_time, true)
          : 0;
        const confirmed = entry.actual_start_time && entry.actual_end_time
          ? calculateSafeHours(entry.actual_start_time, entry.actual_end_time)
          : 0;

        if (isAbsenceProjectName(projectName)) {
          acc.absence += confirmed || planned;
          continue;
        }
        acc.planned += planned;
        const billable = project?.is_billable !== false && (project?.area ?? '') !== 'interno';
        if (billable) acc.billable += confirmed;
        else acc.nonBillable += confirmed;
      }

      const members: UtilizationMemberRow[] = (profiles ?? []).map((profile) => {
        const acc = accs.get(profile.id)!;
        const comp = compMap.get(profile.id);
        const effective = getEffectiveContract(
          profile.id, start, end, contractPeriods,
          comp?.contract_hours ?? 0,
          comp?.contract_hours_period ?? 'monthly'
        );
        const capacityGross = roundToMinute(grossCapacityHours(effective.hours, effective.period, businessDays));
        const contractType = compMap.get(profile.id)?.contract_type;
        const closureHours =
          closureBusinessDays > 0 && contractType !== 'freelance'
            ? roundToMinute(dailyContractHours(effective.hours, effective.period) * closureBusinessDays)
            : 0;
        const absenceHours = roundToMinute(acc.absence + closureHours);
        const capacityNet = roundToMinute(Math.max(0, capacityGross - absenceHours));

        const billableHours = roundToMinute(acc.billable);
        return {
          userId: profile.id,
          fullName: profile.full_name
            || `${profile.first_name ?? ''} ${profile.last_name ?? ''}`.trim()
            || 'Utente',
          area: profile.area ?? null,
          capacityGross,
          absenceHours,
          capacityNet,
          billableHours,
          nonBillableHours: roundToMinute(acc.nonBillable),
          plannedHours: roundToMinute(acc.planned),
          utilizationPct: capacityNet > 0 ? Math.round((billableHours / capacityNet) * 1000) / 10 : 0,
          remainingHours: remainingCapacity(capacityNet, acc.planned),
        };
      });

      const utilizationMembers = members.filter((member) => {
        const area = (member.area ?? '').toLowerCase();
        if (EXCLUDED_UTILIZATION_AREAS.has(area)) return false;
        const contractType = compMap.get(member.userId)?.contract_type;
        return contractType !== 'consuntivo';
      });

      const capacityMembers = members.filter((member) => {
        const area = (member.area ?? '').toLowerCase();
        return !EXCLUDED_UTILIZATION_AREAS.has(area);
      });

      const sum = (rows: UtilizationMemberRow[], pick: (row: UtilizationMemberRow) => number) =>
        roundToMinute(rows.reduce((total, row) => total + pick(row), 0));

      const capacityNet = sum(utilizationMembers, (row) => row.capacityNet);
      const billableHours = sum(utilizationMembers, (row) => row.billableHours);
      const nonBillableHours = sum(utilizationMembers, (row) => row.nonBillableHours);
      const absenceHours = sum(utilizationMembers, (row) => row.absenceHours);
      const plannedHours = sum(utilizationMembers, (row) => row.plannedHours);

      const capCapacityNet = sum(capacityMembers, (row) => row.capacityNet);
      const capPlannedHours = sum(capacityMembers, (row) => row.plannedHours);

      const buildAreaMap = (rows: UtilizationMemberRow[]) => {
        const areaMap = new Map<string, { area: string; capacityNet: number; plannedHours: number; remainingHours: number }>();
        for (const member of rows) {
          const key = member.area || 'senza area';
          const row = areaMap.get(key) ?? { area: key, capacityNet: 0, plannedHours: 0, remainingHours: 0 };
          row.capacityNet += member.capacityNet;
          row.plannedHours += member.plannedHours;
          row.remainingHours += member.remainingHours;
          areaMap.set(key, row);
        }
        return [...areaMap.values()]
          .map((row) => ({
            ...row,
            capacityNet: roundToMinute(row.capacityNet),
            plannedHours: roundToMinute(row.plannedHours),
            remainingHours: roundToMinute(row.remainingHours),
          }))
          .sort((a, b) => b.remainingHours - a.remainingHours);
      };

      return {
        start: fromStr,
        end: toStr,
        businessDays,
        capacityNet,
        billableHours,
        nonBillableHours,
        absenceHours,
        plannedHours,
        utilizationPct: capacityNet > 0 ? Math.round((billableHours / capacityNet) * 1000) / 10 : 0,
        saturationPct: saturationPct(plannedHours, capacityNet),
        remainingHours: remainingCapacity(capacityNet, plannedHours),
        members: utilizationMembers.sort((a, b) => b.utilizationPct - a.utilizationPct),
        byArea: buildAreaMap(utilizationMembers),
        capacity: {
          capacityNet: capCapacityNet,
          plannedHours: capPlannedHours,
          remainingHours: remainingCapacity(capCapacityNet, capPlannedHours),
          saturationPct: saturationPct(capPlannedHours, capCapacityNet),
          byArea: buildAreaMap(capacityMembers),
        },
      };
    },
  });
}

export interface ScopeCreepRow {
  projectId: string;
  projectName: string;
  clientName: string;
  estimatedHours: number;
  actualHours: number;
  deviationHours: number;
  deviationPct: number | null;
}

export function useScopeCreep(range: PeriodRange | null) {
  return useQuery({
    queryKey: ['ops-scope-creep', range && ymd(range.start), range && ymd(range.end)],
    enabled: range !== null && !range.empty,
    queryFn: async (): Promise<ScopeCreepRow[]> => {
      const { start, end } = range as PeriodRange;
      const fromStr = ymd(start);
      const toStr = ymd(end);

      const { data: projects, error: projectsError } = await supabase
        .from('projects')
        .select('id, name, client_id, area, clients(name)')
        .neq('area', 'interno')
        .or(`start_date.lte.${toStr},start_date.is.null`)
        .or(`end_date.gte.${fromStr},end_date.is.null`);
      if (projectsError) throw projectsError;

      const usable = (projects ?? []).filter((row) => !row.client_id || !EXCLUDED_CLIENT_IDS.has(row.client_id));
      const projectIds = usable.map((row) => row.id);
      if (projectIds.length === 0) return [];

      const estimated = new Map<string, number>();
      const itemIdToProject = new Map<string, string>();
      for (let i = 0; i < projectIds.length; i += 100) {
        const chunk = projectIds.slice(i, i + 100);
        const items = await fetchAllPages<any>((from, to) =>
          supabase
            .from('budget_items')
            .select('id, project_id, hours_worked, is_product')
            .in('project_id', chunk)
            .order('id')
            .range(from, to) as any
        );
        for (const item of items) {
          itemIdToProject.set(item.id, item.project_id);
          if (item.is_product) continue;
          estimated.set(item.project_id, (estimated.get(item.project_id) ?? 0) + Number(item.hours_worked ?? 0));
        }
      }

      const itemIds = [...itemIdToProject.keys()];
      const actual = new Map<string, number>();
      for (let i = 0; i < itemIds.length; i += 100) {
        const chunk = itemIds.slice(i, i + 100);
        const entries = await fetchAllPages<any>((from, to) =>
          supabase
            .from('activity_time_tracking')
            .select('id, budget_item_id, actual_start_time, actual_end_time')
            .in('budget_item_id', chunk)
            .not('actual_start_time', 'is', null)
            .order('id')
            .range(from, to) as any
        );
        for (const entry of entries) {
          const projectId = itemIdToProject.get(entry.budget_item_id);
          if (!projectId) continue;
          const hours = entry.actual_start_time && entry.actual_end_time
            ? calculateSafeHours(entry.actual_start_time, entry.actual_end_time)
            : 0;
          actual.set(projectId, (actual.get(projectId) ?? 0) + hours);
        }
      }

      return usable
        .map((project) => {
          const estimatedHours = roundToMinute(estimated.get(project.id) ?? 0);
          const actualHours = roundToMinute(actual.get(project.id) ?? 0);
          return {
            projectId: project.id,
            projectName: project.name,
            clientName: (project as any).clients?.name ?? 'Senza cliente',
            estimatedHours,
            actualHours,
            deviationHours: roundToMinute(actualHours - estimatedHours),
            deviationPct: scopeDeviationPct(estimatedHours, actualHours),
          };
        })
        .filter((row) => row.estimatedHours > 0 || row.actualHours > 0);
    },
  });
}

export interface DeliveryRow {
  projectId: string;
  projectName: string;
  clientName: string;
  dueDate: string | null;
  completedAt: string | null;
}

export function useOnTimeDelivery(range: PeriodRange | null) {
  return useQuery({
    queryKey: ['ops-on-time-delivery', range && ymd(range.start), range && ymd(range.end)],
    enabled: range !== null && !range.empty,
    queryFn: async (): Promise<DeliveryRow[]> => {
      const { start, end } = range as PeriodRange;
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, client_id, end_date, status_changed_at, updated_at, clients(name)')
        .eq('project_status', 'completato')
        .neq('area', 'interno')
        .gte('status_changed_at', start.toISOString())
        .lte('status_changed_at', new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59).toISOString());
      if (error) throw error;
      return (data ?? [])
        .filter((row) => !row.client_id || !EXCLUDED_CLIENT_IDS.has(row.client_id))
        .map((row) => ({
          projectId: row.id,
          projectName: row.name,
          clientName: (row as any).clients?.name ?? 'Senza cliente',
          dueDate: row.end_date,
          completedAt: row.status_changed_at ?? row.updated_at,
        }));
    },
  });
}

export interface SatisfactionRow {
  clientName: string;
  projectName: string;
  contactName: string;
  area: string;
  projectType: string;
  discipline: string;
  filledAt: string | null;
  nps: number | null;
  improvements: string;
  appreciated: string;
  notes: string;
  projectId: string | null;
}

export function useCustomerSatisfaction(range: PeriodRange | null) {
  return useQuery({
    queryKey: ['ops-customer-satisfaction', range && ymd(range.start), range && ymd(range.end)],
    enabled: range !== null && !range.empty,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<SatisfactionRow[]> => {
      const { start, end } = range as PeriodRange;
      const { data, error } = await supabase.functions.invoke('customer-satisfaction-sheet');
      if (error) throw error;
      const rows = ((data as any)?.rows ?? []) as any[];

      const { data: projects } = await supabase.from('projects').select('id, name');
      const nameToId = new Map<string, string>();
      for (const project of projects ?? []) nameToId.set(normalizeProjectName(project.name), project.id);

      const fromStr = ymd(start);
      const toStr = ymd(end);

      return rows
        .map((row) => ({
          clientName: String(row.client ?? '').trim(),
          projectName: String(row.project ?? '').trim(),
          contactName: String(row.contact ?? '').trim(),
          area: String(row.area ?? '').trim(),
          projectType: String(row.project_type ?? '').trim(),
          discipline: String(row.discipline ?? '').trim(),
          filledAt: row.filled_at ? String(row.filled_at) : null,
          nps: row.nps === null || row.nps === undefined || row.nps === '' ? null : Number(row.nps),
          improvements: String(row.improvements ?? '').trim(),
          appreciated: String(row.appreciated ?? '').trim(),
          notes: String(row.notes ?? '').trim(),
          projectId: nameToId.get(normalizeProjectName(row.project)) ?? null,
        }))
        .filter((row) => {
          if (!row.filledAt) return true;
          const day = row.filledAt.slice(0, 10);
          return day >= fromStr && day <= toStr;
        });
    },
  });
}
