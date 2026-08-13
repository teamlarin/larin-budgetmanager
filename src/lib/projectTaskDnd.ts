import type { ProjectTaskPriority, ProjectTaskStatus } from './projectTaskSort';

export const TASK_DND_MIME = 'application/x-timetrap-task';

/** Modifiche applicabili tramite drag & drop. */
export interface TaskDropChanges {
  due_date?: string | null;
  priority?: ProjectTaskPriority;
  status?: ProjectTaskStatus;
}

/** Campi propagabili a una serie ricorrente (gli altri restano sull'occorrenza). */
const SERIES_LEVEL_KEYS: Array<keyof TaskDropChanges> = ['priority'];

/** True se il drop tocca un campo di serie: richiede la scelta dell'ambito ricorrenza. */
export function dropAffectsSeries(changes: TaskDropChanges): boolean {
  return SERIES_LEVEL_KEYS.some((k) => k in changes && changes[k] !== undefined);
}

/** True se il drop non cambia nulla rispetto ai valori attuali (evita update inutili). */
export function isNoopDrop(
  current: { due_date: string | null; priority: ProjectTaskPriority; status: ProjectTaskStatus },
  changes: TaskDropChanges
): boolean {
  const dueEqual =
    !('due_date' in changes) ||
    (changes.due_date || null) === (current.due_date ? current.due_date.slice(0, 10) : null);
  const prioEqual = !('priority' in changes) || changes.priority === current.priority;
  const statusEqual = !('status' in changes) || changes.status === current.status;
  return dueEqual && prioEqual && statusEqual;
}

/** Descrizione leggibile del drop, per messaggi utente. */
export function describeDrop(changes: TaskDropChanges): string {
  const parts: string[] = [];
  if ('due_date' in changes) parts.push(changes.due_date ? `scadenza ${changes.due_date}` : 'scadenza rimossa');
  if (changes.priority) parts.push(`priorità ${changes.priority}`);
  if (changes.status) parts.push(`stato ${changes.status}`);
  return parts.join(', ');
}

export function setDragTaskId(e: React.DragEvent, id: string) {
  e.dataTransfer.setData(TASK_DND_MIME, id);
  e.dataTransfer.setData('text/plain', id);
  e.dataTransfer.effectAllowed = 'move';
}

export function getDragTaskId(e: React.DragEvent): string | null {
  return e.dataTransfer.getData(TASK_DND_MIME) || e.dataTransfer.getData('text/plain') || null;
}
