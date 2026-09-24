export type ProjectUpdateHealth = 'in_linea' | 'attenzione' | 'bloccato';

export type RoadblockType =
  | 'persone'
  | 'risorse'
  | 'strumenti'
  | 'informazioni'
  | 'attenzione_cliente'
  | 'decisioni'
  | 'dipendenze_esterne';

export const HEALTH_OPTIONS: {
  value: ProjectUpdateHealth;
  label: string;
  description: string;
  dot: string;
  badge: string;
}[] = [
  {
    value: 'in_linea',
    label: 'In linea',
    description: 'Nessun ostacolo, tempi rispettati',
    dot: 'bg-green-500',
    badge: 'border-green-500/40 bg-green-500/10 text-green-700 dark:text-green-400',
  },
  {
    value: 'attenzione',
    label: 'Con attenzione',
    description: 'Rallentamento o rischio da monitorare',
    dot: 'bg-yellow-500',
    badge: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  },
  {
    value: 'bloccato',
    label: 'Bloccato',
    description: 'Il lavoro è fermo in attesa di qualcosa',
    dot: 'bg-destructive',
    badge: 'border-destructive/40 bg-destructive/10 text-destructive',
  },
];

export const getHealthMeta = (value?: string | null) =>
  HEALTH_OPTIONS.find((o) => o.value === value) ?? HEALTH_OPTIONS[0];

export const ROADBLOCK_TYPE_LABELS: Record<RoadblockType, string> = {
  persone: 'Persone',
  risorse: 'Risorse',
  strumenti: 'Strumenti',
  informazioni: 'Informazioni',
  attenzione_cliente: 'Attenzione cliente',
  decisioni: 'Decisioni',
  dipendenze_esterne: 'Dipendenze esterne',
};

export const ROADBLOCK_TYPE_OPTIONS = (Object.keys(ROADBLOCK_TYPE_LABELS) as RoadblockType[]).map(
  (value) => ({ value, label: ROADBLOCK_TYPE_LABELS[value] }),
);

export interface ProjectRoadblock {
  id: string;
  project_id: string;
  progress_update_id: string | null;
  description: string;
  blocker_type: RoadblockType;
  waiting_on_who: string | null;
  waiting_on_what: string | null;
  opened_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
  created_by: string | null;
  resolved_by: string | null;
}

export interface NewRoadblockInput {
  description: string;
  blocker_type: RoadblockType;
  waiting_on_who?: string;
  waiting_on_what?: string;
}

export const daysOpen = (openedAt: string): number => {
  const start = new Date(openedAt).getTime();
  const diff = Date.now() - start;
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
};
