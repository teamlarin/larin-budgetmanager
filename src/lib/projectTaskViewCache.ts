import {
  filterAndSortProjectTasks,
  type ProjectTask, type ProjectTaskFilters, type ProjectTaskSortKey,
} from './projectTaskSort';

/**
 * Cache client per i risultati di filtro/ordinamento/ricerca condivisi da Lista,
 * Calendario e Agenda.
 *
 * Nessun dato attraversa la rete: la cache lavora solo sull'array già letto tramite
 * React Query (quindi già filtrato dalle policy RLS di `project_tasks`) e viene
 * invalidata integralmente quando cambia il dataset — inclusi stato, priorità,
 * scadenza, completamento e campi di ricorrenza — così una modifica di stato o di
 * regola ricorrente non può mai restituire un risultato obsoleto.
 */

const MAX_ENTRIES = 24;

/** Campi che influenzano filtri, ricerca, ordinamento e raggruppamenti delle viste. */
export function projectTasksVersion(tasks: ProjectTask[]): string {
  const parts: string[] = [String(tasks.length)];
  for (const t of tasks) {
    parts.push([
      t.id,
      t.status,
      t.priority,
      t.due_date || '',
      t.assignee_id || '',
      t.title,
      t.description || '',
      t.completed_at || '',
      t.recurrence_rule,
      t.recurrence_interval,
      t.recurrence_end_date || '',
      t.recurrence_parent_id || '',
      t.updated_at,
    ].join('~'));
  }
  return parts.join('|');
}

function namesKey(assigneeNames: Map<string, string>): string {
  // Solo la ricerca testuale usa i nomi: chiave stabile e ordinata.
  return [...assigneeNames.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, v]) => `${k}:${v}`).join(',');
}

export function projectTaskViewKey(
  filters: ProjectTaskFilters,
  sortKey: ProjectTaskSortKey,
  search: string,
  assigneeNames: Map<string, string>
): string {
  const q = (search || '').trim().toLowerCase();
  return [
    filters.status || 'all',
    filters.priority || 'all',
    filters.assigneeId || 'all',
    sortKey,
    q,
    q ? namesKey(assigneeNames) : '',
  ].join('|');
}

export class ProjectTaskViewCache {
  private version = '';
  private entries = new Map<string, ProjectTask[]>();
  /** Contatori utili nei test e per il debug. */
  hits = 0;
  misses = 0;
  invalidations = 0;

  get size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.version = '';
  }

  get(
    tasks: ProjectTask[],
    filters: ProjectTaskFilters,
    sortKey: ProjectTaskSortKey,
    search: string,
    assigneeNames: Map<string, string>
  ): ProjectTask[] {
    const version = projectTasksVersion(tasks);
    if (version !== this.version) {
      if (this.entries.size > 0) this.invalidations += 1;
      this.entries.clear();
      this.version = version;
    }
    const key = projectTaskViewKey(filters, sortKey, search, assigneeNames);
    const cached = this.entries.get(key);
    if (cached) {
      this.hits += 1;
      // LRU: rinfresca la posizione
      this.entries.delete(key);
      this.entries.set(key, cached);
      return cached;
    }
    this.misses += 1;
    const result = filterAndSortProjectTasks(tasks, filters, sortKey, search, assigneeNames);
    this.entries.set(key, result);
    if (this.entries.size > MAX_ENTRIES) {
      const oldest = this.entries.keys().next().value;
      if (oldest !== undefined) this.entries.delete(oldest);
    }
    return result;
  }
}
