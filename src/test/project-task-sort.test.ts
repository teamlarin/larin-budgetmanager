import { describe, it, expect } from 'vitest';
import {
  filterProjectTasks,
  sortProjectTasks,
  filterAndSortProjectTasks,
  searchProjectTasks,
  nextRecurrenceDate,
  shouldGenerateNextOccurrence,
  type ProjectTask,
} from '@/lib/projectTaskSort';

const task = (o: Partial<ProjectTask> & { id: string }): ProjectTask => ({
  project_id: 'p1',
  title: o.id,
  description: null,
  assignee_id: null,
  status: 'todo',
  priority: 'medium',
  due_date: null,
  workflow_flow_task_id: null,
  created_by: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  recurrence_rule: 'none',
  recurrence_interval: 1,
  recurrence_end_date: null,
  recurrence_parent_id: null,
  ...o,
});

describe('nextRecurrenceDate', () => {
  it('calcola le date per regola e intervallo', () => {
    expect(nextRecurrenceDate('2026-01-01', 'daily')).toBe('2026-01-02');
    expect(nextRecurrenceDate('2026-01-01', 'weekly', 2)).toBe('2026-01-15');
    expect(nextRecurrenceDate('2026-01-31', 'monthly')).toBe('2026-02-28');
    expect(nextRecurrenceDate('2026-01-01', 'none')).toBeNull();
  });
});

describe('shouldGenerateNextOccurrence', () => {
  it('non genera senza ricorrenza', () => {
    expect(shouldGenerateNextOccurrence(task({ id: 'a' }), '2026-01-01')).toBe(false);
  });

  it('genera se entro la data di fine', () => {
    const t = task({ id: 'a', recurrence_rule: 'weekly', due_date: '2026-01-01', recurrence_end_date: '2026-03-01' });
    expect(shouldGenerateNextOccurrence(t, '2026-01-01')).toBe(true);
  });

  it('non genera oltre la data di fine', () => {
    const t = task({ id: 'a', recurrence_rule: 'weekly', due_date: '2026-01-01', recurrence_end_date: '2026-01-05' });
    expect(shouldGenerateNextOccurrence(t, '2026-01-01')).toBe(false);
  });
});

describe('searchProjectTasks', () => {
  const tasks = [
    task({ id: '1', title: 'Brief creativo' }),
    task({ id: '2', title: 'Altro', description: 'Rivedere il BRIEF con il cliente' }),
    task({ id: '3', title: 'Terzo', assignee_id: 'u1' }),
  ];
  const names = new Map([['u1', 'Angelica Vuocolo']]);

  it('cerca in titolo, descrizione e assegnatario', () => {
    expect(searchProjectTasks(tasks, 'brief', names).map((t) => t.id)).toEqual(['1', '2']);
    expect(searchProjectTasks(tasks, 'vuocolo', names).map((t) => t.id)).toEqual(['3']);
  });

  it('query vuota restituisce tutto', () => {
    expect(searchProjectTasks(tasks, '  ', names)).toHaveLength(3);
  });
});

describe('sortProjectTasks', () => {
  it('ordina per priorità high -> medium -> low', () => {
    const tasks = [
      task({ id: 'low', priority: 'low' }),
      task({ id: 'high', priority: 'high' }),
      task({ id: 'medium', priority: 'medium' }),
    ];
    expect(sortProjectTasks(tasks).map((t) => t.id)).toEqual(['high', 'medium', 'low']);
  });

  it('a parità di priorità ordina per scadenza ASC con null in fondo', () => {
    const tasks = [
      task({ id: 'no-date', priority: 'high' }),
      task({ id: 'late', priority: 'high', due_date: '2026-05-10' }),
      task({ id: 'soon', priority: 'high', due_date: '2026-02-01' }),
    ];
    expect(sortProjectTasks(tasks).map((t) => t.id)).toEqual(['soon', 'late', 'no-date']);
  });

  it('ordina per scadenza con null in fondo', () => {
    const tasks = [
      task({ id: 'none' }),
      task({ id: 'b', due_date: '2026-03-01' }),
      task({ id: 'a', due_date: '2026-01-01' }),
    ];
    expect(sortProjectTasks(tasks, 'due_date').map((t) => t.id)).toEqual(['a', 'b', 'none']);
  });

  it('non muta l’array originale', () => {
    const tasks = [task({ id: 'low', priority: 'low' }), task({ id: 'high', priority: 'high' })];
    sortProjectTasks(tasks);
    expect(tasks.map((t) => t.id)).toEqual(['low', 'high']);
  });
});

describe('filterProjectTasks', () => {
  const tasks = [
    task({ id: '1', status: 'todo', priority: 'high', assignee_id: 'u1' }),
    task({ id: '2', status: 'in_progress', priority: 'low', assignee_id: 'u2' }),
    task({ id: '3', status: 'done', priority: 'medium' }),
  ];

  it('filtra per stato', () => {
    expect(filterProjectTasks(tasks, { status: 'in_progress' }).map((t) => t.id)).toEqual(['2']);
  });

  it('filtra per priorità', () => {
    expect(filterProjectTasks(tasks, { priority: 'high' }).map((t) => t.id)).toEqual(['1']);
  });

  it('filtra per assegnatario e non assegnate', () => {
    expect(filterProjectTasks(tasks, { assigneeId: 'u2' }).map((t) => t.id)).toEqual(['2']);
    expect(filterProjectTasks(tasks, { assigneeId: 'unassigned' }).map((t) => t.id)).toEqual(['3']);
  });

  it('senza filtri restituisce tutto', () => {
    expect(filterProjectTasks(tasks)).toHaveLength(3);
  });

  it('combina filtro e ordinamento', () => {
    const result = filterAndSortProjectTasks(
      [
        task({ id: 'a', status: 'todo', priority: 'low' }),
        task({ id: 'b', status: 'todo', priority: 'high' }),
        task({ id: 'c', status: 'done', priority: 'high' }),
      ],
      { status: 'todo' },
      'priority'
    );
    expect(result.map((t) => t.id)).toEqual(['b', 'a']);
  });
});
