export interface DocSection {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
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
    children: [
      { id: 'man-dashboard', label: 'Dashboard' },
      { id: 'man-budget', label: 'Budget' },
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
