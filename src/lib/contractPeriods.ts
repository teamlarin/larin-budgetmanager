// Helpers to resolve effective contract hours for a user in a date range,
// honoring overrides stored in `user_contract_periods`.

export interface ContractPeriodRow {
  user_id: string;
  start_date: string; // 'yyyy-MM-dd'
  end_date: string | null; // 'yyyy-MM-dd' or null = open-ended
  contract_hours: number | null;
  contract_hours_period: string | null;
}

export interface EffectiveContract {
  hours: number;
  period: string;
}

/**
 * Returns the contract that overlaps the given window. If multiple periods
 * overlap, the one with the most recent `start_date` wins. Falls back to the
 * profile defaults when no period matches.
 */
export function getEffectiveContract(
  userId: string,
  windowStart: Date,
  windowEnd: Date,
  periods: ContractPeriodRow[],
  fallbackHours: number,
  fallbackPeriod: string
): EffectiveContract {
  const startStr = formatYmd(windowStart);
  const endStr = formatYmd(windowEnd);

  const overlapping = periods
    .filter(p => p.user_id === userId)
    .filter(p => {
      const sOk = p.start_date <= endStr;
      const eOk = !p.end_date || p.end_date >= startStr;
      return sOk && eOk;
    })
    .sort((a, b) => (a.start_date < b.start_date ? 1 : -1));

  const match = overlapping[0];
  if (match && match.contract_hours != null) {
    return {
      hours: match.contract_hours,
      period: match.contract_hours_period || fallbackPeriod,
    };
  }
  return { hours: fallbackHours, period: fallbackPeriod };
}

function formatYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
