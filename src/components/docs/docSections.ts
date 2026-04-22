export interface DocSection {
  id: string;
  label: string;
  /** ISO date (yyyy-MM-dd) dell'ultimo aggiornamento sostanziale del contenuto. */
  updatedAt?: string;
  children?: { id: string; label: string; updatedAt?: string }[];
}

export const docSections: DocSection[] = [
  {
    id: 'novita',
    label: '🆕 Novità',
  },
  {
    id: 'quick-start',
    label: 'Quick Start',
    children: [
      { id: 'qs-primo-accesso', label: 'Primo accesso' },
      { id: 'qs-panoramica', label: 'Panoramica interfaccia' },
      { id: 'qs-primo-budget', label: 'Il primo budget' },
      { id: 'qs-calendario', label: 'Pianifica nel calendario' },
    ],
  },
  {
    id: 'manuale',
    label: 'Manuale Dettagliato',
    updatedAt: '2026-04-22',
    children: [
      { id: 'man-dashboard', label: 'Dashboard' },
      { id: 'man-budget', label: 'Budget', updatedAt: '2026-04-22' },
      { id: 'man-preventivi', label: 'Preventivi' },
      { id: 'man-progetti', label: 'Progetti' },
      { id: 'man-approved-projects', label: 'Progetti Approvati' },
      { id: 'man-calendario', label: 'Calendario e Timesheet' },
      { id: 'man-workload', label: 'Workload' },
      { id: 'man-workflows', label: 'Workflows' },
      { id: 'man-performance', label: 'Performance Reviews' },
      { id: 'man-hours-bank', label: 'Banca Ore' },
      { id: 'man-impostazioni', label: 'Impostazioni' },
    ],
  },
  {
    id: 'ruoli-permessi',
    label: 'Ruoli e Permessi',
  },
  {
    id: 'ai-automazioni',
    label: 'AI e Automazioni',
    updatedAt: '2026-04-22',
  },
  {
    id: 'best-practices',
    label: 'Best Practices',
  },
  {
    id: 'faq',
    label: 'FAQ',
  },
  {
    id: 'troubleshooting',
    label: 'Troubleshooting',
  },
];

/**
 * Restituisce true se la sezione è stata aggiornata negli ultimi `days` giorni.
 */
export function isRecentlyUpdated(updatedAt: string | undefined, days = 30): boolean {
  if (!updatedAt) return false;
  const updated = new Date(updatedAt).getTime();
  if (Number.isNaN(updated)) return false;
  const diffDays = (Date.now() - updated) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

/**
 * Formatta una data ISO (yyyy-MM-dd) in formato italiano breve.
 */
export function formatUpdatedAt(updatedAt: string): string {
  const d = new Date(updatedAt);
  if (Number.isNaN(d.getTime())) return updatedAt;
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
