// HR cost calculation helpers - mirror of the HTML prototype logic

export const COEFFICIENTS: Record<string, { coeff: number; months: number }> = {
  'Stage':         { coeff: 1.0, months: 12 },
  'Apprendista':   { coeff: 1.3, months: 14 },
  'Impiegato':     { coeff: 1.4, months: 14 },
  'Dirigente':     { coeff: 1.6, months: 14 },
  'Amministratore':{ coeff: 1.3, months: 12 },
  'P.IVA':         { coeff: 1.0, months: 12 },
  'Rit.Acc.':      { coeff: 1.0, months: 12 },
};

export const CONTRACT_TYPES = ['Stage','Apprendista','Impiegato','Dirigente','Amministratore','P.IVA','Rit.Acc.'] as const;
export const DIPENDENTI_TYPES = ['Impiegato','Apprendista','Dirigente','Amministratore'];
export const PIVA_TYPES = ['P.IVA','Rit.Acc.'];

export const MONTHS_IT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

export interface HrEmployee {
  id: string;
  profile_id?: string | null;
  azienda?: string | null;
  cognome?: string | null;
  nome?: string | null;
  job_title?: string | null;
  team?: string | null;
  contratto: string;
  stato: string; // 'confermato' | 'pianificato'
  ral: number;
  ore_freelance?: number | null;
  bp_unitario?: number | null;
  fringe_annuale?: number | null;
  orario?: string | null; // FT/PT
  pt_perc?: number | null;
  data_nascita?: string | null;
  data_inizio_collaborazione?: string | null;
  data_inizio: string;
  data_fine: string;
  sesso?: string | null;
}

export interface CalculatedEmployee extends HrEmployee {
  coeff: number;
  costoAziendaAnnuale: number;
  costoAziendaMensile: number;
  bpMensili: number;
  bpAnnuali: number;
  fringe: number;
  costoTotaleMensile: number;
  costoTotaleAnnuale: number;
  costoOrario: number | null;
  months: number[];
  totalActual: number;
  isActiveInYear: boolean;
  eta: number | null;
  anzianita: number | null;
}

const TODAY = new Date();

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0);
}

export function calcAge(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const birth = new Date(dateStr + 'T00:00:00');
  const diff = TODAY.getTime() - birth.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export function calcSeniority(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const start = new Date(dateStr + 'T00:00:00');
  const diff = TODAY.getTime() - start.getTime();
  const years = diff / (365.25 * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.round(years * 10) / 10);
}

export function isCessato(emp: HrEmployee): boolean {
  const fine = new Date(emp.data_fine + 'T00:00:00');
  return fine < TODAY;
}

export function isFuturo(emp: HrEmployee): boolean {
  const inizio = new Date(emp.data_inizio + 'T00:00:00');
  return emp.stato !== 'pianificato' && inizio > TODAY;
}

export function calcEmployee(emp: HrEmployee, year: number): CalculatedEmployee {
  const cfg = COEFFICIENTS[emp.contratto] || { coeff: 1.0, months: 12 };
  const coeff = cfg.coeff;
  const ralAnnuale = +emp.ral || 0;

  const costoAziendaAnnuale = ralAnnuale * coeff;
  const costoAziendaMensile = costoAziendaAnnuale / 12;

  const bpUnitario = +(emp.bp_unitario || 0);
  const bpAnnuali = bpUnitario * 200;
  const bpMensili = bpAnnuali / 12;

  const fringe = +(emp.fringe_annuale || 0);

  const costoTotaleMensile = costoAziendaMensile + bpMensili + fringe / 12;
  const costoTotaleAnnuale = costoAziendaAnnuale + bpAnnuali + fringe;

  let costoOrario: number | null = null;
  const isDip = DIPENDENTI_TYPES.includes(emp.contratto);
  if (emp.ore_freelance && emp.ore_freelance > 0) {
    costoOrario = costoAziendaMensile / emp.ore_freelance;
  } else if (isDip) {
    const ptFactor = emp.orario === 'PT' && emp.pt_perc ? emp.pt_perc / 100 : 1;
    const giorniAnno = 200 * ptFactor;
    const oreAnno = giorniAnno * 8;
    costoOrario = oreAnno > 0 ? costoTotaleAnnuale / oreAnno : null;
  }

  const startDate = new Date(emp.data_inizio + 'T00:00:00');
  const endDate = new Date(emp.data_fine + 'T00:00:00');

  const months: number[] = [];
  let totalActual = 0;
  for (let m = 1; m <= 12; m++) {
    const ld = lastDayOfMonth(year, m);
    const active = ld >= startDate && ld <= endDate;
    const cost = active ? costoTotaleMensile : 0;
    months.push(cost);
    totalActual += cost;
  }

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const isActiveInYear = startDate <= yearEnd && endDate >= yearStart;

  return {
    ...emp,
    coeff,
    costoAziendaAnnuale,
    costoAziendaMensile,
    bpMensili,
    bpAnnuali,
    fringe,
    costoTotaleMensile,
    costoTotaleAnnuale,
    costoOrario,
    months,
    totalActual,
    isActiveInYear,
    eta: calcAge(emp.data_nascita),
    anzianita: calcSeniority(emp.data_inizio_collaborazione),
  };
}

export function fmt(v: number | null | undefined, decimals = 0): string {
  if (v === null || v === undefined || v === 0) return '–';
  const rounded = Math.round(v * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const [intPart, decPart] = rounded.toFixed(decimals).split('.');
  const intFormatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimals > 0 ? intFormatted + ',' + decPart : intFormatted;
}

export function fmtEuro(v: number | null | undefined): string {
  if (!v) return '–';
  return '€ ' + fmt(v);
}

export function dateShort(s?: string | null): string {
  if (!s) return '–';
  if (s.startsWith('2099') || s.startsWith('9999')) return '∞';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
