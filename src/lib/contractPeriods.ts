// Unica fonte di verità per il riferimento contrattuale di una persona.
// I periodi in `user_contract_periods` vincono sempre; i campi sul profilo
// restano solo come ripiego per chi non ha ancora nessun periodo.

export interface ContractPeriodRow {
  user_id: string;
  start_date: string; // 'yyyy-MM-dd'
  end_date: string | null; // 'yyyy-MM-dd' or null = open-ended
  contract_hours: number | null;
  contract_hours_period: string | null;
  contract_type?: string | null;
}

export interface EffectiveContract {
  hours: number;
  period: string;
  contractType: string | null;
  /** Da dove arriva il dato: periodo contrattuale o ripiego sul profilo. */
  source: 'period' | 'profile';
}

export interface ContractFallback {
  hours: number;
  period: string;
  contractType?: string | null;
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
  fallbackPeriod: string,
  fallbackContractType?: string | null
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
      hours: Number(match.contract_hours),
      period: match.contract_hours_period || fallbackPeriod,
      contractType: match.contract_type ?? fallbackContractType ?? null,
      source: 'period',
    };
  }
  return {
    hours: fallbackHours,
    period: fallbackPeriod,
    contractType: fallbackContractType ?? null,
    source: 'profile',
  };
}

/** Come `getEffectiveContract`, ma su una singola data. */
export function getEffectiveContractForDate(
  userId: string,
  date: Date,
  periods: ContractPeriodRow[],
  fallbackHours: number,
  fallbackPeriod: string,
  fallbackContractType?: string | null
): EffectiveContract {
  return getEffectiveContract(userId, date, date, periods, fallbackHours, fallbackPeriod, fallbackContractType);
}

function formatYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
