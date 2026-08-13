import { describe, expect, it } from 'vitest';
import { filterAndSortProjectTasks, type ProjectTask } from '@/lib/projectTaskSort';
import { ProjectTaskViewCache, projectTasksVersion } from '@/lib/projectTaskViewCache';

const task = (over: Partial<ProjectTask> & { id: string }): ProjectTask => ({
  project_id: 'p1',
  title: `Task ${over.id}`,
  description: null,
  assignee_id: null,
  status: 'todo',
  priority: 'medium',
  due_date: '2026-08-20',
  workflow_flow_task_id: null,
  created_by: null,
  completed_at: null,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-01T10:00:00Z',
  recurrence_rule: 'none',
  recurrence_interval: 1,
  recurrence_end_date: null,
  recurrence_parent_id: null,
  ...over,
});

const base: ProjectTask[] = [
  task({ id: 'a', priority: 'high', due_date: '2026-08-18' }),
  task({ id: 'b', status: 'in_progress', assignee_id: 'u1' }),
  task({ id: 'c', priority: 'low', due_date: null }),
];

const names = new Map([['u1', 'Mario Rossi']]);
const filters = { status: 'all' as const, priority: 'all' as const, assigneeId: 'all' as const };

describe('ProjectTaskViewCache', () => {
  it('restituisce lo stesso risultato di filterAndSortProjectTasks', () => {
    const cache = new ProjectTaskViewCache();
    const expected = filterAndSortProjectTasks(base, filters, 'priority', '', names);
    expect(cache.get(base, filters, 'priority', '', names).map((t) => t.id)).toEqual(expected.map((t) => t.id));
  });

  it('serve dalla cache la stessa combinazione e ricalcola le altre', () => {
    const cache = new ProjectTaskViewCache();
    cache.get(base, filters, 'priority', '', names);
    const second = cache.get(base, filters, 'priority', '', names);
    expect(cache.hits).toBe(1);
    expect(second).toBe(cache.get(base, filters, 'priority', '', names));

    cache.get(base, filters, 'due_date', '', names);
    cache.get(base, { ...filters, status: 'todo' }, 'priority', '', names);
    cache.get(base, filters, 'priority', 'mario', names);
    expect(cache.misses).toBe(4);
    expect(cache.size).toBe(4);
  });

  it('invalida la cache quando cambia lo stato di una task', () => {
    const cache = new ProjectTaskViewCache();
    cache.get(base, { ...filters, status: 'todo' }, 'priority', '', names);
    const updated = base.map((t) => (t.id === 'a' ? { ...t, status: 'done' as const, completed_at: 'x' } : t));
    const after = cache.get(updated, { ...filters, status: 'todo' }, 'priority', '', names);
    expect(cache.invalidations).toBe(1);
    expect(after.map((t) => t.id)).not.toContain('a');
  });

  it('invalida la cache quando cambia la ricorrenza di una task', () => {
    const cache = new ProjectTaskViewCache();
    cache.get(base, filters, 'priority', '', names);
    const updated = base.map((t) =>
      t.id === 'b' ? { ...t, recurrence_rule: 'weekly' as const, recurrence_interval: 2, updated_at: '2026-08-13T08:00:00Z' } : t
    );
    cache.get(updated, filters, 'priority', '', names);
    expect(cache.invalidations).toBe(1);
    expect(cache.size).toBe(1);
  });

  it('la versione cambia su stato, priorità, scadenza, assegnatario e ricorrenza', () => {
    const v0 = projectTasksVersion(base);
    const mutations: Partial<ProjectTask>[] = [
      { status: 'done' }, { priority: 'low' }, { due_date: '2026-09-01' },
      { assignee_id: 'u2' }, { recurrence_rule: 'daily' }, { recurrence_end_date: '2026-12-01' },
      { title: 'Nuovo titolo' }, { description: 'nota' },
    ];
    mutations.forEach((m) => {
      const next = base.map((t) => (t.id === 'a' ? { ...t, ...m } : t));
      expect(projectTasksVersion(next)).not.toBe(v0);
    });
    expect(projectTasksVersion([...base])).toBe(v0);
  });

  it('la cache non introduce accessi ai dati: opera solo sull’array ricevuto (RLS invariata)', () => {
    const cache = new ProjectTaskViewCache();
    const src = JSON.stringify(base);
    cache.get(base, filters, 'due_date', 'mario', names);
    expect(JSON.stringify(base)).toBe(src);
    expect(cache.get(base, filters, 'due_date', 'mario', names).map((t) => t.id)).toEqual(
      filterAndSortProjectTasks(base, filters, 'due_date', 'mario', names).map((t) => t.id)
    );
  });
});
