/**
 * Etichette leggibili per i valori tecnici (aree, discipline, tipologie)
 * che arrivano dal foglio Google della customer satisfaction.
 */
import { AREA_LABELS } from '@/lib/areaColors';
import { disciplineLabels } from '@/lib/constants';

const PROJECT_TYPE_LABELS: Record<string, string> = {
  one_shot: 'One-Shot',
  'one-shot': 'One-Shot',
  oneshot: 'One-Shot',
  recurring: 'Recurring',
  ricorrente: 'Recurring',
  pack: 'Pack',
  hour_pack: 'Pack',
  'hour-pack': 'Pack',
  consumptive: 'Consuntivo',
  consuntivo: 'Consuntivo',
  pre_sales: 'Pre-sales',
  pre_sale: 'Pre-sales',
  'pre-sale': 'Pre-sales',
  'pre-sales': 'Pre-sales',
  interno: 'Interno',
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, '_');

/** Fallback: trasforma snake_case in "Parole Capitalizzate". */
const humanize = (value: string) =>
  value
    .trim()
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

export function formatAreaLabel(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return 'non indicato';
  return AREA_LABELS[normalize(raw) as keyof typeof AREA_LABELS] ?? humanize(raw);
}

export function formatDisciplineLabel(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return 'non indicato';
  return disciplineLabels[normalize(raw)] ?? humanize(raw);
}

export function formatProjectTypeLabel(value: string | null | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return 'non indicato';
  return PROJECT_TYPE_LABELS[normalize(raw)] ?? humanize(raw);
}

/** Etichetta corretta in base al criterio di raggruppamento. */
export function formatSatisfactionGroupLabel(
  groupBy: 'area' | 'projectType' | 'discipline',
  value: string | null | undefined
): string {
  if (groupBy === 'area') return formatAreaLabel(value);
  if (groupBy === 'discipline') return formatDisciplineLabel(value);
  return formatProjectTypeLabel(value);
}
