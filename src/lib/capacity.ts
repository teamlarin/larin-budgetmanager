// Capacità di lavoro: calcoli puri, condivisi tra dashboard Team e pagina Workload.
// La capacità contrattuale non tiene conto delle assenze: chi è in ferie risulterebbe
// "libero". Qui la capacità viene sempre resa NETTA delle ore di assenza.

/** Nome (prefisso) del progetto speciale su cui vengono registrate ferie/permessi/malattia/banca ore. */
export const ABSENCE_PROJECT_NAME_PREFIX = 'Larin OFF';

/** True se il progetto è il contenitore delle assenze e non un carico di lavoro reale. */
export function isAbsenceProjectName(name: string | null | undefined): boolean {
  if (!name) return false;
  return name.trim().toLowerCase().startsWith(ABSENCE_PROJECT_NAME_PREFIX.toLowerCase());
}

/**
 * Capacità contrattuale lorda su una finestra, dati i giorni lavorativi della finestra.
 * `daily` = ore al giorno, `weekly` = ore a settimana (5 giorni), `monthly` = ore al mese (22 giorni).
 */
export function grossCapacityHours(
  contractHours: number,
  contractPeriod: string,
  businessDays: number
): number {
  if (!contractHours || contractHours <= 0) return 0;
  switch (contractPeriod) {
    case 'daily':
      return contractHours * businessDays;
    case 'weekly':
      return contractHours * (businessDays / 5);
    case 'monthly':
    default:
      return contractHours * (businessDays / 22);
  }
}

export interface CapacityBreakdown {
  capacityGross: number;
  absenceHours: number;
  capacityNet: number;
  plannedHours: number;
  confirmedHours: number;
  freeHours: number;
  plannedPct: number;
  confirmedPct: number;
}

/**
 * Capacità netta e utilizzo. Le ore di assenza vengono sottratte dalla capacità e
 * NON contano come carico (pianificato/confermato arrivano già al netto delle assenze).
 */
export function buildCapacityBreakdown(input: {
  capacityGross: number;
  absenceHours: number;
  plannedHours: number;
  confirmedHours: number;
}): CapacityBreakdown {
  const round = (n: number) => Math.round(n * 10) / 10;
  const capacityGross = round(Math.max(0, input.capacityGross));
  const absenceHours = round(Math.max(0, input.absenceHours));
  const capacityNet = round(Math.max(0, capacityGross - absenceHours));
  const plannedHours = round(Math.max(0, input.plannedHours));
  const confirmedHours = round(Math.max(0, input.confirmedHours));
  const freeHours = round(Math.max(0, capacityNet - plannedHours));
  const pct = (value: number) => (capacityNet > 0 ? Math.round((value / capacityNet) * 100) : 0);
  return {
    capacityGross,
    absenceHours,
    capacityNet,
    plannedHours,
    confirmedHours,
    freeHours,
    plannedPct: pct(plannedHours),
    confirmedPct: pct(confirmedHours),
  };
}
